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
    this.saveTimeout = null;
    this.saveStatus = 'saved'; // 'saved', 'saving', 'unsaved'
    this.lastSavedBrain = null;
  }

  connectedCallback() {
    this.render();
    this.loadBrain();

    // Listen for neuron and brain updates
    window.addEventListener('neuron:updated', this.handleNeuronUpdate.bind(this));
    window.addEventListener('brain:updated', this.handleBrainUpdate.bind(this));
  }

  disconnectedCallback() {
    window.removeEventListener('neuron:updated', this.handleNeuronUpdate.bind(this));
    window.removeEventListener('brain:updated', this.handleBrainUpdate.bind(this));

    // Clear save timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'brain-id' && oldValue !== newValue) {
      this.loadBrain();
    }
  }

  handleNeuronUpdate(e) {
    this.scheduleAutosave();
    this.updateEditor();
  }

  handleBrainUpdate(e) {
    if (e.detail) {
      this.brain = e.detail;
    }
    this.scheduleAutosave();
    this.updateEditor();
  }

  async loadBrain() {
    const brainId = this.getAttribute('brain-id');
    if (!brainId) return;

    try {
      this.brain = await api.getBrain(brainId);
      this.lastSavedBrain = JSON.stringify(this.brain);
      setCurrentBrain(this.brain);
      this.saveStatus = 'saved';
      this.updateEditor();
      this.updateSaveIndicator();
    } catch (error) {
      console.error('Failed to load brain:', error);
    }
  }

  updateEditor() {
    if (!this.brain) return;

    // Update name input
    const nameInput = this.shadowRoot.querySelector('#brain-name-input');
    if (nameInput && nameInput !== document.activeElement) {
      nameInput.value = this.brain.name;
    }

    // Update canvas
    const canvas = this.shadowRoot.querySelector('three-canvas');
    if (canvas) {
      canvas.setBrain(this.brain);
    }

    // Update panel
    const panel = this.shadowRoot.querySelector('neuron-panel');
    if (panel) {
      panel.setBrain(this.brain);
    }
  }

  scheduleAutosave() {
    this.saveStatus = 'unsaved';
    this.updateSaveIndicator();

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Schedule save after 1 second of inactivity
    this.saveTimeout = setTimeout(() => {
      this.autoSaveBrain();
    }, 1000);
  }

  updateSaveIndicator() {
    const indicator = this.shadowRoot.querySelector('#save-indicator');
    if (!indicator) return;

    indicator.className = 'save-indicator';
    if (this.saveStatus === 'saving') {
      indicator.className = 'save-indicator save-indicator--saving';
      indicator.innerHTML = `
        <div class="spinner" style="width: 12px; height: 12px;"></div>
        Saving...
      `;
    } else if (this.saveStatus === 'saved') {
      indicator.className = 'save-indicator save-indicator--saved';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Saved
      `;
    } else {
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        Unsaved
      `;
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
      this.scheduleAutosave();
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

  async autoSaveBrain() {
    if (!this.brain) return;

    // Check if there are actual changes
    const currentState = JSON.stringify(this.brain);
    if (currentState === this.lastSavedBrain) {
      this.saveStatus = 'saved';
      this.updateSaveIndicator();
      return;
    }

    this.saveStatus = 'saving';
    this.updateSaveIndicator();

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

      this.lastSavedBrain = currentState;
      this.saveStatus = 'saved';
      this.updateSaveIndicator();
      window.dispatchEvent(new CustomEvent('brains:refresh'));
    } catch (error) {
      console.error('Failed to save brain:', error);
      this.saveStatus = 'unsaved';
      this.updateSaveIndicator();
    }
  }

  async deleteBrain() {
    if (!this.brain) return;

    if (!confirm(`Are you sure you want to delete "${this.brain.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteBrain(this.brain.id);
      window.dispatchEvent(new CustomEvent('brains:refresh'));
      router.navigate('/brains');
    } catch (error) {
      console.error('Failed to delete brain:', error);
    }
  }

  async startExecution() {
    if (!this.brain) return;

    const input = this.shadowRoot.querySelector('#start-prompt');
    const message = input?.value?.trim();
    if (!message) return;

    try {
      const execution = await api.startExecution(this.brain.id, {
        initialInput: message,
      });

      router.navigate(`/brains/${this.brain.id}/exec/${execution.id}`);
      window.dispatchEvent(new CustomEvent('executions:refresh'));
    } catch (error) {
      console.error('Failed to start execution:', error);
    }
  }

  onNameChange(e) {
    if (!this.brain) return;
    this.brain.name = e.target.value;
    this.scheduleAutosave();
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
          gap: var(--space-4);
        }

        .editor-header__left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .editor-header__logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          cursor: pointer;
          color: var(--color-text-primary);
          transition: color var(--transition-fast);
        }

        .editor-header__logo:hover {
          color: var(--color-primary);
        }

        .editor-header__center {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
        }

        .editor-header__right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .brain-name-input {
          font-size: var(--text-lg);
          font-weight: 600;
          background: transparent;
          border: none;
          color: var(--color-text-primary);
          text-align: center;
          padding: var(--space-2);
          border-radius: var(--radius-md);
          transition: background-color var(--transition-fast);
          min-width: 200px;
        }

        .brain-name-input:hover {
          background-color: var(--color-bg-tertiary);
        }

        .brain-name-input:focus {
          background-color: var(--color-bg-tertiary);
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }

        .prompt-container {
          display: flex;
          gap: var(--space-2);
        }

        .prompt-input {
          width: 200px;
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
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
          position: relative;
        }

        .panel-resize-handle {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: ew-resize;
          background-color: transparent;
          transition: background-color var(--transition-fast);
          z-index: 10;
        }

        .panel-resize-handle:hover,
        .panel-resize-handle.dragging {
          background-color: var(--color-primary);
        }

        .toolbar {
          position: absolute;
          bottom: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
        }

        .save-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .save-indicator--saving {
          color: var(--color-warning);
        }

        .save-indicator--saved {
          color: var(--color-success);
        }
      </style>

      <div class="editor-container">
        <header class="editor-header">
          <div class="editor-header__left">
            <div class="editor-header__logo" id="home-btn">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 0 20"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
          </div>

          <div class="editor-header__center">
            <input
              type="text"
              class="brain-name-input"
              id="brain-name-input"
              value="Loading..."
              placeholder="Brain Name"
            />
            <span class="save-indicator save-indicator--saved" id="save-indicator">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </span>
          </div>

          <div class="editor-header__right">
            <div class="prompt-container">
              <input
                type="text"
                class="input prompt-input"
                id="start-prompt"
                placeholder="Run with message..."
              />
              <button class="btn btn--primary" id="run-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run
              </button>
            </div>
            <button class="btn btn--ghost" id="delete-btn" title="Delete Brain">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </header>
        <div class="editor-content">
          <div class="editor-canvas">
            <three-canvas></three-canvas>
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
          <aside class="editor-panel" id="editor-panel">
            <div class="panel-resize-handle" id="resize-handle"></div>
            <neuron-panel></neuron-panel>
          </aside>
        </div>
      </div>
    `;

    // Event listeners
    this.shadowRoot.getElementById('add-neuron-btn').addEventListener('click', () => this.addNeuron());

    this.shadowRoot.getElementById('home-btn').addEventListener('click', () => {
      router.navigate('/brains');
    });

    this.shadowRoot.getElementById('brain-name-input').addEventListener('input', (e) => {
      this.onNameChange(e);
    });

    this.shadowRoot.getElementById('run-btn').addEventListener('click', () => {
      this.startExecution();
    });

    this.shadowRoot.getElementById('start-prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.startExecution();
      }
    });

    this.shadowRoot.getElementById('delete-btn').addEventListener('click', () => {
      this.deleteBrain();
    });

    this.shadowRoot.getElementById('reset-camera-btn').addEventListener('click', () => {
      const canvas = this.shadowRoot.querySelector('three-canvas');
      if (canvas) {
        canvas.resetCamera();
      }
    });

    // Panel resize functionality
    this.setupPanelResize();
  }

  setupPanelResize() {
    const panel = this.shadowRoot.getElementById('editor-panel');
    const handle = this.shadowRoot.getElementById('resize-handle');
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      handle.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const diff = startX - e.clientX;
      const newWidth = Math.max(280, Math.min(600, startWidth + diff));
      panel.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        handle.classList.remove('dragging');
      }
    });
  }
}

customElements.define('brain-editor', BrainEditor);
