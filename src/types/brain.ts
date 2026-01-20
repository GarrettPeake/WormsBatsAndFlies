// Brain data models - the configuration layer

export type NeuronType = 'regular' | 'text_input' | 'picture_input' | 'text_output';

export interface NeuronPosition {
  x: number;
  y: number;
  z: number;
}

export interface Neuron {
  id: string;
  name: string;
  type: NeuronType;

  // LLM Configuration
  systemPrompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  memoryLength: number;

  // 3D Position (for graph editor)
  position: NeuronPosition;

  // Visual customization
  color?: string;
}

export interface Connection {
  id: string;
  sourceNeuronId: string;
  targetNeuronId: string;
}

export interface Brain {
  id: string;
  name: string;
  description?: string;

  neurons: Neuron[];
  connections: Connection[];

  // Special node references
  textInputNeuronId: string;
  pictureInputNeuronId?: string;
  textOutputNeuronId: string;

  // Metadata
  createdAt: string;
  updatedAt: string;

  // Default execution settings
  defaultStepDelayMs: number;
}

// Input types for creating/updating
export interface CreateBrainInput {
  name: string;
  description?: string;
  neurons: Omit<Neuron, 'id'>[];
  connections: Omit<Connection, 'id'>[];
  textInputNeuronId?: string;
  pictureInputNeuronId?: string;
  textOutputNeuronId?: string;
  defaultStepDelayMs?: number;
}

export interface UpdateBrainInput {
  name?: string;
  description?: string;
  neurons?: Neuron[];
  connections?: Connection[];
  textInputNeuronId?: string;
  pictureInputNeuronId?: string;
  textOutputNeuronId?: string;
  defaultStepDelayMs?: number;
}

export interface CreateNeuronInput {
  name: string;
  type: NeuronType;
  systemPrompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  memoryLength: number;
  position: NeuronPosition;
  color?: string;
}

export interface CreateConnectionInput {
  sourceNeuronId: string;
  targetNeuronId: string;
}
