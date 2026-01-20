import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrainDAO } from '../../../src/dao/brain.dao';
import type { CreateBrainInput } from '../../../src/types';

// Mock KV namespace
function createMockKV() {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  } as unknown as KVNamespace;
}

describe('BrainDAO', () => {
  let kv: ReturnType<typeof createMockKV>;
  let dao: BrainDAO;

  beforeEach(() => {
    kv = createMockKV();
    dao = new BrainDAO(kv);
  });

  describe('create', () => {
    it('should create a brain with generated IDs', async () => {
      const input: CreateBrainInput = {
        name: 'Test Brain',
        description: 'A test brain',
        neurons: [
          {
            name: 'Input',
            type: 'text_input',
            systemPrompt: 'You are an input neuron',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
          {
            name: 'Output',
            type: 'text_output',
            systemPrompt: 'You are an output neuron',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 1, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const brain = await dao.create(input);

      expect(brain.id).toBeDefined();
      expect(brain.name).toBe('Test Brain');
      expect(brain.neurons.length).toBe(2);
      expect(brain.neurons[0].id).toBeDefined();
      expect(brain.neurons[1].id).toBeDefined();
      expect(brain.textInputNeuronId).toBe(brain.neurons[0].id);
      expect(brain.textOutputNeuronId).toBe(brain.neurons[1].id);
    });
  });

  describe('getById', () => {
    it('should return null for non-existent brain', async () => {
      const brain = await dao.getById('non-existent-id');
      expect(brain).toBeNull();
    });

    it('should return brain by ID', async () => {
      const input: CreateBrainInput = {
        name: 'Test Brain',
        neurons: [
          {
            name: 'Neuron',
            type: 'regular',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const created = await dao.create(input);
      const retrieved = await dao.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Brain');
    });
  });

  describe('list', () => {
    it('should return empty array when no brains exist', async () => {
      const brains = await dao.list();
      expect(brains).toEqual([]);
    });

    it('should return all brains', async () => {
      const input1: CreateBrainInput = {
        name: 'Brain 1',
        neurons: [
          {
            name: 'Neuron',
            type: 'regular',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const input2: CreateBrainInput = {
        name: 'Brain 2',
        neurons: [
          {
            name: 'Neuron',
            type: 'regular',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      await dao.create(input1);
      await dao.create(input2);

      const brains = await dao.list();
      expect(brains.length).toBe(2);
    });
  });

  describe('update', () => {
    it('should update brain properties', async () => {
      const input: CreateBrainInput = {
        name: 'Original Name',
        neurons: [
          {
            name: 'Neuron',
            type: 'regular',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const created = await dao.create(input);
      const updated = await dao.update(created.id, { name: 'Updated Name' });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.id).toBe(created.id);
    });

    it('should return null for non-existent brain', async () => {
      const result = await dao.update('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a brain', async () => {
      const input: CreateBrainInput = {
        name: 'Test Brain',
        neurons: [
          {
            name: 'Neuron',
            type: 'regular',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const created = await dao.create(input);
      const deleted = await dao.delete(created.id);

      expect(deleted).toBe(true);

      const retrieved = await dao.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent brain', async () => {
      const result = await dao.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('addNeuron', () => {
    it('should add a neuron to a brain', async () => {
      const input: CreateBrainInput = {
        name: 'Test Brain',
        neurons: [
          {
            name: 'Initial Neuron',
            type: 'regular',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const brain = await dao.create(input);
      const neuron = await dao.addNeuron(brain.id, {
        name: 'New Neuron',
        type: 'regular',
        systemPrompt: 'New test',
        model: 'gpt-4',
        memoryLength: 5,
        position: { x: 1, y: 0, z: 0 },
      });

      expect(neuron).toBeDefined();
      expect(neuron?.id).toBeDefined();
      expect(neuron?.name).toBe('New Neuron');

      const updated = await dao.getById(brain.id);
      expect(updated?.neurons.length).toBe(2);
    });
  });

  describe('addConnection', () => {
    it('should add a connection between neurons', async () => {
      const input: CreateBrainInput = {
        name: 'Test Brain',
        neurons: [
          {
            name: 'Neuron 1',
            type: 'text_input',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
          },
          {
            name: 'Neuron 2',
            type: 'text_output',
            systemPrompt: 'Test',
            model: 'gpt-4',
            memoryLength: 5,
            position: { x: 1, y: 0, z: 0 },
          },
        ],
        connections: [],
      };

      const brain = await dao.create(input);
      const connection = await dao.addConnection(brain.id, {
        sourceNeuronId: brain.neurons[0].id,
        targetNeuronId: brain.neurons[1].id,
      });

      expect(connection).toBeDefined();
      expect(connection?.id).toBeDefined();

      const updated = await dao.getById(brain.id);
      expect(updated?.connections.length).toBe(1);
    });
  });
});
