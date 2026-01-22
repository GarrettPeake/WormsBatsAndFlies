// Unified execution view component with chat and live view toggles

import { api } from '../lib/api-client.js';
import { ExecutionWebSocket } from '../lib/websocket.js';
import { Renderer } from '../three/renderer.js';
import { router } from '../lib/router.js';
import { appState, setSelectedNeuron } from '../lib/state.js';

class ExecutionView extends HTMLElement {
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
    this.messages = [];
    this.neuronMessages = new Map(); // neuronId -> array of messages
    this.neuronStates = new Map();
    this.selectedNeuronId = null;
    this.isLoading = false;
    this.showChat = true;
    this.showLive = false;
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
      this.updateControls();
      this.connectWebSocket();

      // Initialize renderer if live view is shown
      if (this.showLive) {
        this.initRenderer();
      }
    } catch (error) {
      console.error('Failed to load execution:', error);
    }
  }

  initRenderer() {
    const canvas = this.shadowRoot.querySelector('#live-canvas');
    if (!canvas || !this.brain) return;

    // Destroy existing renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    this.renderer = new Renderer(canvas);
    this.renderer.setNeurons(this.brain.neurons);
    this.renderer.setConnections(this.brain.connections);

    this.renderer.onNeuronSelect = (neuronId) => {
      this.selectedNeuronId = neuronId;
      setSelectedNeuron(neuronId);
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
      this.execution.currentStep = data.step;
      this.updateStepCounter();
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

      // Add to neuron messages
      this.addNeuronMessage(data.neuronId, {
        type: 'output',
        content: data.output,
        selfUpdate: data.selfUpdate,
        step: this.execution?.currentStep || 0,
      });

      // Check if this is the output neuron
      const neuron = this.brain?.neurons.find(n => n.id === data.neuronId);
      if (neuron && neuron.type === 'text_output') {
        // Add new assistant message - don't overwrite previous ones
        this.addMessage('assistant', data.output);
      }
    });

    this.ws.on('neuron_error', (data) => {
      this.setNeuronStatus(data.neuronId, 'error');
    });

    this.ws.on('step_completed', () => {
      // Reset fired neurons after a delay
      setTimeout(() => {
        this.neuronStates.forEach((state, id) => {
          if (state.status === 'fired') {
            this.setNeuronStatus(id, 'idle');
          }
        });
      }, 500);
    });

    this.ws.on('execution_paused', () => {
      if (this.execution) this.execution.status = 'paused';
      this.updateControls();
    });

    this.ws.on('execution_resumed', () => {
      if (this.execution) this.execution.status = 'running';
      this.updateControls();
    });

    this.ws.on('execution_fizzled', (data) => {
      if (this.execution) this.execution.status = 'completed';
      this.isLoading = false;
      this.updateControls();
      this.updateInputState();
    });

    this.ws.on('final_output', (data) => {
      // Final output is already handled in neuron_output for text_output neurons
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.isLoading = false;
      this.updateInputState();
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

  addNeuronMessage(neuronId, message) {
    if (!this.neuronMessages.has(neuronId)) {
      this.neuronMessages.set(neuronId, []);
    }
    this.neuronMessages.get(neuronId).push(message);

    if (this.selectedNeuronId === neuronId) {
      this.updateInspector();
    }
  }

  updateHeader() {
    const title = this.shadowRoot.querySelector('#header-title');
    if (title && this.brain) {
      title.textContent = this.brain.name;
    }
  }

  updateStepCounter() {
    const counter = this.shadowRoot.querySelector('#step-counter');
    if (counter && this.execution) {
      counter.textContent = `Step ${this.execution.currentStep}`;
    }
  }

  updateControls() {
    const pauseBtn = this.shadowRoot.querySelector('#pause-btn');
    const stepBtn = this.shadowRoot.querySelector('#step-btn');

    if (!pauseBtn || !stepBtn) return;

    if (!this.execution) {
      pauseBtn.style.display = 'none';
      stepBtn.style.display = 'none';
      return;
    }

    pauseBtn.style.display = 'inline-flex';
    const isPaused = this.execution.status === 'paused';
    const isCompleted = this.execution.status === 'completed';

    pauseBtn.innerHTML = isPaused
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    pauseBtn.title = isPaused ? 'Resume' : 'Pause';
    pauseBtn.disabled = isCompleted;

    stepBtn.style.display = isPaused ? 'inline-flex' : 'none';
    stepBtn.disabled = !isPaused || isCompleted;
  }

  updateInputState() {
    const input = this.shadowRoot.querySelector('#chat-input');
    const sendBtn = this.shadowRoot.querySelector('#send-btn');

    if (input) input.disabled = this.isLoading;
    if (sendBtn) sendBtn.disabled = this.isLoading;
  }

  toggleView(view) {
    if (view === 'chat') {
      this.showChat = !this.showChat;
    } else if (view === 'live') {
      this.showLive = !this.showLive;
      if (this.showLive && !this.renderer && this.brain) {
        // Initialize renderer when live view is shown
        setTimeout(() => this.initRenderer(), 0);
      }
    }
    this.updateViewLayout();
  }

  updateViewLayout() {
    const chatPanel = this.shadowRoot.querySelector('#chat-panel');
    const livePanel = this.shadowRoot.querySelector('#live-panel');
    const divider = this.shadowRoot.querySelector('#panel-divider');
    const chatToggle = this.shadowRoot.querySelector('#chat-toggle');
    const liveToggle = this.shadowRoot.querySelector('#live-toggle');

    if (chatPanel) {
      chatPanel.classList.toggle('panel--hidden', !this.showChat);
    }
    if (livePanel) {
      livePanel.classList.toggle('panel--hidden', !this.showLive);
    }
    if (divider) {
      divider.style.display = (this.showChat && this.showLive) ? 'block' : 'none';
    }
    if (chatToggle) {
      chatToggle.classList.toggle('toggle-btn--active', this.showChat);
    }
    if (liveToggle) {
      liveToggle.classList.toggle('toggle-btn--active', this.showLive);
    }

    // Resize renderer if it exists
    if (this.renderer && this.showLive) {
      setTimeout(() => this.renderer.resize(), 100);
    }
  }

  updateInspector() {
    const inspector = this.shadowRoot.querySelector('#neuron-inspector');
    if (!inspector) return;

    if (!this.selectedNeuronId) {
      inspector.innerHTML = this.renderEmptyInspector();
      return;
    }

    const neuron = this.brain?.neurons.find(n => n.id === this.selectedNeuronId);
    const state = this.neuronStates.get(this.selectedNeuronId);
    const messages = this.neuronMessages.get(this.selectedNeuronId) || [];

    inspector.innerHTML = this.renderNeuronInspector(neuron, state, messages);
  }

  renderEmptyInspector() {
    return `
      <div class="inspector-empty">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p>Select a neuron to inspect</p>
      </div>
    `;
  }

  renderNeuronInspector(neuron, state, messages) {
    if (!neuron) return this.renderEmptyInspector();

    const s = state || {};
    const statusColors = {
      idle: 'var(--color-neuron-idle)',
      processing: 'var(--color-neuron-processing)',
      fired: 'var(--color-neuron-fired)',
      error: 'var(--color-neuron-error)',
    };

    return `
      <div class="inspector-header">
        <div class="inspector-neuron-color" style="background-color: ${neuron.color || '#6366f1'}"></div>
        <div class="inspector-neuron-info">
          <h4>${this.escapeHtml(neuron.name)}</h4>
          <span class="badge badge--info">${neuron.type}</span>
        </div>
      </div>

      <div class="inspector-stats">
        <div class="stat">
          <span class="stat-value">${s.totalFireCount || 0}</span>
          <span class="stat-label">Fires</span>
        </div>
        <div class="stat">
          <span class="stat-value">${s.totalTokensUsed || 0}</span>
          <span class="stat-label">Tokens</span>
        </div>
        <div class="stat">
          <span class="stat-value" style="color: ${statusColors[s.status] || statusColors.idle}">${s.status || 'idle'}</span>
          <span class="stat-label">Status</span>
        </div>
      </div>

      <div class="inspector-messages">
        <h5>Activity</h5>
        <div class="inspector-messages-list">
          ${messages.length === 0
            ? '<p class="no-messages">No activity yet</p>'
            : messages.slice(-20).reverse().map(msg => `
              <div class="inspector-message">
                <div class="inspector-message-header">
                  <span class="inspector-message-step">Step ${msg.step}</span>
                  <span class="inspector-message-type">${msg.type}</span>
                </div>
                <div class="inspector-message-content">${this.escapeHtml(this.truncate(msg.content, 200))}</div>
                ${msg.selfUpdate ? `<div class="inspector-message-update">Self-update: ${this.escapeHtml(this.truncate(msg.selfUpdate, 100))}</div>` : ''}
              </div>
            `).join('')
          }
        </div>
      </div>
    `;
  }

  addMessage(role, content) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    this.messages.push({ id, role, content, timestamp: new Date() });
    this.renderMessages();
  }

  renderMessages() {
    const container = this.shadowRoot.querySelector('#messages');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = `
        <div class="chat-empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Send a message to interact with this brain</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.messages.map(msg => `
      <div class="chat-message chat-message--${msg.role}">
        <div class="chat-message__content">${this.escapeHtml(msg.content)}</div>
      </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async sendMessage() {
    const input = this.shadowRoot.querySelector('#chat-input');
    const content = input?.value?.trim();

    if (!content || this.isLoading || !this.brain) return;

    // Add user message
    this.addMessage('user', content);
    input.value = '';

    this.isLoading = true;
    this.updateInputState();

    try {
      // Send input to existing execution or start new one
      if (this.execution && this.execution.status !== 'completed') {
        await api.sendInput(this.execution.id, content);
      } else {
        // Start new execution
        this.execution = await api.startExecution(this.brain.id, {
          initialInput: content,
        });

        // Update URL
        router.navigate(`/brains/${this.brain.id}/exec/${this.execution.id}`);
        window.dispatchEvent(new CustomEvent('executions:refresh'));

        // Connect WebSocket
        this.connectWebSocket();
        this.updateControls();

        // Initialize renderer if live view is shown
        if (this.showLive && !this.renderer) {
          this.initRenderer();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.addMessage('assistant', 'Sorry, there was an error processing your message.');
    }

    this.isLoading = false;
    this.updateInputState();
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
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

        .execution-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: var(--header-height);
          padding: 0 var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .header__left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .header__logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          cursor: pointer;
          color: var(--color-text-primary);
          transition: color var(--transition-fast);
        }

        .header__logo:hover {
          color: var(--color-primary);
        }

        .header__title {
          font-size: var(--text-lg);
          font-weight: 600;
          margin-left: var(--space-4);
          padding-left: var(--space-4);
          border-left: 1px solid var(--color-border);
        }

        .header__right {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .view-toggles {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .panel--hidden {
          display: none;
        }

        .panel-divider {
          width: 6px;
          background-color: var(--color-border);
          display: none;
          cursor: ew-resize;
          transition: background-color var(--transition-fast);
          flex-shrink: 0;
        }

        .panel-divider:hover,
        .panel-divider.dragging {
          background-color: var(--color-primary);
        }

        /* Chat styles */
        .chat {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .chat-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          text-align: center;
        }

        .chat-empty svg {
          margin-bottom: var(--space-4);
          opacity: 0.5;
        }

        .chat-message {
          max-width: 80%;
        }

        .chat-message--user {
          align-self: flex-end;
        }

        .chat-message--assistant {
          align-self: flex-start;
        }

        .chat-message__content {
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .chat-message--user .chat-message__content {
          background-color: var(--color-primary);
          color: white;
          border-bottom-right-radius: var(--radius-sm);
        }

        .chat-message--assistant .chat-message__content {
          background-color: var(--color-bg-tertiary);
          border-bottom-left-radius: var(--radius-sm);
        }

        .chat-input-container {
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
        }

        .chat-input-wrapper {
          display: flex;
          gap: var(--space-3);
          align-items: flex-end;
        }

        .chat-input {
          flex: 1;
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          border-radius: var(--radius-lg);
          resize: none;
          min-height: 44px;
          max-height: 200px;
        }

        .chat-send-btn {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-primary);
          color: white;
          flex-shrink: 0;
        }

        .chat-send-btn:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Live view styles */
        .live {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .live-canvas-container {
          flex: 1;
          position: relative;
        }

        .live-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .live-inspector {
          width: 320px;
          background-color: var(--color-bg-secondary);
          border-left: 1px solid var(--color-border);
          overflow-y: auto;
          position: relative;
          flex-shrink: 0;
        }

        .inspector-resize-handle {
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

        .inspector-resize-handle:hover,
        .inspector-resize-handle.dragging {
          background-color: var(--color-primary);
        }

        .inspector-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--space-4);
        }

        .inspector-empty svg {
          margin-bottom: var(--space-3);
          opacity: 0.5;
        }

        .inspector-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .inspector-neuron-color {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .inspector-neuron-info h4 {
          font-size: var(--text-base);
          font-weight: 600;
          margin-bottom: var(--space-1);
        }

        .inspector-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-2);
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .stat {
          text-align: center;
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .stat-value {
          display: block;
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-primary);
        }

        .stat-label {
          display: block;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: var(--space-1);
        }

        .inspector-messages {
          padding: var(--space-4);
        }

        .inspector-messages h5 {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-3);
        }

        .inspector-messages-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-height: 400px;
          overflow-y: auto;
        }

        .inspector-message {
          padding: var(--space-3);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .inspector-message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }

        .inspector-message-step {
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--color-primary);
        }

        .inspector-message-type {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          text-transform: uppercase;
        }

        .inspector-message-content {
          font-size: var(--text-sm);
          color: var(--color-text-primary);
          word-break: break-word;
        }

        .inspector-message-update {
          margin-top: var(--space-2);
          padding-top: var(--space-2);
          border-top: 1px solid var(--color-border);
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
          font-style: italic;
        }

        .no-messages {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-style: italic;
          text-align: center;
          padding: var(--space-4);
        }

        .live-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
      </style>

      <div class="execution-container">
        <header class="header">
          <div class="header__left">
            <div class="header__logo" id="home-btn">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 0 20"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              <span>WormsBatsAndFlies</span>
            </div>
            <span class="header__title" id="header-title">Loading...</span>
          </div>
          <div class="header__right">
            <div class="view-toggles">
              <button class="toggle-btn toggle-btn--active" id="chat-toggle">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Chat
              </button>
              <button class="toggle-btn" id="live-toggle">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Live
              </button>
            </div>

            <span class="step-badge" id="step-counter">Step 0</span>

            <button class="btn btn--secondary" id="pause-btn" style="display: none;" title="Pause">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            </button>

            <button class="btn btn--secondary" id="step-btn" style="display: none;" title="Step">
              Step
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

        <div class="content">
          <div class="panel" id="chat-panel">
            <div class="chat">
              <div class="chat-messages" id="messages">
                <div class="chat-empty">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p>Send a message to interact with this brain</p>
                </div>
              </div>
              <div class="chat-input-container">
                <div class="chat-input-wrapper">
                  <textarea
                    class="input chat-input"
                    id="chat-input"
                    placeholder="Type your message..."
                    rows="1"
                  ></textarea>
                  <button class="chat-send-btn" id="send-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="panel-divider" id="panel-divider"></div>

          <div class="panel panel--hidden" id="live-panel">
            <div class="live">
              <div class="live-content">
                <div class="live-canvas-container">
                  <canvas class="live-canvas" id="live-canvas"></canvas>
                </div>
                <div class="live-inspector" id="neuron-inspector">
                  <div class="inspector-resize-handle" id="inspector-resize-handle"></div>
                  ${this.renderEmptyInspector()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    this.shadowRoot.querySelector('#home-btn').addEventListener('click', () => {
      router.navigate('/brains');
    });

    this.shadowRoot.querySelector('#chat-toggle').addEventListener('click', () => {
      this.toggleView('chat');
    });

    this.shadowRoot.querySelector('#live-toggle').addEventListener('click', () => {
      this.toggleView('live');
    });

    this.shadowRoot.querySelector('#pause-btn').addEventListener('click', () => {
      this.togglePause();
    });

    this.shadowRoot.querySelector('#step-btn').addEventListener('click', () => {
      this.manualStep();
    });

    this.shadowRoot.querySelector('#edit-btn').addEventListener('click', () => {
      if (this.brain) {
        router.navigate(`/brains/${this.brain.id}/edit`);
      }
    });

    this.shadowRoot.querySelector('#send-btn').addEventListener('click', () => {
      this.sendMessage();
    });

    const input = this.shadowRoot.querySelector('#chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    });

    // Setup resize handles
    this.setupResizeHandles();
  }

  setupResizeHandles() {
    // Chat/Live panel divider resize
    const divider = this.shadowRoot.querySelector('#panel-divider');
    const chatPanel = this.shadowRoot.querySelector('#chat-panel');
    const content = this.shadowRoot.querySelector('.content');
    let isDraggingDivider = false;

    divider?.addEventListener('mousedown', (e) => {
      if (!this.showChat || !this.showLive) return;
      isDraggingDivider = true;
      divider.classList.add('dragging');
      e.preventDefault();
    });

    // Inspector resize handle
    const inspectorHandle = this.shadowRoot.querySelector('#inspector-resize-handle');
    const inspector = this.shadowRoot.querySelector('#neuron-inspector');
    let isDraggingInspector = false;
    let inspectorStartX = 0;
    let inspectorStartWidth = 0;

    inspectorHandle?.addEventListener('mousedown', (e) => {
      isDraggingInspector = true;
      inspectorStartX = e.clientX;
      inspectorStartWidth = inspector.offsetWidth;
      inspectorHandle.classList.add('dragging');
      e.preventDefault();
    });

    // Shared mousemove handler
    document.addEventListener('mousemove', (e) => {
      if (isDraggingDivider && content && chatPanel) {
        const contentRect = content.getBoundingClientRect();
        const relativeX = e.clientX - contentRect.left;
        const percentage = (relativeX / contentRect.width) * 100;
        const clampedPercentage = Math.max(20, Math.min(80, percentage));
        chatPanel.style.flex = `0 0 ${clampedPercentage}%`;
      }

      if (isDraggingInspector && inspector) {
        const diff = inspectorStartX - e.clientX;
        const newWidth = Math.max(200, Math.min(500, inspectorStartWidth + diff));
        inspector.style.width = `${newWidth}px`;
      }
    });

    // Shared mouseup handler
    document.addEventListener('mouseup', () => {
      if (isDraggingDivider) {
        isDraggingDivider = false;
        divider?.classList.remove('dragging');
        // Resize renderer after panel resize
        if (this.renderer && this.showLive) {
          setTimeout(() => this.renderer.resize(), 100);
        }
      }

      if (isDraggingInspector) {
        isDraggingInspector = false;
        inspectorHandle?.classList.remove('dragging');
        // Resize renderer after inspector resize
        if (this.renderer && this.showLive) {
          setTimeout(() => this.renderer.resize(), 100);
        }
      }
    });
  }
}

customElements.define('execution-view', ExecutionView);
