// Executions panel component for listing and managing active executions

import { api } from '../lib/api-client.js';
import { appState, setExecutions } from '../lib/state.js';
import { router } from '../lib/router.js';

class ExecutionsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.executions = [];
    this.brains = new Map(); // Cache for brain names
    this.unsubscribe = null;
    this.refreshInterval = null;
  }

  connectedCallback() {
    this.render();
    this.loadExecutions();
    this.setupListeners();

    // Refresh executions list periodically
    this.refreshInterval = setInterval(() => this.loadExecutions(), 5000);
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  setupListeners() {
    this.unsubscribe = appState.subscribe((state, prevState) => {
      if (state.executions !== prevState.executions) {
        this.executions = state.executions;
        this.renderExecutionsList();
      }
    });

    // Listen for execution refresh events
    window.addEventListener('executions:refresh', () => this.loadExecutions());
  }

  async loadExecutions() {
    try {
      const executions = await api.listExecutions();
      // Filter to only running or paused (active) executions
      const activeExecutions = executions.filter(
        e => e.status === 'running' || e.status === 'paused' || e.status === 'initializing'
      );
      this.executions = activeExecutions;
      setExecutions(activeExecutions);

      // Load brain names for executions
      await this.loadBrainNames(activeExecutions);

      this.renderExecutionsList();
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  }

  async loadBrainNames(executions) {
    const brainIds = [...new Set(executions.map(e => e.brainId))];

    for (const brainId of brainIds) {
      if (!this.brains.has(brainId)) {
        try {
          const brain = await api.getBrain(brainId);
          this.brains.set(brainId, brain.name);
        } catch {
          this.brains.set(brainId, 'Unknown Brain');
        }
      }
    }
  }

  async pauseExecution(execId) {
    try {
      await api.pauseExecution(execId);
      await this.loadExecutions();
    } catch (error) {
      console.error('Failed to pause execution:', error);
    }
  }

  async resumeExecution(execId) {
    try {
      await api.resumeExecution(execId);
      await this.loadExecutions();
    } catch (error) {
      console.error('Failed to resume execution:', error);
    }
  }

  openInLiveView(brainId, execId) {
    router.navigate(`/brains/${brainId}/live/${execId}`);
  }

  openInChatView(brainId, execId) {
    router.navigate(`/brains/${brainId}/chat/${execId}`);
  }

  formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  renderExecutionsList() {
    const list = this.shadowRoot.querySelector('.executions-list');
    if (!list) return;

    if (this.executions.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No active executions</p>
        </div>
      `;
      return;
    }

    list.innerHTML = this.executions.map(exec => {
      const brainName = this.brains.get(exec.brainId) || 'Loading...';
      const statusClass = exec.status === 'running' ? 'status--running' :
                         exec.status === 'paused' ? 'status--paused' : 'status--initializing';
      const isPaused = exec.status === 'paused';

      return `
        <div class="execution-item" data-exec-id="${exec.id}" data-brain-id="${exec.brainId}">
          <div class="execution-item__header">
            <span class="execution-item__brain">${this.escapeHtml(brainName)}</span>
            <span class="execution-item__status ${statusClass}">${exec.status}</span>
          </div>
          <div class="execution-item__meta">
            <span class="execution-item__step">Step ${exec.currentStep}</span>
            <span class="execution-item__time">${this.formatTime(exec.startedAt)}</span>
          </div>
          <div class="execution-item__actions">
            <button class="btn btn--xs btn--secondary open-live-btn" title="Open in Live View">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Live
            </button>
            <button class="btn btn--xs btn--secondary open-chat-btn" title="Open in Chat View">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </button>
            <button class="btn btn--xs ${isPaused ? 'btn--primary' : 'btn--warning'} pause-btn" title="${isPaused ? 'Resume' : 'Pause'}">
              ${isPaused ? `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              ` : `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              `}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners
    list.querySelectorAll('.execution-item').forEach(item => {
      const execId = item.dataset.execId;
      const brainId = item.dataset.brainId;

      item.querySelector('.open-live-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openInLiveView(brainId, execId);
      });

      item.querySelector('.open-chat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openInChatView(brainId, execId);
      });

      item.querySelector('.pause-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const exec = this.executions.find(ex => ex.id === execId);
        if (exec?.status === 'paused') {
          this.resumeExecution(execId);
        } else {
          this.pauseExecution(execId);
        }
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-secondary);
        }

        .panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .panel__header h3 {
          font-size: var(--text-sm);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .panel__header h3 svg {
          color: var(--color-primary);
        }

        .refresh-btn {
          padding: var(--space-1);
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          transition: color var(--transition-fast);
        }

        .refresh-btn:hover {
          color: var(--color-text-primary);
        }

        .executions-list {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-2);
        }

        .execution-item {
          padding: var(--space-3);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-2);
          cursor: pointer;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .execution-item:hover {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 1px var(--color-primary);
        }

        .execution-item__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }

        .execution-item__brain {
          font-weight: 500;
          font-size: var(--text-sm);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .execution-item__status {
          font-size: var(--text-xs);
          font-weight: 500;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .status--running {
          background-color: var(--color-success-bg, rgba(34, 197, 94, 0.1));
          color: var(--color-success, #22c55e);
        }

        .status--paused {
          background-color: var(--color-warning-bg, rgba(234, 179, 8, 0.1));
          color: var(--color-warning, #eab308);
        }

        .status--initializing {
          background-color: var(--color-info-bg, rgba(59, 130, 246, 0.1));
          color: var(--color-info, #3b82f6);
        }

        .execution-item__meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-2);
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
        }

        .execution-item__actions {
          display: flex;
          gap: var(--space-2);
        }

        .btn--xs {
          padding: var(--space-1) var(--space-2);
          font-size: var(--text-xs);
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .btn--warning {
          background-color: var(--color-warning, #eab308);
          color: #000;
        }

        .btn--warning:hover {
          background-color: var(--color-warning-hover, #ca8a04);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--color-text-muted);
          text-align: center;
        }

        .empty-state svg {
          margin-bottom: var(--space-3);
          opacity: 0.5;
        }

        .empty-state p {
          font-size: var(--text-sm);
        }
      </style>

      <div class="panel">
        <div class="panel__header">
          <h3>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Active Executions
          </h3>
          <button class="refresh-btn" id="refresh-btn" title="Refresh">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
        <div class="executions-list"></div>
      </div>
    `;

    this.shadowRoot.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadExecutions();
    });
  }
}

customElements.define('executions-panel', ExecutionsPanel);
