// Execution control handlers

import { Hono } from 'hono';
import { BrainDAO } from '../dao/brain.dao';
import { ExecutionDAO } from '../dao/execution.dao';
import type { Env, ContextVariables, StartExecutionInput, SendInputInput } from '../types';

const executions = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * POST /api/brains/:id/execute
 * Start a new execution for a brain
 */
executions.post('/brains/:id/execute', async (c) => {
  try {
    const brainId = c.req.param('id');
    let body: Partial<StartExecutionInput> = {};
    try {
      body = await c.req.json<StartExecutionInput>();
    } catch (e) {
      // Body is optional, use empty object
    }

    // Get brain config
    const brainDAO = new BrainDAO(c.env.BRAINS_KV);
    const brain = await brainDAO.getById(brainId);

    if (!brain) {
      return c.json(
        { error: 'Not Found', message: 'Brain not found' },
        404
      );
    }

    // Create execution state
    const executionDAO = new ExecutionDAO(c.env.EXECUTIONS_KV);
    const neuronIds = brain.neurons.map(n => n.id);
    const execution = await executionDAO.create(brainId, neuronIds);

    // Get or create Durable Object for this execution
    const execId = c.env.BRAIN_EXECUTION.idFromName(execution.id);
    const execStub = c.env.BRAIN_EXECUTION.get(execId);

    // Initialize the execution in the Durable Object
    const initResponse = await execStub.fetch(
      new Request('http://internal/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          execution,
          brain,
          initialInput: body.initialInput,
          stepDelayMs: body.stepDelayMs ?? brain.defaultStepDelayMs,
        }),
      })
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      throw new Error(`Failed to initialize execution: ${errorText}`);
    }

    return c.json({ execution }, 201);
  } catch (error) {
    console.error('Start execution error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to start execution' },
      500
    );
  }
});

/**
 * GET /api/executions
 * List all executions (optionally filtered by brainId query param)
 */
executions.get('/executions', async (c) => {
  try {
    const brainId = c.req.query('brainId');

    const executionDAO = new ExecutionDAO(c.env.EXECUTIONS_KV);
    const allExecutions = await executionDAO.list(brainId);

    // Sort by startedAt descending (most recent first)
    allExecutions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return c.json({ executions: allExecutions });
  } catch (error) {
    console.error('List executions error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to list executions' },
      500
    );
  }
});

/**
 * GET /api/executions/:execId
 * Get execution state
 */
executions.get('/executions/:execId', async (c) => {
  try {
    const execId = c.req.param('execId');

    const executionDAO = new ExecutionDAO(c.env.EXECUTIONS_KV);
    const execution = await executionDAO.getById(execId);

    if (!execution) {
      return c.json(
        { error: 'Not Found', message: 'Execution not found' },
        404
      );
    }

    return c.json({ execution });
  } catch (error) {
    console.error('Get execution error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to get execution' },
      500
    );
  }
});

/**
 * POST /api/executions/:execId/pause
 * Pause an execution
 */
executions.post('/executions/:execId/pause', async (c) => {
  try {
    const execId = c.req.param('execId');

    // Get Durable Object for this execution
    const doId = c.env.BRAIN_EXECUTION.idFromName(execId);
    const execStub = c.env.BRAIN_EXECUTION.get(doId);

    const response = await execStub.fetch(
      new Request('http://internal/pause', { method: 'POST' })
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pause execution: ${errorText}`);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Pause execution error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to pause execution' },
      500
    );
  }
});

/**
 * POST /api/executions/:execId/resume
 * Resume a paused execution
 */
executions.post('/executions/:execId/resume', async (c) => {
  try {
    const execId = c.req.param('execId');

    // Get Durable Object for this execution
    const doId = c.env.BRAIN_EXECUTION.idFromName(execId);
    const execStub = c.env.BRAIN_EXECUTION.get(doId);

    const response = await execStub.fetch(
      new Request('http://internal/resume', { method: 'POST' })
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to resume execution: ${errorText}`);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Resume execution error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to resume execution' },
      500
    );
  }
});

/**
 * POST /api/executions/:execId/step
 * Execute a single step (when paused)
 */
executions.post('/executions/:execId/step', async (c) => {
  try {
    const execId = c.req.param('execId');

    // Get Durable Object for this execution
    const doId = c.env.BRAIN_EXECUTION.idFromName(execId);
    const execStub = c.env.BRAIN_EXECUTION.get(doId);

    const response = await execStub.fetch(
      new Request('http://internal/step', { method: 'POST' })
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to execute step: ${errorText}`);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Step execution error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to execute step' },
      500
    );
  }
});

/**
 * POST /api/executions/:execId/input
 * Send new input to a running brain
 */
executions.post('/executions/:execId/input', async (c) => {
  try {
    const execId = c.req.param('execId');
    const body = await c.req.json<SendInputInput>();

    if (!body.content) {
      return c.json(
        { error: 'Bad Request', message: 'Content is required' },
        400
      );
    }

    // Get Durable Object for this execution
    const doId = c.env.BRAIN_EXECUTION.idFromName(execId);
    const execStub = c.env.BRAIN_EXECUTION.get(doId);

    const response = await execStub.fetch(
      new Request('http://internal/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send input: ${errorText}`);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Send input error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to send input' },
      500
    );
  }
});

/**
 * WebSocket upgrade handler
 * GET /api/executions/:execId/stream
 */
executions.get('/executions/:execId/stream', async (c) => {
  try {
    const execId = c.req.param('execId');

    // Verify execution exists
    const executionDAO = new ExecutionDAO(c.env.EXECUTIONS_KV);
    const execution = await executionDAO.getById(execId);

    if (!execution) {
      return c.json(
        { error: 'Not Found', message: 'Execution not found' },
        404
      );
    }

    // Get Durable Object for this execution
    const doId = c.env.BRAIN_EXECUTION.idFromName(execId);
    const execStub = c.env.BRAIN_EXECUTION.get(doId);

    // Create a new request with the simplified path but keep all headers
    // This is necessary for WebSocket upgrade to work properly
    const wsRequest = new Request('http://internal/stream', {
      method: c.req.method,
      headers: c.req.raw.headers,
    });

    // Forward the WebSocket upgrade to the Durable Object
    return execStub.fetch(wsRequest);
  } catch (error) {
    console.error('WebSocket stream error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to establish stream' },
      500
    );
  }
});

export default executions;
