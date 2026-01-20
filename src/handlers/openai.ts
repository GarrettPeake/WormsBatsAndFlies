// OpenAI-compatible endpoint handler

import { Hono } from 'hono';
import { BrainDAO } from '../dao/brain.dao';
import { ExecutionDAO } from '../dao/execution.dao';
import { generateId } from '../utils/id';
import type {
  Env,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from '../types';

const openai = new Hono<{ Bindings: Env }>();

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
openai.post('/chat/completions', async (c) => {
  try {
    const body = await c.req.json<ChatCompletionRequest>();

    // Validate request
    if (!body.model) {
      return c.json(
        { error: { message: 'model is required', type: 'invalid_request_error' } },
        400
      );
    }

    if (!body.messages || body.messages.length === 0) {
      return c.json(
        { error: { message: 'messages is required', type: 'invalid_request_error' } },
        400
      );
    }

    // Get brain config (model is brain ID)
    const brainDAO = new BrainDAO(c.env.BRAINS_KV);
    const brain = await brainDAO.getById(body.model);

    if (!brain) {
      return c.json(
        { error: { message: `Model '${body.model}' not found`, type: 'invalid_request_error' } },
        404
      );
    }

    // Extract user message (last user message in the conversation)
    const userMessages = body.messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (!lastUserMessage) {
      return c.json(
        { error: { message: 'At least one user message is required', type: 'invalid_request_error' } },
        400
      );
    }

    // Create execution
    const executionDAO = new ExecutionDAO(c.env.EXECUTIONS_KV);
    const neuronIds = brain.neurons.map(n => n.id);
    const execution = await executionDAO.create(brain.id, neuronIds);

    // Get Durable Object for this execution
    const execId = c.env.BRAIN_EXECUTION.idFromName(execution.id);
    const execStub = c.env.BRAIN_EXECUTION.get(execId);

    // Max steps from max_tokens (rough approximation)
    const maxSteps = body.max_tokens ? Math.ceil(body.max_tokens / 100) : 10;

    if (body.stream) {
      // Streaming response
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Start execution asynchronously
      (async () => {
        try {
          // Initialize and run execution
          const initResponse = await execStub.fetch(
            new Request('http://internal/init-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                execution,
                brain,
                initialInput: lastUserMessage.content,
                maxSteps,
                stream: true,
              }),
            })
          );

          if (!initResponse.ok) {
            const errorChunk: ChatCompletionChunk = {
              id: `chatcmpl-${generateId()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: body.model,
              choices: [{
                index: 0,
                delta: { content: 'Error: Failed to start execution' },
                finish_reason: null,
              }],
            };
            await writer.write(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            await writer.close();
            return;
          }

          // Read streaming response from DO
          const reader = initResponse.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                // Forward the chunk to client
                await writer.write(encoder.encode(`data: ${line}\n\n`));
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            await writer.write(encoder.encode(`data: ${buffer}\n\n`));
          }

          await writer.write(encoder.encode('data: [DONE]\n\n'));
          await writer.close();
        } catch (error) {
          console.error('Streaming error:', error);
          await writer.abort(error);
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      const initResponse = await execStub.fetch(
        new Request('http://internal/init-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            execution,
            brain,
            initialInput: lastUserMessage.content,
            maxSteps,
            stream: false,
          }),
        })
      );

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(`Failed to execute brain: ${errorText}`);
      }

      const result = await initResponse.json() as {
        output: string;
        tokensUsed: number;
        steps: number;
      };

      const response: ChatCompletionResponse = {
        id: `chatcmpl-${execution.id}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.output,
          },
          finish_reason: result.steps >= maxSteps ? 'length' : 'stop',
        }],
        usage: {
          prompt_tokens: 0, // Would need to track this in execution
          completion_tokens: result.tokensUsed,
          total_tokens: result.tokensUsed,
        },
      };

      return c.json(response);
    }
  } catch (error) {
    console.error('Chat completions error:', error);
    return c.json(
      { error: { message: 'Internal server error', type: 'internal_error' } },
      500
    );
  }
});

/**
 * GET /v1/models
 * List available models (brains)
 */
openai.get('/models', async (c) => {
  try {
    const brainDAO = new BrainDAO(c.env.BRAINS_KV);
    const brains = await brainDAO.list();

    const models = brains.map(brain => ({
      id: brain.id,
      object: 'model',
      created: Math.floor(new Date(brain.createdAt).getTime() / 1000),
      owned_by: 'worms-bats-and-flies',
      name: brain.name,
      description: brain.description,
    }));

    return c.json({
      object: 'list',
      data: models,
    });
  } catch (error) {
    console.error('List models error:', error);
    return c.json(
      { error: { message: 'Internal server error', type: 'internal_error' } },
      500
    );
  }
});

export default openai;
