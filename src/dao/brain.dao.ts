// Brain CRUD operations with KV storage

import type {
  Brain,
  CreateBrainInput,
  UpdateBrainInput,
  Neuron,
  Connection,
} from '../types';
import { generateId } from '../utils/id';

const BRAIN_PREFIX = 'brain:';
const BRAIN_LIST_KEY = 'brain:list';

export class BrainDAO {
  constructor(private kv: KVNamespace) {}

  /**
   * List all brains
   */
  async list(): Promise<Brain[]> {
    const listData = await this.kv.get(BRAIN_LIST_KEY);
    if (!listData) {
      return [];
    }

    const ids: string[] = JSON.parse(listData);
    const brains = await Promise.all(
      ids.map(id => this.getById(id))
    );

    return brains.filter((b): b is Brain => b !== null);
  }

  /**
   * Get a brain by ID
   */
  async getById(id: string): Promise<Brain | null> {
    const data = await this.kv.get(`${BRAIN_PREFIX}${id}`);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as Brain;
  }

  /**
   * Create a new brain
   */
  async create(input: CreateBrainInput): Promise<Brain> {
    const id = generateId();
    const now = new Date().toISOString();

    // Assign IDs to neurons
    const neurons: Neuron[] = input.neurons.map((n, index) => ({
      ...n,
      id: generateId(),
    }));

    // Create a map of temporary indices to actual IDs
    const neuronIdMap = new Map<number, string>();
    neurons.forEach((n, index) => {
      neuronIdMap.set(index, n.id);
    });

    // Assign IDs to connections
    const connections: Connection[] = input.connections.map(c => ({
      ...c,
      id: generateId(),
    }));

    // Find special neurons by type
    const textInputNeuron = neurons.find(n => n.type === 'text_input');
    const pictureInputNeuron = neurons.find(n => n.type === 'picture_input');
    const textOutputNeuron = neurons.find(n => n.type === 'text_output');

    const brain: Brain = {
      id,
      name: input.name,
      description: input.description,
      neurons,
      connections,
      textInputNeuronId: input.textInputNeuronId || textInputNeuron?.id || neurons[0]?.id || '',
      pictureInputNeuronId: input.pictureInputNeuronId || pictureInputNeuron?.id,
      textOutputNeuronId: input.textOutputNeuronId || textOutputNeuron?.id || neurons[neurons.length - 1]?.id || '',
      createdAt: now,
      updatedAt: now,
      defaultStepDelayMs: input.defaultStepDelayMs ?? 1000,
    };

    // Save brain
    await this.kv.put(`${BRAIN_PREFIX}${id}`, JSON.stringify(brain));

    // Update list
    const listData = await this.kv.get(BRAIN_LIST_KEY);
    const ids: string[] = listData ? JSON.parse(listData) : [];
    ids.push(id);
    await this.kv.put(BRAIN_LIST_KEY, JSON.stringify(ids));

    return brain;
  }

  /**
   * Update a brain
   */
  async update(id: string, input: UpdateBrainInput): Promise<Brain | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated: Brain = {
      ...existing,
      ...input,
      id, // Ensure ID doesn't change
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
    };

