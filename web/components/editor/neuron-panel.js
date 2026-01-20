// Neuron editor panel component

import { api } from '../../lib/api-client.js';
import { appState, setSelectedNeuron } from '../../lib/state.js';

class NeuronPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.brain = null;
    this.selectedNeuron = null;
  }

  connectedCallback() {
    this.render();

    // Listen for selection changes
    appState.subscribe((state) => {
      if (state.selectedNeuronId !== (this.selectedNeuron?.id || null)) {
        this.selectNeuron(state.selectedNeuronId);
      }
    });
  }

  setBrain(brain) {
    this.brain = brain;
    this.selectNeuron(appState.getState().selectedNeuronId);
  }

  selectNeuron(neuronId) {
    if (!this.brain) return;

    this.selectedNeuron = neuronId
      ? this.brain.neurons.find(n => n.id === neuronId)
      : null;

    this.updatePanel();
  }

  updatePanel() {
    const content = this.shadowRoot.querySelector('.panel-content');
    if (!content) return;

    if (!this.selectedNeuron) {
      content.innerHTML = this.renderEmptyState();
      return;
    }

    content.innerHTML = this.renderNeuronForm();
    this.setupFormListeners();
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p class="empty-state__title">No Neuron Selected</p>
        <p class="empty-state__description">Click on a neuron to edit its properties</p>
      </div>
    `;
  }

  renderNeuronForm() {
    const n = this.selectedNeuron;
    const models = [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
    ];

    const neuronTypes = [
      { id: 'regular', name: 'Regular' },
      { id: 'text_input', name: 'Text Input' },
      { id: 'picture_input', name: 'Picture Input' },
      { id: 'text_output', name: 'Text Output' },
    ];

    return `
      <form class="neuron-form">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" name="name" class="input" value="${this.escapeHtml(n.name)}" />
        </div>

        <div class="form-group">
          <label class="form-label">Type</label>
          <select name="type" class="input select">
            ${neuronTypes.map(t => `
              <option value="${t.id}" ${n.type === t.id ? 'selected' : ''}>${t.name}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Model</label>
          <select name="model" class="input select">
            ${models.map(m => `
              <option value="${m.id}" ${n.model === m.id ? 'selected' : ''}>${m.name}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-picker">
            <input type="color" name="color" class="color-input" value="${n.color || '#6366f1'}" />
            <span class="color-value">${n.color || '#6366f1'}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Memory Length: ${n.memoryLength}</label>
          <input type="range" name="memoryLength" class="slider" min="1" max="20" value="${n.memoryLength}" />
        </div>

        <div class="form-group">
          <label class="form-label">Temperature: ${n.temperature || 0.7}</label>
          <input type="range" name="temperature" class="slider" min="0" max="2" step="0.1" value="${n.temperature || 0.7}" />
        </div>

        <div class="form-group">
          <label class="form-label">System Prompt</label>
          <textarea name="systemPrompt" class="input textarea" rows="6">${this.escapeHtml(n.systemPrompt)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Connections</label>
          <div class="connections-list">
            ${this.renderConnections()}
          </div>
          <button type="button" class="btn btn--secondary btn--sm" id="add-connection-btn">+ Add Connection</button>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn--secondary" id="delete-neuron-btn">Delete Neuron</button>
        </div>
      </form>
    `;
  }

  renderConnections() {
    if (!this.brain || !this.selectedNeuron) return '';

    const outgoing = this.brain.connections.filter(c => c.sourceNeuronId === this.selectedNeuron.id);

    if (outgoing.length === 0) {
      return '<p class="no-connections">No outgoing connections</p>';
    }

    return outgoing.map(conn => {
      const target = this.brain.neurons.find(n => n.id === conn.targetNeuronId);
      return `
        <div class="connection-item">
          <span>→ ${target ? this.escapeHtml(target.name) : 'Unknown'}</span>
          <button type="button" class="btn btn--ghost btn--icon delete-connection-btn" data-id="${conn.id}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setupFormListeners() {
    const form = this.shadowRoot.querySelector('.neuron-form');
    if (!form) return;

    // Auto-save on change
    form.addEventListener('change', (e) => {
      this.handleFieldChange(e.target.name, e.target.value);
    });

    form.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
        // Update label
        const label = e.target.closest('.form-group').querySelector('.form-label');
        const name = e.target.name;
        label.textContent = `${name.charAt(0).toUpperCase() + name.slice(1)}: ${e.target.value}`;
      }
    });

    // Delete neuron
    const deleteBtn = form.querySelector('#delete-neuron-btn');
    deleteBtn?.addEventListener('click', () => this.deleteNeuron());

    // Add connection
    const addConnBtn = form.querySelector('#add-connection-btn');
    addConnBtn?.addEventListener('click', () => this.showConnectionDialog());

    // Delete connection buttons
    form.querySelectorAll('.delete-connection-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteConnection(btn.dataset.id));
    });

    // Color input
    const colorInput = form.querySelector('input[name="color"]');
    colorInput?.addEventListener('input', (e) => {
      const colorValue = form.querySelector('.color-value');
      if (colorValue) colorValue.textContent = e.target.value;
    });
  }

  async handleFieldChange(name, value) {
    if (!this.brain || !this.selectedNeuron) return;

    // Convert types
    if (name === 'memoryLength') value = parseInt(value);
    if (name === 'temperature') value = parseFloat(value);

    // Update local state
    this.selectedNeuron[name] = value;

    // Update brain neurons array
    const index = this.brain.neurons.findIndex(n => n.id === this.selectedNeuron.id);
    if (index >= 0) {
      this.brain.neurons[index] = this.selectedNeuron;
    }

    // Notify canvas to update
    window.dispatchEvent(new CustomEvent('neuron:updated', { detail: this.selectedNeuron }));
  }

  async deleteNeuron() {
    if (!this.brain || !this.selectedNeuron) return;

    if (!confirm('Are you sure you want to delete this neuron?')) {
      return;
    }

    try {
      await api.deleteNeuron(this.brain.id, this.selectedNeuron.id);

      // Update local state
      this.brain.neurons = this.brain.neurons.filter(n => n.id !== this.selectedNeuron.id);
      this.brain.connections = this.brain.connections.filter(
        c => c.sourceNeuronId !== this.selectedNeuron.id && c.targetNeuronId !== this.selectedNeuron.id
      );

      setSelectedNeuron(null);
      window.dispatchEvent(new CustomEvent('brain:updated', { detail: this.brain }));
    } catch (error) {
      console.error('Failed to delete neuron:', error);
    }
  }

  async deleteConnection(connectionId) {
    if (!this.brain) return;

    try {
      await api.deleteConnection(this.brain.id, connectionId);

      this.brain.connections = this.brain.connections.filter(c => c.id !== connectionId);
      this.updatePanel();
      window.dispatchEvent(new CustomEvent('brain:updated', { detail: this.brain }));
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  }

  showConnectionDialog() {
    if (!this.brain || !this.selectedNeuron) return;

    // Get neurons that can be connected to
    const availableNeurons = this.brain.neurons.filter(n => {
      if (n.id === this.selectedNeuron.id) return false;
      // Check if connection already exists
      return !this.brain.connections.some(
        c => c.sourceNeuronId === this.selectedNeuron.id && c.targetNeuronId === n.id
      );
    });

    if (availableNeurons.length === 0) {
      alert('No available neurons to connect to.');
      return;
    }

    const targetId = prompt(
      `Connect to:\n${availableNeurons.map((n, i) => `${i + 1}. ${n.name}`).join('\n')}\n\nEnter number:`
    );

    if (targetId) {
      const index = parseInt(targetId) - 1;
      if (index >= 0 && index < availableNeurons.length) {
        this.addConnection(availableNeurons[index].id);
      }
    }
  }

  async addConnection(targetNeuronId) {
    if (!this.brain || !this.selectedNeuron) return;

    try {
      const connection = await api.addConnection(this.brain.id, {
        sourceNeuronId: this.selectedNeuron.id,
        targetNeuronId,
      });

      this.brain.connections.push(connection);
      this.updatePanel();
      window.dispatchEvent(new CustomEvent('brain:updated', { detail: this.brain }));
    } catch (error) {
      console.error('Failed to add connection:', error);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
          overflow: hidden;
        }

        .panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .panel-header h3 {
          font-size: var(--text-base);
          font-weight: 600;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .neuron-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .color-picker {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .color-input {
          width: 40px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
        }

        .color-value {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .connections-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .connection-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
        }

        .no-connections {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-style: italic;
        }

        .form-actions {
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--color-text-muted);
        }

        .empty-state__icon {
          margin-bottom: var(--space-4);
          opacity: 0.5;
        }

        .empty-state__title {
          font-size: var(--text-base);
          font-weight: 500;
          margin-bottom: var(--space-2);
        }

        .empty-state__description {
          font-size: var(--text-sm);
        }
      </style>

      <div class="panel">
        <div class="panel-header">
          <h3>Neuron Properties</h3>
        </div>
        <div class="panel-content">
          ${this.renderEmptyState()}
        </div>
      </div>
    `;
  }
}

customElements.define('neuron-panel', NeuronPanel);
