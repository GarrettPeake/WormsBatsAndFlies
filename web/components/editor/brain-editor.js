// Brain editor container component

import { api } from '../../lib/api-client.js';
import { appState, setCurrentBrain, setSelectedNeuron } from '../../lib/state.js';
import { router } from '../../lib/router.js';

class BrainEditor extends HTMLElement {
  static get observedAttributes() {
    return ['brain-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.brain = null;
  }

  connectedCallback() {
    this.render();
    this.loadBrain();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'brain-id' && oldValue !== newValue) {
      this.loadBrain();
    }
  }

  async loadBrain() {
    const brainId = this.getAttribute('brain-id');
    if (!brainId) return;

    try {
      this.brain = await api.getBrain(brainId);
      setCurrentBrain(this.brain);
      this.updateEditor();
    } catch (error) {
      console.error('Failed to load brain:', error);
    }
  }

  updateEditor() {
    if (!this.brain) return;

    // Update header
    const header = this.shadowRoot.querySelector('.editor-header h2');
    if (header) {
      header.textContent = this.brain.name;
    }

    // Update canvas
    const canvas = this.shadowRoot.querySelector('webgl-canvas');
    if (canvas) {
      canvas.setBrain(this.brain);
    }

    // Update panel
    const panel = this.shadowRoot.querySelector('neuron-panel');
    if (panel) {
      panel.setBrain(this.brain);
    }
  }

  async addNeuron() {
    if (!this.brain) return;

    try {
      const neuron = await api.addNeuron(this.brain.id, {
        name: `Neuron ${this.brain.neurons.length + 1}`,
        type: 'regular',
        systemPrompt: 'You process information and generate insights.',
        model: 'openai/gpt-4o-mini',
        memoryLength: 5,
        position: {
          x: Math.random() * 4 - 2,
          y: Math.random() * 4 - 2,
          z: Math.random() * 4 - 2,
        },
        color: this.getRandomColor(),
      });

      this.brain.neurons.push(neuron);
      this.updateEditor();
      setSelectedNeuron(neuron.id);
    } catch (error) {
      console.error('Failed to add neuron:', error);
    }
  }

  getRandomColor() {
    const colors = [
      '#f43f5e', '#ec4899', '#a855f7', '#6366f1',
      '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async saveBrain() {
    if (!this.brain) return;

    try {
      await api.updateBrain(this.brain.id, {
        name: this.brain.name,
        description: this.brain.description,
        neurons: this.brain.neurons,
        connections: this.brain.connections,
        textInputNeuronId: this.brain.textInputNeuronId,
        textOutputNeuronId: this.brain.textOutputNeuronId,
        pictureInputNeuronId: this.brain.pictureInputNeuronId,
        defaultStepDelayMs: this.brain.defaultStepDelayMs,
      });

      window.dispatchEvent(new CustomEvent('brains:refresh'));
    } catch (error) {
      console.error('Failed to save brain:', error);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
        }

        .editor-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .editor-header h2 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .editor-header__actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .editor-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .editor-canvas {
          flex: 1;
          position: relative;
        }

        .editor-panel {
          width: var(--panel-width);
          border-left: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
        }

        .toolbar {
          position: absolute;
          bottom: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
        }
      </style>

      <div class="editor-container">
        <header class="editor-header">
          <h2>Loading...</h2>
          <div class="editor-header__actions">
            <button class="btn btn--secondary" id="chat-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </button>
            <button class="btn btn--secondary" id="live-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run
            </button>
            <button class="btn btn--primary" id="save-btn">Save</button>
          </div>
        </header>
        <div class="editor-content">
          <div class="editor-canvas">
            <webgl-canvas></webgl-canvas>
            <div class="toolbar">
              <button class="btn btn--secondary" id="add-neuron-btn">+ Add Neuron</button>
              <span class="toolbar__divider"></span>
              <button class="btn btn--ghost btn--icon" id="reset-camera-btn" title="Reset Camera">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            </div>
          </div>
          <aside class="editor-panel">
            <neuron-panel></neuron-panel>
          </aside>
        </div>
      </div>
    `;

    // Event listeners
    this.shadowRoot.getElementById('add-neuron-btn').addEventListener('click', () => this.addNeuron());
    this.shadowRoot.getElementById('save-btn').addEventListener('click', () => this.saveBrain());

    this.shadowRoot.getElementById('chat-btn').addEventListener('click', () => {
      if (this.brain) {
        router.navigate(`/brains/${this.brain.id}/chat`);
      }
    });

    this.shadowRoot.getElementById('live-btn').addEventListener('click', () => {
      if (this.brain) {
        router.navigate(`/brains/${this.brain.id}/live`);
      }
    });

    this.shadowRoot.getElementById('reset-camera-btn').addEventListener('click', () => {
      const canvas = this.shadowRoot.querySelector('webgl-canvas');
      if (canvas) {
        canvas.resetCamera();
      }
    });
  }
}

customElements.define('brain-editor', BrainEditor);
