// OpenRouter LLM API interactions

import type { Neuron, MemoryEntry, QueuedMessage } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface LLMResponse {
  output: string;
  selfUpdate: string;
  tokensUsed: number;
  durationMs: number;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenRouterDAO {
  constructor(private apiKey: string) {}

  /**
   * Build the prompt for a neuron firing
   */
  buildPrompt(
    neuron: Neuron,
    memory: MemoryEntry[],
    inputQueue: QueuedMessage[]
  ): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

    // System prompt
    let systemContent = neuron.systemPrompt;

    // Add memory section if there are entries
    const recentMemory = memory.slice(-neuron.memoryLength);
    if (recentMemory.length > 0) {
      systemContent += `\n\n=== MEMORY (last ${neuron.memoryLength} entries) ===\n`;
      for (const entry of recentMemory) {
        systemContent += `[Step ${entry.step}] ${entry.selfUpdate}\n`;
      }
    }

    // Add instructions
    systemContent += `\n\n=== INSTRUCTIONS ===
You are the "${neuron.name}" core of a larger neural network.

Based on your system prompt, memory, and the inputs above, generate TWO responses:

1. SELF-UPDATE: A brief note to yourself about what you learned or how your state changed. This will be added to your memory for future reference. Keep it concise - you only retain ${neuron.memoryLength} entries.

2. OUTPUT: Your response to pass to connected neurons. This should be your processed understanding, insight, or generated content based on the inputs.

Format your response EXACTLY as:
<self_update>
[your self-update here]
</self_update>

<output>
[your output here]
</output>

If you have nothing meaningful to output (inputs weren't relevant to your role), you may omit the output section entirely.`;

    messages.push({ role: 'system', content: systemContent });

    // Add inputs as user message
    if (inputQueue.length > 0) {
      let inputContent = '=== INPUTS ===\n';
      for (const msg of inputQueue) {
        if (msg.isUserInput) {
          inputContent += `User input:\n${msg.content}\n\n`;
        } else {
          inputContent += `The ${msg.sourceNeuronName} core generated:\n${msg.content}\n\n`;
        }
      }
      messages.push({ role: 'user', content: inputContent.trim() });
    }

    return messages;
  }

  /**
   * Parse the LLM response to extract self_update and output
   */
  parseResponse(content: string): { selfUpdate: string; output: string } {
    let selfUpdate = '';
    let output = '';

    // Extract self_update
    const selfUpdateMatch = content.match(/<self_update>([\s\S]*?)<\/self_update>/);
    if (selfUpdateMatch) {
      selfUpdate = selfUpdateMatch[1].trim();
    }

    // Extract output
    const outputMatch = content.match(/<output>([\s\S]*?)<\/output>/);
    if (outputMatch) {
      output = outputMatch[1].trim();
    }

    // If no structured output found, treat entire response as output
    if (!selfUpdate && !output) {
      output = content.trim();
    }

    return { selfUpdate, output };
  }

  /**
   * Fire a neuron - send prompt to OpenRouter and get response
   */
  async fireNeuron(
    neuron: Neuron,
    memory: MemoryEntry[],
    inputQueue: QueuedMessage[]
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    const messages = this.buildPrompt(neuron, memory, inputQueue);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://worms-bats-and-flies.workers.dev',
        'X-Title': 'WormsBatsAndFlies',
      },
      body: JSON.stringify({
        model: neuron.model,
        messages,
        temperature: neuron.temperature ?? 0.7,
        max_tokens: neuron.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens: number };
    };

    const durationMs = Date.now() - startTime;
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    const { selfUpdate, output } = this.parseResponse(content);

    return {
      output,
      selfUpdate,
      tokensUsed,
      durationMs,
    };
  }
}
