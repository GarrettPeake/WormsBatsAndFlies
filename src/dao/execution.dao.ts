// Execution state persistence with KV storage

import type { BrainExecution, NeuronState, Brain } from '../types';
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
   * Create a new execution with a snapshot of the brain configuration
   * @param brain The brain configuration to snapshot (will be stored immutably with the execution)
   */
  async create(brain: Brain): Promise<BrainExecution> {
    const id = generateId();
    const now = new Date().toISOString();

    // Create a deep copy of the brain to ensure immutability
    const brainSnapshot: Brain = JSON.parse(JSON.stringify(brain));

    // Initialize neuron states from the snapshot
    const neuronStates: Record<string, NeuronState> = {};
    for (const neuron of brainSnapshot.neurons) {
      neuronStates[neuron.id] = {
        neuronId: neuron.id,
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
      brainId: brain.id,
      status: 'initializing',
      currentStep: 0,
      neuronStates,
      stepHistory: [],
      startedAt: now,
      brainSnapshot,
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
}
