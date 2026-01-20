// Execution state persistence with KV storage

import type { BrainExecution, NeuronState } from '../types';
import { generateId } from '../utils/id';

const EXECUTION_PREFIX = 'execution:';
const EXECUTION_LIST_KEY = 'execution:list';

export class ExecutionDAO {
  constructor(private kv: KVNamespace) {}

  /**
   * List all executions (optionally filtered by brain ID)
   */
  async list(brainId?: string): Promise<BrainExecution[]> {
    const listData = await this.kv.get(EXECUTION_LIST_KEY);
    if (!listData) {
      return [];
    }

    const ids: string[] = JSON.parse(listData);
    const executions = await Promise.all(
      ids.map(id => this.getById(id))
    );

    let result = executions.filter((e): e is BrainExecution => e !== null);

    if (brainId) {
      result = result.filter(e => e.brainId === brainId);
    }

    return result;
  }

  /**
   * Get an execution by ID
   */
  async getById(id: string): Promise<BrainExecution | null> {
    const data = await this.kv.get(`${EXECUTION_PREFIX}${id}`);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as BrainExecution;
  }

  /**
   * Create a new execution
   */
  async create(brainId: string, neuronIds: string[]): Promise<BrainExecution> {
    const id = generateId();
    const now = new Date().toISOString();

    // Initialize neuron states
    const neuronStates: Record<string, NeuronState> = {};
    for (const neuronId of neuronIds) {
      neuronStates[neuronId] = {
        neuronId,
        status: 'idle',
        memory: [],
        inputQueue: [],
        totalFireCount: 0,
        totalTokensUsed: 0,
        averageResponseTimeMs: 0,
      };
    }

    const execution: BrainExecution = {
      id,
      brainId,
      status: 'initializing',
      currentStep: 0,
      neuronStates,
      stepHistory: [],
      startedAt: now,
    };

    // Save execution
    await this.kv.put(`${EXECUTION_PREFIX}${id}`, JSON.stringify(execution));

    // Update list
    const listData = await this.kv.get(EXECUTION_LIST_KEY);
    const ids: string[] = listData ? JSON.parse(listData) : [];
    ids.push(id);
    await this.kv.put(EXECUTION_LIST_KEY, JSON.stringify(ids));

    return execution;
  }

  /**
   * Update an execution
   */
  async update(execution: BrainExecution): Promise<BrainExecution> {
    await this.kv.put(
      `${EXECUTION_PREFIX}${execution.id}`,
      JSON.stringify(execution)
    );
    return execution;
  }

  /**
   * Delete an execution
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    // Delete execution
    await this.kv.delete(`${EXECUTION_PREFIX}${id}`);

    // Update list
    const listData = await this.kv.get(EXECUTION_LIST_KEY);
    if (listData) {
      const ids: string[] = JSON.parse(listData);
      const filtered = ids.filter(existingId => existingId !== id);
      await this.kv.put(EXECUTION_LIST_KEY, JSON.stringify(filtered));
    }

    return true;
  }

  /**
   * Update execution status
   */
  async updateStatus(
    id: string,
    status: BrainExecution['status']
  ): Promise<BrainExecution | null> {
    const execution = await this.getById(id);
    if (!execution) {
      return null;
    }

    execution.status = status;
    if (status === 'paused') {
      execution.pausedAt = new Date().toISOString();
    } else if (status === 'running') {
      delete execution.pausedAt;
    }

    await this.update(execution);
    return execution;
  }

  /**
   * Get the most recent execution for a brain
   */
  async getLatestForBrain(brainId: string): Promise<BrainExecution | null> {
    const executions = await this.list(brainId);
    if (executions.length === 0) {
      return null;
    }

    // Sort by startedAt descending
    executions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return executions[0];
  }
}
