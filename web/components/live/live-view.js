// Live brain execution view component

import { api } from '../../lib/api-client.js';
import { ExecutionWebSocket } from '../../lib/websocket.js';
import { Renderer } from '../../three/renderer.js';
import { router } from '../../lib/router.js';

class LiveView extends HTMLElement {
  static get observedAttributes() {
    return ['brain-id', 'exec-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.brain = null;
    this.execution = null;
    this.ws = null;
    this.renderer = null;
    this.selectedNeuronId = null;
    this.neuronStates = new Map();
  }

  connectedCallback() {
    this.render();
    this.loadBrain();
  }

  disconnectedCallback() {
    if (this.ws) {
      this.ws.disconnect();
    }
    if (this.renderer) {
      this.renderer.destroy();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'brain-id') {
        this.loadBrain();
      } else if (name === 'exec-id' && newValue) {
        this.loadExecution(newValue);
      }
    }
  }

  async loadBrain() {
    const brainId = this.getAttribute('brain-id');
    if (!brainId) return;

    try {
      this.brain = await api.getBrain(brainId);
      this.updateHeader();
      this.initRenderer();

      // Check if there's an exec-id to load
      const execId = this.getAttribute('exec-id');
      if (execId) {
        this.loadExecution(execId);
      }
    } catch (error) {
      console.error('Failed to load brain:', error);
    }
  }

  async loadExecution(execId) {
    try {
      this.execution = await api.getExecution(execId);
      this.connectWebSocket();
      this.updateNeuronStates();
      this.updateControls();
    } catch (error) {
      console.error('Failed to load execution:', error);
    }
  }

  initRenderer() {
    const canvas = this.shadowRoot.querySelector('canvas');
    if (!canvas || !this.brain) return;

    // Destroy existing renderer to prevent WebGL context leaks
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    this.renderer = new Renderer(canvas);
    this.renderer.setNeurons(this.brain.neurons);
    this.renderer.setConnections(this.brain.connections);

    this.renderer.onNeuronSelect = (neuronId) => {
      this.selectedNeuronId = neuronId;
      this.updateInspector();
    };

    this.renderer.start();
  }

  connectWebSocket() {
    if (!this.execution) return;

    if (this.ws) {
      this.ws.disconnect();
    }

    this.ws = new ExecutionWebSocket(this.execution.id, api.getToken());

    this.ws.on('step_started', (data) => {
      this.updateStepCounter(data.step);
    });

    this.ws.on('neuron_processing', (data) => {
      this.setNeuronStatus(data.neuronId, 'processing');
    });

    this.ws.on('neuron_output', (data) => {
      this.setNeuronStatus(data.neuronId, 'fired');
      this.updateNeuronState(data.neuronId, {
        lastOutput: data.output,
        lastSelfUpdate: data.selfUpdate,
      });
    });

    this.ws.on('neuron_error', (data) => {
      this.setNeuronStatus(data.neuronId, 'error');
    });

    this.ws.on('step_completed', (data) => {
      // Reset fired neurons to idle after a delay
      setTimeout(() => {
        this.neuronStates.forEach((state, id) => {
          if (state.status === 'fired') {
            this.setNeuronStatus(id, 'idle');
          }
        });
      }, 500);
    });

    this.ws.on('execution_paused', () => {
      this.execution.status = 'paused';
      this.updateControls();
    });

    this.ws.on('execution_resumed', () => {
      this.execution.status = 'running';
      this.updateControls();
    });

    this.ws.on('execution_fizzled', (data) => {
      this.execution.status = 'paused';
      this.updateControls();
      this.showMessage(`Brain fizzled after ${data.totalSteps} steps`);
    });

    this.ws.on('final_output', (data) => {
      this.showOutput(data.content);
    });

    this.ws.connect();
  }

  setNeuronStatus(neuronId, status) {
    let state = this.neuronStates.get(neuronId);
    if (!state) {
      state = { neuronId, status, memory: [], inputQueue: [] };
      this.neuronStates.set(neuronId, state);
    }
    state.status = status;

    if (this.renderer) {
      this.renderer.setNeuronStatus(neuronId, status);
    }

    if (this.selectedNeuronId === neuronId) {
      this.updateInspector();
    }
  }

  updateNeuronState(neuronId, updates) {
    let state = this.neuronStates.get(neuronId);
    if (!state) {
      state = { neuronId, status: 'idle', memory: [], inputQueue: [] };
      this.neuronStates.set(neuronId, state);
    }
    Object.assign(state, updates);

    if (this.selectedNeuronId === neuronId) {
      this.updateInspector();
    }
  }

  updateNeuronStates() {
    if (!this.execution) return;

    for (const [neuronId, state] of Object.entries(this.execution.neuronStates || {})) {
      this.neuronStates.set(neuronId, state);
      if (this.renderer) {
        this.renderer.setNeuronStatus(neuronId, state.status);
      }
    }
  }

  updateHeader() {
    const header = this.shadowRoot.querySelector('.live-header h2');
    if (header && this.brain) {
      header.textContent = `Live View: ${this.brain.name}`;
    }
  }

  updateStepCounter(step) {
    const counter = this.shadowRoot.querySelector('.step-counter');
    if (counter) {
      counter.textContent = `Step: ${step}`;
    }
  }