    await this.kv.put(`${BRAIN_PREFIX}${id}`, JSON.stringify(updated));
    return updated;
  }

  /**
   * Delete a brain
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    // Delete brain
    await this.kv.delete(`${BRAIN_PREFIX}${id}`);

    // Update list
    const listData = await this.kv.get(BRAIN_LIST_KEY);
    if (listData) {
      const ids: string[] = JSON.parse(listData);
      const filtered = ids.filter(existingId => existingId !== id);
      await this.kv.put(BRAIN_LIST_KEY, JSON.stringify(filtered));
    }

    return true;
  }

  /**
   * Add a neuron to a brain
   */
  async addNeuron(brainId: string, neuron: Omit<Neuron, 'id'>): Promise<Neuron | null> {
    const brain = await this.getById(brainId);
    if (!brain) {
      return null;
    }

    const newNeuron: Neuron = {
      ...neuron,
      id: generateId(),
    };

    brain.neurons.push(newNeuron);
    brain.updatedAt = new Date().toISOString();

    await this.kv.put(`${BRAIN_PREFIX}${brainId}`, JSON.stringify(brain));
    return newNeuron;
  }

  /**
   * Update a neuron in a brain
   */
  async updateNeuron(brainId: string, neuronId: string, updates: Partial<Neuron>): Promise<Neuron | null> {
    const brain = await this.getById(brainId);
    if (!brain) {
      return null;
    }

    const neuronIndex = brain.neurons.findIndex(n => n.id === neuronId);
    if (neuronIndex === -1) {
      return null;
    }

    brain.neurons[neuronIndex] = {
      ...brain.neurons[neuronIndex],
      ...updates,
      id: neuronId, // Ensure ID doesn't change
    };
    brain.updatedAt = new Date().toISOString();

    await this.kv.put(`${BRAIN_PREFIX}${brainId}`, JSON.stringify(brain));
    return brain.neurons[neuronIndex];
  }

  /**
   * Delete a neuron from a brain
   */
  async deleteNeuron(brainId: string, neuronId: string): Promise<boolean> {
    const brain = await this.getById(brainId);
    if (!brain) {
      return false;
    }

    const neuronIndex = brain.neurons.findIndex(n => n.id === neuronId);
    if (neuronIndex === -1) {
      return false;
    }

    // Remove neuron
    brain.neurons.splice(neuronIndex, 1);

    // Remove connections involving this neuron
    brain.connections = brain.connections.filter(
      c => c.sourceNeuronId !== neuronId && c.targetNeuronId !== neuronId
    );

    // Update special neuron references if needed
    if (brain.textInputNeuronId === neuronId) {
      const newTextInput = brain.neurons.find(n => n.type === 'text_input');
      brain.textInputNeuronId = newTextInput?.id || '';
    }
    if (brain.textOutputNeuronId === neuronId) {
      const newTextOutput = brain.neurons.find(n => n.type === 'text_output');
      brain.textOutputNeuronId = newTextOutput?.id || '';
    }
    if (brain.pictureInputNeuronId === neuronId) {
      const newPictureInput = brain.neurons.find(n => n.type === 'picture_input');
      brain.pictureInputNeuronId = newPictureInput?.id;
    }

    brain.updatedAt = new Date().toISOString();
    await this.kv.put(`${BRAIN_PREFIX}${brainId}`, JSON.stringify(brain));
    return true;
  }

  /**
   * Add a connection to a brain
   */
  async addConnection(brainId: string, connection: Omit<Connection, 'id'>): Promise<Connection | null> {
    const brain = await this.getById(brainId);
    if (!brain) {
      return null;
    }

    // Verify both neurons exist
    const sourceExists = brain.neurons.some(n => n.id === connection.sourceNeuronId);
    const targetExists = brain.neurons.some(n => n.id === connection.targetNeuronId);
    if (!sourceExists || !targetExists) {
      return null;
    }

    // Check for duplicate connection
    const existingConnection = brain.connections.find(
      c => c.sourceNeuronId === connection.sourceNeuronId &&
           c.targetNeuronId === connection.targetNeuronId
    );
    if (existingConnection) {
      return existingConnection;
    }

    const newConnection: Connection = {
      ...connection,
      id: generateId(),
    };

    brain.connections.push(newConnection);
    brain.updatedAt = new Date().toISOString();

    await this.kv.put(`${BRAIN_PREFIX}${brainId}`, JSON.stringify(brain));
    return newConnection;
  }

  /**
   * Delete a connection from a brain
   */
  async deleteConnection(brainId: string, connectionId: string): Promise<boolean> {
    const brain = await this.getById(brainId);
    if (!brain) {
      return false;
    }

    const connectionIndex = brain.connections.findIndex(c => c.id === connectionId);
    if (connectionIndex === -1) {
      return false;
    }

    brain.connections.splice(connectionIndex, 1);
    brain.updatedAt = new Date().toISOString();

    await this.kv.put(`${BRAIN_PREFIX}${brainId}`, JSON.stringify(brain));
    return true;
  }
}
