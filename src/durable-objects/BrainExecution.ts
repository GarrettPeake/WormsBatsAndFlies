// Durable Object for managing brain execution runtime

import type {
  Brain,
  Neuron,
  BrainExecution as BrainExecutionState,
  NeuronState,
  StepRecord,
  QueuedMessage,
  MemoryEntry,
  WSServerMessage,
  WSClientMessage,
  Env,
} from '../types';
import { OpenRouterDAO } from '../dao/openrouter.dao';
import { ExecutionDAO } from '../dao/execution.dao';

/**
 * Payload for initializing an execution.
 * Note: The brain configuration is embedded in execution.brainSnapshot
 */
interface InitPayload {
  execution: BrainExecutionState;
  initialInput?: string;
  stepDelayMs?: number;
}

interface InitSyncPayload extends InitPayload {
  maxSteps: number;
  stream: boolean;
}

export class BrainExecution implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private execution: BrainExecutionState | null = null;
  private brain: Brain | null = null;
  private connectedClients: Set<WebSocket> = new Set();
  private isProcessing: boolean = false;
  private stepDelayMs: number = 1000;
  private openRouterDAO: OpenRouterDAO | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.openRouterDAO = new OpenRouterDAO(env.OPENROUTER_API_KEY);
  }

  /**
   * Load execution state from KV if not already loaded.
   * The brain configuration is loaded from the execution's immutable snapshot,
   * NOT from the live brain configuration. This ensures that executions remain
   * consistent even if the original brain is modified during execution.
   */
  private async loadStateIfNeeded(execId: string): Promise<boolean> {
    // If already loaded, no need to reload
    if (this.execution && this.brain) {
      return true;
    }

    try {
      // Load execution from KV
      const executionDAO = new ExecutionDAO(this.env.EXECUTIONS_KV);
      this.execution = await executionDAO.getById(execId);

      if (!this.execution) {
        return false;
      }

      // Use the brain snapshot from the execution state - this ensures immutability
      // The snapshot was captured when the execution started and is stored with
      // the execution, so changes to the original brain won't affect this execution
      this.brain = this.execution.brainSnapshot;

      return this.brain !== null;
    } catch (error) {
      console.error('Failed to load state:', error);
      return false;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // For init endpoints, the execution state comes from the request body
    if (path === '/init' || path === '/init-sync') {
      return path === '/init' ? this.handleInit(request) : this.handleInitSync(request);
    }

    // For all other endpoints, extract execution ID from the DO's name or URL path
    // The DO is created with idFromName(execId), so we can get it from state.id.name
    // For WebSocket streams, the execId is also included in the URL path as a fallback
    let execId = this.state.id.name ?? '';

    // Handle WebSocket stream with execId in path: /stream/:execId
    if (path.startsWith('/stream/')) {
      const pathExecId = path.substring('/stream/'.length);
      if (pathExecId) {
        execId = pathExecId;
      }
      // WebSocket upgrade
      if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        return this.handleWebSocket(request, execId);
      }
      return new Response(
        JSON.stringify({ error: 'WebSocket upgrade required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!execId) {
      return new Response(
        JSON.stringify({ error: 'Invalid Durable Object ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (path) {
      case '/stream':
        // Legacy path without execId - use state.id.name
        if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
          return this.handleWebSocket(request, execId);
        }
        return new Response(
          JSON.stringify({ error: 'WebSocket upgrade required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      case '/pause':
        return this.handlePause(execId);
      case '/resume':
        return this.handleResume(execId);
      case '/step':
        return this.handleStep(execId);
      case '/input':
        return this.handleInput(request, execId);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Initialize execution and start running (async mode)
   * The brain configuration is embedded in execution.brainSnapshot for immutability
   */
  private async handleInit(request: Request): Promise<Response> {
    try {
      const payload = await request.json() as InitPayload;

      this.execution = payload.execution;
      // Use the brain snapshot from the execution state - this ensures immutability
      this.brain = payload.execution.brainSnapshot;
      this.stepDelayMs = payload.stepDelayMs ?? 1000;

      // Queue initial input if provided
      if (payload.initialInput && this.brain.textInputNeuronId) {
        this.queueUserInput(payload.initialInput, 'text');
      }

      // Update status to running
      this.execution.status = 'running';
      await this.persistState();

      // Start execution loop
      this.startExecutionLoop();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Init error:', error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Initialize and run execution synchronously until completion (for OpenAI endpoint)
   * The brain configuration is embedded in execution.brainSnapshot for immutability
   */
  private async handleInitSync(request: Request): Promise<Response> {
    try {
      const payload = await request.json() as InitSyncPayload;

      this.execution = payload.execution;
      // Use the brain snapshot from the execution state - this ensures immutability
      this.brain = payload.execution.brainSnapshot;

      // Queue initial input if provided
      if (payload.initialInput && this.brain.textInputNeuronId) {
        this.queueUserInput(payload.initialInput, 'text');
      }

      // Update status to running
      this.execution.status = 'running';

      if (payload.stream) {
        // Streaming response
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Run execution with streaming
        (async () => {
          try {
            let finalOutput = '';
            let totalTokens = 0;
            let stepCount = 0;

            while (stepCount < payload.maxSteps) {
              const result = await this.executeStep();

              if (!result.firedCount) {
                // Fizzled - no neurons fired
                break;
              }

              stepCount++;
              totalTokens += result.tokensUsed;

              // Check if output neuron fired
              if (result.outputContent) {
                finalOutput = result.outputContent;

                // Send chunk
                const chunk = {
                  id: `chatcmpl-${this.execution!.id}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: this.brain!.id,
                  choices: [{
                    index: 0,
                    delta: { content: result.outputContent },
                    finish_reason: null,
                  }],
                };

                await writer.write(encoder.encode(JSON.stringify(chunk)));
              }
            }

            // Send final chunk with finish_reason
            const finalChunk = {
              id: `chatcmpl-${this.execution!.id}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: this.brain!.id,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: stepCount >= payload.maxSteps ? 'length' : 'stop',
              }],
            };

            await writer.write(encoder.encode(JSON.stringify(finalChunk)));
            await writer.close();
          } catch (error) {
            console.error('Streaming execution error:', error);
            await writer.abort(error);
          }
        })();

        return new Response(readable, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      } else {
        // Non-streaming response
        let finalOutput = '';
        let totalTokens = 0;
        let stepCount = 0;

        while (stepCount < payload.maxSteps) {
          const result = await this.executeStep();

          if (!result.firedCount) {
            // Fizzled - no neurons fired
            break;
          }

          stepCount++;
          totalTokens += result.tokensUsed;

          // Check if output neuron fired
          if (result.outputContent) {
            finalOutput = result.outputContent;
          }
        }

        return new Response(
          JSON.stringify({
            output: finalOutput,
            tokensUsed: totalTokens,
            steps: stepCount,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('Init sync error:', error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle WebSocket connection
   */
  private async handleWebSocket(request: Request, execId: string): Promise<Response> {
    // Load state if needed (DO may have been hibernated)
    const loaded = await this.loadStateIfNeeded(execId);
    if (!loaded) {
      return new Response(
        JSON.stringify({ error: 'Execution not found or failed to load' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.connectedClients.add(server);

    // Send current state on connect
    if (this.execution) {
      const msg: WSServerMessage = {
        type: 'execution_started',
        data: { execId: this.execution.id, step: this.execution.currentStep },
      };
      server.send(JSON.stringify(msg));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = JSON.parse(message as string) as WSClientMessage;

      switch (data.type) {
        case 'pause':
          await this.handlePause();
          break;
        case 'resume':
          await this.handleResume();
          break;
        case 'step':
          await this.handleStep();
          break;
        case 'input':
          this.queueUserInput(data.data.content, data.data.type);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket) {
    this.connectedClients.delete(ws);

    // If no clients connected, persist state
    if (this.connectedClients.size === 0 && this.execution) {
      await this.persistState();
    }
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error);
    this.connectedClients.delete(ws);
  }

  /**
   * Pause execution
   */
  private async handlePause(execId?: string): Promise<Response> {
    // Get execId from parameter or current execution
    const id = execId ?? this.execution?.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load state if needed (DO may have been hibernated)
    const loaded = await this.loadStateIfNeeded(id);
    if (!loaded || !this.execution) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    this.execution.status = 'paused';
    this.execution.pausedAt = new Date().toISOString();
    await this.persistState();

    this.broadcast({ type: 'execution_paused', data: { step: this.execution.currentStep } });

    return new Response(JSON.stringify({ success: true, step: this.execution.currentStep }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Resume execution
   */
  private async handleResume(execId?: string): Promise<Response> {
    // Get execId from parameter or current execution
    const id = execId ?? this.execution?.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load state if needed (DO may have been hibernated)
    const loaded = await this.loadStateIfNeeded(id);
    if (!loaded || !this.execution) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    this.execution.status = 'running';
    delete this.execution.pausedAt;
    await this.persistState();

    this.broadcast({ type: 'execution_resumed', data: { step: this.execution.currentStep } });

    // Resume execution loop
    this.startExecutionLoop();

    return new Response(JSON.stringify({ success: true, step: this.execution.currentStep }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Execute a single step (manual mode)
   */
  private async handleStep(execId?: string): Promise<Response> {
    // Get execId from parameter or current execution
    const id = execId ?? this.execution?.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load state if needed (DO may have been hibernated)
    const loaded = await this.loadStateIfNeeded(id);
    if (!loaded || !this.execution) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (this.execution.status !== 'paused') {
      return new Response(JSON.stringify({ error: 'Execution must be paused to step manually' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await this.executeStep();

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle new input to the brain
   */
  private async handleInput(request: Request, execId: string): Promise<Response> {
    // Load state if needed (DO may have been hibernated)
    const loaded = await this.loadStateIfNeeded(execId);
    if (!loaded || !this.execution || !this.brain) {
      return new Response(JSON.stringify({ error: 'No active execution' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json() as { content: string; type: 'text' | 'image' };
    this.queueUserInput(body.content, body.type);

    // Auto-resume execution if it's paused (e.g., after a fizzle)
    // This allows users to continue the conversation without manually resuming
    if (this.execution.status === 'paused') {
      this.execution.status = 'running';
      delete this.execution.pausedAt;
      await this.persistState();
      this.broadcast({ type: 'execution_resumed', data: { step: this.execution.currentStep } });
      this.startExecutionLoop();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Queue user input to the appropriate input neuron
   */
  private queueUserInput(content: string, type: 'text' | 'image') {
    if (!this.execution || !this.brain) return;

    const targetNeuronId = type === 'text'
      ? this.brain.textInputNeuronId
      : this.brain.pictureInputNeuronId;

    if (!targetNeuronId) return;

    const neuronState = this.execution.neuronStates[targetNeuronId];
    if (!neuronState) return;

    const message: QueuedMessage = {
      sourceNeuronId: 'user',
      sourceNeuronName: 'User',
      content,
      timestamp: new Date().toISOString(),
      isUserInput: true,
    };

    neuronState.inputQueue.push(message);
    neuronState.status = 'queued';
  }

  /**
   * Start the execution loop
   */
  private async startExecutionLoop() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.execution?.status === 'running') {
      const result = await this.executeStep();

      if (!result.firedCount) {
        // Fizzled - no neurons fired
        this.broadcast({ type: 'execution_fizzled', data: { totalSteps: this.execution.currentStep } });
        this.execution.status = 'paused';
        await this.persistState();
        break;
      }

      // Delay between steps
      if (this.stepDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.stepDelayMs));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single step of the brain
   */
  private async executeStep(): Promise<{
    firedCount: number;
    tokensUsed: number;
    outputContent?: string;
  }> {
    if (!this.execution || !this.brain || !this.openRouterDAO) {
      return { firedCount: 0, tokensUsed: 0 };
    }

    const stepNumber = this.execution.currentStep + 1;
    const startedAt = new Date().toISOString();

    this.broadcast({ type: 'step_started', data: { step: stepNumber } });

    // Find neurons with queued inputs
    const neuronsToFire: string[] = [];
    for (const [neuronId, state] of Object.entries(this.execution.neuronStates)) {
      if (state.inputQueue.length > 0) {
        neuronsToFire.push(neuronId);
        state.status = 'queued';
      }
    }

    if (neuronsToFire.length === 0) {
      return { firedCount: 0, tokensUsed: 0 };
    }

    const firedNeurons: StepRecord['firedNeurons'] = [];
    const errors: StepRecord['errors'] = [];
    let totalTokensUsed = 0;
    let outputContent: string | undefined;

    // Fire all queued neurons in parallel
    await Promise.all(
      neuronsToFire.map(async (neuronId) => {
        const neuron = this.brain!.neurons.find(n => n.id === neuronId);
        const neuronState = this.execution!.neuronStates[neuronId];

        if (!neuron || !neuronState) return;

        neuronState.status = 'processing';
        this.broadcast({ type: 'neuron_processing', data: { neuronId, step: stepNumber } });

        try {
          const response = await this.openRouterDAO!.fireNeuron(
            neuron,
            neuronState.memory,
            neuronState.inputQueue
          );

          // Update neuron state
          neuronState.status = 'fired';
          neuronState.lastOutput = response.output;
          neuronState.lastSelfUpdate = response.selfUpdate;
          neuronState.totalFireCount++;
          neuronState.totalTokensUsed += response.tokensUsed;
          neuronState.averageResponseTimeMs =
            (neuronState.averageResponseTimeMs * (neuronState.totalFireCount - 1) + response.durationMs) /
            neuronState.totalFireCount;

          // Add memory entry
          if (response.selfUpdate) {
            const memoryEntry: MemoryEntry = {
              step: stepNumber,
              selfUpdate: response.selfUpdate,
              timestamp: new Date().toISOString(),
            };
            neuronState.memory.push(memoryEntry);
          }

          // Clear input queue
          const inputCount = neuronState.inputQueue.length;
          neuronState.inputQueue = [];

          totalTokensUsed += response.tokensUsed;

          // Propagate output to connected neurons
          if (response.output) {
            const connections = this.brain!.connections.filter(c => c.sourceNeuronId === neuronId);

            for (const connection of connections) {
              const targetState = this.execution!.neuronStates[connection.targetNeuronId];
              if (targetState) {
                const message: QueuedMessage = {
                  sourceNeuronId: neuronId,
                  sourceNeuronName: neuron.name,
                  content: response.output,
                  timestamp: new Date().toISOString(),
                };
                targetState.inputQueue.push(message);
                targetState.status = 'queued';
              }
            }

            // Check if this is the output neuron
            if (neuronId === this.brain!.textOutputNeuronId) {
              outputContent = response.output;
              this.broadcast({ type: 'final_output', data: { content: response.output } });
            }
          }

          firedNeurons.push({
            neuronId,
            neuronName: neuron.name,
            inputCount,
            outputEmitted: !!response.output,
            tokensUsed: response.tokensUsed,
            durationMs: response.durationMs,
          });

          this.broadcast({
            type: 'neuron_output',
            data: {
              neuronId,
              output: response.output,
              selfUpdate: response.selfUpdate,
              step: stepNumber,
            },
          });
        } catch (error) {
          neuronState.status = 'error';
          const errorMessage = error instanceof Error ? error.message : String(error);

          errors.push({ neuronId, error: errorMessage });
          this.broadcast({ type: 'neuron_error', data: { neuronId, error: errorMessage } });
        }
      })
    );

    // Reset idle neurons
    for (const [neuronId, state] of Object.entries(this.execution.neuronStates)) {
      if (state.status === 'fired') {
        state.status = state.inputQueue.length > 0 ? 'queued' : 'idle';
      }
    }

    // Record step
    const stepRecord: StepRecord = {
      stepNumber,
      startedAt,
      completedAt: new Date().toISOString(),
      firedNeurons,
      errors: errors.length > 0 ? errors : undefined,
    };
    this.execution.stepHistory.push(stepRecord);
    this.execution.currentStep = stepNumber;

    this.broadcast({ type: 'step_completed', data: { step: stepNumber, firedCount: firedNeurons.length } });

    return { firedCount: firedNeurons.length, tokensUsed: totalTokensUsed, outputContent };
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcast(message: WSServerMessage) {
    const messageStr = JSON.stringify(message);
    for (const client of this.connectedClients) {
      try {
        client.send(messageStr);
      } catch {
        // Client disconnected
        this.connectedClients.delete(client);
      }
    }
  }

  /**
   * Persist execution state to KV
   */
  private async persistState() {
    if (!this.execution) return;

    const executionDAO = new ExecutionDAO(this.env.EXECUTIONS_KV);
    await executionDAO.update(this.execution);
  }
}