  updateControls() {
    const pauseBtn = this.shadowRoot.querySelector('#pause-btn');
    const stepBtn = this.shadowRoot.querySelector('#step-btn');
    const startBtn = this.shadowRoot.querySelector('#start-btn');

    if (!this.execution) {
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (stepBtn) stepBtn.style.display = 'none';
      if (startBtn) startBtn.style.display = 'inline-flex';
      return;
    }

    // Hide start button, show pause button when execution exists
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
    if (stepBtn) stepBtn.style.display = 'inline-flex';

    const isPaused = this.execution.status === 'paused';

    if (pauseBtn) {
      pauseBtn.innerHTML = isPaused
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
    }

    if (stepBtn) {
      stepBtn.disabled = !isPaused;
    }
  }

  updateInspector() {
    const inspector = this.shadowRoot.querySelector('neuron-inspector');
    if (inspector) {
      const neuron = this.brain?.neurons.find(n => n.id === this.selectedNeuronId);
      const state = this.neuronStates.get(this.selectedNeuronId);
      inspector.setNeuron(neuron, state);
    }
  }

  showMessage(message) {
    const output = this.shadowRoot.querySelector('.output-display');
    if (output) {
      output.textContent = message;
    }
  }

  showOutput(content) {
    const output = this.shadowRoot.querySelector('.output-display');
    if (output) {
      output.textContent = content;
    }
  }

  async startExecution() {
    if (!this.brain) return;

    const input = prompt('Enter initial input for the brain:');
    if (input === null) return;

    try {
      this.execution = await api.startExecution(this.brain.id, {
        initialInput: input,
      });
      this.connectWebSocket();
      this.updateControls();
      router.navigate(`/brains/${this.brain.id}/live/${this.execution.id}`);
      // Notify executions panel of new execution
      window.dispatchEvent(new CustomEvent('executions:refresh'));
    } catch (error) {
      console.error('Failed to start execution:', error);
    }
  }

  async togglePause() {
    if (!this.execution) return;

    try {
      if (this.execution.status === 'paused') {
        await api.resumeExecution(this.execution.id);
        this.execution.status = 'running';
      } else {
        await api.pauseExecution(this.execution.id);
        this.execution.status = 'paused';
      }
      this.updateControls();
      // Notify executions panel of status change
      window.dispatchEvent(new CustomEvent('executions:refresh'));
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
  }

  async manualStep() {
    if (!this.execution || this.execution.status !== 'paused') return;

    try {
      await api.stepExecution(this.execution.id);
    } catch (error) {
      console.error('Failed to step:', error);
    }
  }

  async sendInput() {
    if (!this.execution) return;

    const input = prompt('Enter input to send:');
    if (input === null) return;

    try {
      await api.sendInput(this.execution.id, input);
    } catch (error) {
      console.error('Failed to send input:', error);
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

        .live-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .live-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .live-header h2 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .live-header__controls {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .step-counter {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          padding: var(--space-2) var(--space-3);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .live-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .canvas-container {
          flex: 1;
          position: relative;
        }

        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .output-panel {
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          right: var(--space-4);
          max-height: 150px;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .output-header {
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--color-text-secondary);
          background-color: var(--color-bg-tertiary);
          border-bottom: 1px solid var(--color-border);
        }

        .output-display {
          padding: var(--space-3);
          font-size: var(--text-sm);
          max-height: 100px;
          overflow-y: auto;
          white-space: pre-wrap;
        }

        .inspector-panel {
          width: var(--panel-width);
          border-left: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
        }
      </style>

      <div class="live-container">
        <header class="live-header">
          <h2>Live View: Loading...</h2>
          <div class="live-header__controls">
            <span class="step-counter">Step: 0</span>
            <button class="btn btn--secondary" id="start-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start
            </button>
            <button class="btn btn--secondary" id="pause-btn" style="display:none">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              Pause
            </button>
            <button class="btn btn--secondary" id="step-btn" disabled>Step</button>
            <button class="btn btn--secondary" id="input-btn">Send Input</button>
            <button class="btn btn--secondary" id="chat-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </button>
            <button class="btn btn--ghost" id="edit-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          </div>
        </header>
        <div class="live-content">
          <div class="canvas-container">
            <canvas></canvas>
            <div class="output-panel">
              <div class="output-header">Output</div>
              <div class="output-display">No output yet...</div>
            </div>
          </div>
          <aside class="inspector-panel">
            <neuron-inspector></neuron-inspector>
          </aside>
        </div>
      </div>
    `;

    // Event listeners
    this.shadowRoot.getElementById('start-btn').addEventListener('click', () => this.startExecution());
    this.shadowRoot.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    this.shadowRoot.getElementById('step-btn').addEventListener('click', () => this.manualStep());
    this.shadowRoot.getElementById('input-btn').addEventListener('click', () => this.sendInput());
    this.shadowRoot.getElementById('chat-btn').addEventListener('click', () => {
      if (this.brain) {
        // Maintain execution context when switching to chat view
        if (this.execution) {
          router.navigate(`/brains/${this.brain.id}/chat/${this.execution.id}`);
        } else {
          router.navigate(`/brains/${this.brain.id}/chat`);
        }
      }
    });
    this.shadowRoot.getElementById('edit-btn').addEventListener('click', () => {
      if (this.brain) {
        router.navigate(`/brains/${this.brain.id}/edit`);
      }
    });
  }
}

customElements.define('live-view', LiveView);
