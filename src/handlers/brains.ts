// Brain management handlers

import { Hono } from 'hono';
import { BrainDAO } from '../dao/brain.dao';
import type { Env, CreateBrainInput, UpdateBrainInput } from '../types';

const brains = new Hono<{ Bindings: Env }>();

/**
 * GET /api/brains
 * List all brains
 */
brains.get('/', async (c) => {
  try {
    const dao = new BrainDAO(c.env.BRAINS_KV);
    const brainList = await dao.list();
    return c.json({ brains: brainList });
  } catch (error) {
    console.error('List brains error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to list brains' },
      500
    );
  }
});

/**
 * POST /api/brains
 * Create a new brain
 */
brains.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateBrainInput>();

    if (!body.name) {
      return c.json(
        { error: 'Bad Request', message: 'Brain name is required' },
        400
      );
    }

    if (!body.neurons || body.neurons.length === 0) {
      return c.json(
        { error: 'Bad Request', message: 'At least one neuron is required' },
        400
      );
    }

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const brain = await dao.create(body);

    return c.json({ brain }, 201);
  } catch (error) {
    console.error('Create brain error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to create brain' },
      500
    );
  }
});

/**
 * GET /api/brains/:id
 * Get a brain by ID
 */
brains.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const dao = new BrainDAO(c.env.BRAINS_KV);
    const brain = await dao.getById(id);

    if (!brain) {
      return c.json(
        { error: 'Not Found', message: 'Brain not found' },
        404
      );
    }

    return c.json({ brain });
  } catch (error) {
    console.error('Get brain error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to get brain' },
      500
    );
  }
});

/**
 * PUT /api/brains/:id
 * Update a brain
 */
brains.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateBrainInput>();

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const brain = await dao.update(id, body);

    if (!brain) {
      return c.json(
        { error: 'Not Found', message: 'Brain not found' },
        404
      );
    }

    return c.json({ brain });
  } catch (error) {
    console.error('Update brain error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to update brain' },
      500
    );
  }
});

/**
 * DELETE /api/brains/:id
 * Delete a brain
 */
brains.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const dao = new BrainDAO(c.env.BRAINS_KV);
    const deleted = await dao.delete(id);

    if (!deleted) {
      return c.json(
        { error: 'Not Found', message: 'Brain not found' },
        404
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete brain error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to delete brain' },
      500
    );
  }
});

/**
 * POST /api/brains/:id/neurons
 * Add a neuron to a brain
 */
brains.post('/:id/neurons', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const neuron = await dao.addNeuron(id, body);

    if (!neuron) {
      return c.json(
        { error: 'Not Found', message: 'Brain not found' },
        404
      );
    }

    return c.json({ neuron }, 201);
  } catch (error) {
    console.error('Add neuron error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to add neuron' },
      500
    );
  }
});

/**
 * PUT /api/brains/:id/neurons/:neuronId
 * Update a neuron in a brain
 */
brains.put('/:id/neurons/:neuronId', async (c) => {
  try {
    const id = c.req.param('id');
    const neuronId = c.req.param('neuronId');
    const body = await c.req.json();

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const neuron = await dao.updateNeuron(id, neuronId, body);

    if (!neuron) {
      return c.json(
        { error: 'Not Found', message: 'Brain or neuron not found' },
        404
      );
    }

    return c.json({ neuron });
  } catch (error) {
    console.error('Update neuron error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to update neuron' },
      500
    );
  }
});

/**
 * DELETE /api/brains/:id/neurons/:neuronId
 * Delete a neuron from a brain
 */
brains.delete('/:id/neurons/:neuronId', async (c) => {
  try {
    const id = c.req.param('id');
    const neuronId = c.req.param('neuronId');

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const deleted = await dao.deleteNeuron(id, neuronId);

    if (!deleted) {
      return c.json(
        { error: 'Not Found', message: 'Brain or neuron not found' },
        404
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete neuron error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to delete neuron' },
      500
    );
  }
});

/**
 * POST /api/brains/:id/connections
 * Add a connection to a brain
 */
brains.post('/:id/connections', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (!body.sourceNeuronId || !body.targetNeuronId) {
      return c.json(
        { error: 'Bad Request', message: 'sourceNeuronId and targetNeuronId are required' },
        400
      );
    }

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const connection = await dao.addConnection(id, body);

    if (!connection) {
      return c.json(
        { error: 'Not Found', message: 'Brain or neurons not found' },
        404
      );
    }

    return c.json({ connection }, 201);
  } catch (error) {
    console.error('Add connection error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to add connection' },
      500
    );
  }
});

/**
 * DELETE /api/brains/:id/connections/:connectionId
 * Delete a connection from a brain
 */
brains.delete('/:id/connections/:connectionId', async (c) => {
  try {
    const id = c.req.param('id');
    const connectionId = c.req.param('connectionId');

    const dao = new BrainDAO(c.env.BRAINS_KV);
    const deleted = await dao.deleteConnection(id, connectionId);

    if (!deleted) {
      return c.json(
        { error: 'Not Found', message: 'Brain or connection not found' },
        404
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Failed to delete connection' },
      500
    );
  }
});

export default brains;
