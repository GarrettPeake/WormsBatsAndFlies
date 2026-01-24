// Execution runtime models

import type { Brain } from './brain';

export type ExecutionStatus = 'initializing' | 'running' | 'paused' | 'completed';

export type NeuronStatus = 'idle' | 'queued' | 'processing' | 'fired' | 'error';

export interface MemoryEntry {
  step: number;
  selfUpdate: string;
  timestamp: string;
}

export interface QueuedMessage {
  sourceNeuronId: string;
  sourceNeuronName: string;
  content: string;
  timestamp: string;
  isUserInput?: boolean;
}

export interface NeuronState {
  neuronId: string;
  status: NeuronStatus;
  memory: MemoryEntry[];
  inputQueue: QueuedMessage[];
  lastOutput?: string;
  lastSelfUpdate?: string;
  totalFireCount: number;
  totalTokensUsed: number;
  averageResponseTimeMs: number;
}

export interface StepRecord {
  stepNumber: number;
  startedAt: string;
  completedAt: string;
  firedNeurons: {
    neuronId: string;
    neuronName: string;
    inputCount: number;
    outputEmitted: boolean;
    tokensUsed: number;
    durationMs: number;
  }[];
  errors?: {
    neuronId: string;
    error: string;
  }[];
}

export interface BrainExecution {
  id: string;
  brainId: string;
  status: ExecutionStatus;
  currentStep: number;
  neuronStates: Record<string, NeuronState>;
  stepHistory: StepRecord[];
  startedAt: string;
  pausedAt?: string;
  /**
   * Immutable snapshot of the brain configuration at execution start time.
   * This ensures the execution uses a consistent brain configuration even if
   * the original brain is modified during execution.
   */
  brainSnapshot: Brain;
}

// WebSocket message types
export type WSServerMessage =
  | { type: 'execution_started'; data: { execId: string; step: number } }
  | { type: 'step_started'; data: { step: number } }
  | { type: 'neuron_processing'; data: { neuronId: string; step: number } }
  | {
      type: 'neuron_output';
      data: {
        neuronId: string;
        output: string;
        selfUpdate: string;
        step: number;
      };
    }
  | { type: 'neuron_error'; data: { neuronId: string; error: string } }
  | { type: 'step_completed'; data: { step: number; firedCount: number } }
  | { type: 'execution_paused'; data: { step: number } }
  | { type: 'execution_resumed'; data: { step: number } }
  | { type: 'execution_fizzled'; data: { totalSteps: number } }
  | { type: 'final_output'; data: { content: string } };

export type WSClientMessage =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'step' }
  | { type: 'input'; data: { content: string; type: 'text' | 'image' } };

// Input types
export interface StartExecutionInput {
  brainId: string;
  initialInput?: string;
  stepDelayMs?: number;
}

export interface SendInputInput {
  content: string;
  type: 'text' | 'image';
}
