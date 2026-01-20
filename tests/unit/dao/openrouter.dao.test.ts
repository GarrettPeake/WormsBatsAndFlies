import { describe, it, expect } from 'vitest';
import { OpenRouterDAO } from '../../../src/dao/openrouter.dao';
import type { Neuron, MemoryEntry, QueuedMessage } from '../../../src/types';

describe('OpenRouterDAO', () => {
  const dao = new OpenRouterDAO('test-api-key');

  describe('buildPrompt', () => {
    it('should build a prompt with system prompt and instructions', () => {
      const neuron: Neuron = {
        id: 'test-id',
        name: 'TestNeuron',
        type: 'regular',
        systemPrompt: 'You are a helpful assistant.',
        model: 'gpt-4',
        memoryLength: 5,
        position: { x: 0, y: 0, z: 0 },
      };

      const messages = dao.buildPrompt(neuron, [], []);

      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('You are a helpful assistant.');
      expect(messages[0].content).toContain('INSTRUCTIONS');
      expect(messages[0].content).toContain('TestNeuron');
    });

    it('should include memory entries', () => {
      const neuron: Neuron = {
        id: 'test-id',
        name: 'TestNeuron',
        type: 'regular',
        systemPrompt: 'Test prompt',
        model: 'gpt-4',
        memoryLength: 5,
        position: { x: 0, y: 0, z: 0 },
      };

      const memory: MemoryEntry[] = [
        { step: 1, selfUpdate: 'Learned something', timestamp: '2024-01-01T00:00:00Z' },
        { step: 2, selfUpdate: 'Learned more', timestamp: '2024-01-01T00:01:00Z' },
      ];

      const messages = dao.buildPrompt(neuron, memory, []);

      expect(messages[0].content).toContain('MEMORY');
      expect(messages[0].content).toContain('[Step 1] Learned something');
      expect(messages[0].content).toContain('[Step 2] Learned more');
    });

    it('should respect memoryLength limit', () => {
      const neuron: Neuron = {
        id: 'test-id',
        name: 'TestNeuron',
        type: 'regular',
        systemPrompt: 'Test prompt',
        model: 'gpt-4',
        memoryLength: 2, // Only include last 2
        position: { x: 0, y: 0, z: 0 },
      };

      const memory: MemoryEntry[] = [
        { step: 1, selfUpdate: 'Entry 1', timestamp: '2024-01-01T00:00:00Z' },
        { step: 2, selfUpdate: 'Entry 2', timestamp: '2024-01-01T00:01:00Z' },
        { step: 3, selfUpdate: 'Entry 3', timestamp: '2024-01-01T00:02:00Z' },
      ];

      const messages = dao.buildPrompt(neuron, memory, []);

      // Should only include last 2 entries
      expect(messages[0].content).not.toContain('Entry 1');
      expect(messages[0].content).toContain('Entry 2');
      expect(messages[0].content).toContain('Entry 3');
    });

    it('should include input queue as user message', () => {
      const neuron: Neuron = {
        id: 'test-id',
        name: 'TestNeuron',
        type: 'regular',
        systemPrompt: 'Test prompt',
        model: 'gpt-4',
        memoryLength: 5,
        position: { x: 0, y: 0, z: 0 },
      };

      const inputQueue: QueuedMessage[] = [
        {
          sourceNeuronId: 'other-id',
          sourceNeuronName: 'OtherNeuron',
          content: 'Hello from other neuron',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const messages = dao.buildPrompt(neuron, [], inputQueue);

      expect(messages.length).toBe(2);
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('INPUTS');
      expect(messages[1].content).toContain('OtherNeuron');
      expect(messages[1].content).toContain('Hello from other neuron');
    });

    it('should mark user input specially', () => {
      const neuron: Neuron = {
        id: 'test-id',
        name: 'TestNeuron',
        type: 'text_input',
        systemPrompt: 'Test prompt',
        model: 'gpt-4',
        memoryLength: 5,
        position: { x: 0, y: 0, z: 0 },
      };

      const inputQueue: QueuedMessage[] = [
        {
          sourceNeuronId: 'user',
          sourceNeuronName: 'User',
          content: 'User input text',
          timestamp: '2024-01-01T00:00:00Z',
          isUserInput: true,
        },
      ];

      const messages = dao.buildPrompt(neuron, [], inputQueue);

      expect(messages[1].content).toContain('User input:');
      expect(messages[1].content).toContain('User input text');
    });
  });

  describe('parseResponse', () => {
    it('should parse structured response', () => {
      const content = `
<self_update>
I learned that the user is interested in AI.
</self_update>

<output>
Here is my response about AI.
</output>
      `;

      const result = dao.parseResponse(content);

      expect(result.selfUpdate).toBe('I learned that the user is interested in AI.');
      expect(result.output).toBe('Here is my response about AI.');
    });

    it('should handle missing self_update', () => {
      const content = `
<output>
Just the output
</output>
      `;

      const result = dao.parseResponse(content);

      expect(result.selfUpdate).toBe('');
      expect(result.output).toBe('Just the output');
    });

    it('should handle missing output', () => {
      const content = `
<self_update>
Just self update
</self_update>
      `;

      const result = dao.parseResponse(content);

      expect(result.selfUpdate).toBe('Just self update');
      expect(result.output).toBe('');
    });

    it('should treat unstructured response as output', () => {
      const content = 'This is just plain text without tags.';

      const result = dao.parseResponse(content);

      expect(result.selfUpdate).toBe('');
      expect(result.output).toBe('This is just plain text without tags.');
    });
  });
});
