// Main application shell component

import { api } from '../lib/api-client.js';
import { appState, setAuthenticated, navigateTo, setCurrentBrain, toggleExecutionsPanel } from '../lib/state.js';
import { router } from '../lib/router.js';

class AppShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedBrainData = null;
    this.brainExecutions = [];
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.checkAuth();
  }

  setupListeners() {
    // Only update view when view-related properties change
    // This prevents recreating WebGL contexts on every state change (e.g., neuron selection)
    let lastView = null;
    let lastBrainId = null;
    let lastExecId = null;
    let lastShowExecPanel = null;

    appState.subscribe((state) => {
      const viewChanged = state.currentView !== lastView;
      const brainChanged = state.currentBrainId !== lastBrainId;
      const execChanged = state.currentExecId !== lastExecId;
      const execPanelChanged = state.showExecutionsPanel !== lastShowExecPanel;

      if (viewChanged || brainChanged || execChanged) {
        lastView = state.currentView;
        lastBrainId = state.currentBrainId;
        lastExecId = state.currentExecId;
        this.updateView(state);
      }

      if (execPanelChanged) {
        lastShowExecPanel = state.showExecutionsPanel;
        this.updateExecutionsPanel(state.showExecutionsPanel);
      }
    });

    // Route changes
    window.addEventListener('route:home', () => {
      if (appState.getState().isAuthenticated) {
        router.navigate('/brains');
      } else {
        router.navigate('/login');
      }
    });

    window.addEventListener('route:login', () => {
      navigateTo('login');
    });

    window.addEventListener('route:brains', () => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('brains');
    });

    window.addEventListener('route:brains-detail', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('brains', { currentBrainId: e.detail.id });
      this.loadBrainForDetail(e.detail.id);
    });

    window.addEventListener('route:editor', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('editor', { currentBrainId: e.detail.id });
    });

    window.addEventListener('route:exec', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('execution', {
        currentBrainId: e.detail.id,
        currentExecId: e.detail.execId || null,
      });
    });

    window.addEventListener('route:chat', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('chat', {
        currentBrainId: e.detail.id,
        currentExecId: e.detail.execId || null,
      });
    });

    window.addEventListener('route:executions', () => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('executions');
    });

    window.addEventListener('route:live', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('live', {
        currentBrainId: e.detail.id,
        currentExecId: e.detail.execId || null,
      });
    });

    // Auth events
    window.addEventListener('auth:logout', () => {
      setAuthenticated(false);
      router.navigate('/login');
    });

    // Start router
    router.start();
  }

  async checkAuth() {
    if (api.isAuthenticated()) {
      const valid = await api.verifyToken();
      if (valid) {
        setAuthenticated(true);
        if (router.getPath() === '/' || router.getPath() === '/login') {
          router.navigate('/brains');
        }
      } else {
        router.navigate('/login');
      }
    } else {
      router.navigate('/login');
    }
  }

  updateView(state) {
    const content = this.shadowRoot.querySelector('.content');
    if (!content) return;

    // Clear content
    content.innerHTML = '';

    // Render appropriate view
    switch (state.currentView) {
      case 'login':
        content.innerHTML = '<login-form></login-form>';
        break;
      case 'brains':
        content.innerHTML = this.renderBrainsView();
        // If we have a brain selected, load its detail
        if (state.currentBrainId) {
          this.loadBrainForDetail(state.currentBrainId);
        }
        // Add execution list item click handlers after render
        setTimeout(() => {
          this.shadowRoot.querySelectorAll('.execution-list-item').forEach(item => {
            item.addEventListener('click', () => {
              const execId = item.dataset.execId;
              if (this.selectedBrainData) {
                router.navigate(`/brains/${this.selectedBrainData.id}/exec/${execId}`);
              }
            });
          });
        }, 0);
        break;
      case 'editor':
        content.innerHTML = `<brain-editor brain-id="${state.currentBrainId}"></brain-editor>`;
        break;
      case 'execution':
        content.innerHTML = `<execution-view brain-id="${state.currentBrainId}" exec-id="${state.currentExecId || ''}"></execution-view>`;
        break;
      case 'chat':
        content.innerHTML = `<chat-view brain-id="${state.currentBrainId}" exec-id="${state.currentExecId || ''}"></chat-view>`;
        break;
      case 'live':
        content.innerHTML = `<live-view brain-id="${state.currentBrainId}" exec-id="${state.currentExecId || ''}"></live-view>`;
        break;
      case 'executions':
        content.innerHTML = this.renderExecutionsView();
        break;
      default:
        content.innerHTML = '<login-form></login-form>';
    }
  }

  renderBrainsView() {
    const showExecPanel = appState.getState().showExecutionsPanel;
    return `
      <div class="app-container">
        <header class="app-header">
          <div class="app-header__logo">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 0 20"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span>WormsBatsAndFlies</span>
          </div>
          <div class="app-header__actions">
            <button class="btn ${showExecPanel ? 'btn--primary' : 'btn--secondary'}" id="executions-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Executions
            </button>
            <button class="btn btn--ghost" id="logout-btn">Logout</button>
          </div>
        </header>
        <main class="app-main">
          <aside class="app-sidebar">
            <div class="app-sidebar__header">
              <h2>Brains</h2>
              <button class="btn btn--primary btn--sm" id="new-brain-btn">+ New</button>
            </div>
            <div class="app-sidebar__content">
              <brain-list></brain-list>
            </div>
          </aside>
          <div class="app-content" id="brain-content">
            <div class="empty-state">
              <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 0 20"/>
                <circle cx="12" cy="12" r="4"/>
                <line x1="12" y1="8" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="16" y2="12"/>
              </svg>
              <h3 class="empty-state__title">Select a Brain</h3>
              <p class="empty-state__description">Choose a brain from the sidebar or create a new one to get started.</p>
            </div>
          </div>
          <aside class="app-right-panel ${showExecPanel ? 'app-right-panel--open' : ''}" id="executions-panel">
            <executions-panel></executions-panel>
          </aside>
        </main>
      </div>
    `;
  }

  updateExecutionsPanel(show) {
    const panel = this.shadowRoot.querySelector('#executions-panel');
    const btn = this.shadowRoot.querySelector('#executions-btn');
    if (panel) {
      panel.classList.toggle('app-right-panel--open', show);
    }
    if (btn) {
      btn.classList.toggle('btn--primary', show);
      btn.classList.toggle('btn--secondary', !show);
    }
  }

  async loadBrainForDetail(brainId) {
    if (!brainId) {
      this.selectedBrainData = null;
      this.brainExecutions = [];
      this.renderBrainContent();
      return;
    }

    try {
      const [brain, executions] = await Promise.all([
        api.getBrain(brainId),
        api.listExecutions(brainId)
      ]);
      this.selectedBrainData = brain;
      this.brainExecutions = executions.filter(e => e.brainId === brainId);
      setCurrentBrain(brain);
      this.renderBrainContent();
    } catch (error) {
      console.error('Failed to load brain:', error);
    }
  }

  renderBrainContent() {
    const content = this.shadowRoot.querySelector('#brain-content');
    if (!content) return;

    if (!this.selectedBrainData) {
      content.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="8" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="16" y2="12"/>
          </svg>
          <h3 class="empty-state__title">Select a Brain</h3>
          <p class="empty-state__description">Choose a brain from the sidebar or create a new one to get started.</p>
        </div>
      `;
      return;
    }

    const brain = this.selectedBrainData;
    content.innerHTML = `
      <div class="brain-detail">
        <div class="brain-detail__header">
          <h1 class="brain-detail__title">${this.escapeHtml(brain.name)}</h1>
          <div class="brain-detail__actions">
            <button class="btn btn--secondary" id="edit-brain-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Brain
            </button>
          </div>
        </div>

        <div class="brain-detail__prompt">
          <label class="form-label">Start a new execution</label>
          <div class="brain-detail__prompt-container">
            <textarea
              class="input brain-detail__prompt-input"
              id="start-prompt"
              placeholder="Enter your initial message to start an execution..."
              rows="2"
            ></textarea>
            <button class="btn btn--primary btn--lg" id="start-exec-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run
            </button>
          </div>
        </div>

        <div class="brain-detail__executions">
          <h3 class="brain-detail__executions-header">Previous Executions</h3>
          <div class="brain-detail__executions-list" id="brain-executions-list">
            ${this.renderBrainExecutionsList()}
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    content.querySelector('#edit-brain-btn').addEventListener('click', () => {
      router.navigate(`/brains/${brain.id}/edit`);
    });

    content.querySelector('#start-exec-btn').addEventListener('click', () => {
      this.startBrainExecution();
    });

    content.querySelector('#start-prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.startBrainExecution();
      }
    });
  }

  renderBrainExecutionsList() {
    if (this.brainExecutions.length === 0) {
      return `
        <div class="empty-state" style="padding: var(--space-8);">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p style="margin-top: var(--space-3); color: var(--color-text-muted); font-size: var(--text-sm);">
            No executions yet. Start one above!
          </p>
        </div>
      `;
    }

    return this.brainExecutions.map(exec => {
      const statusClass = exec.status === 'running' ? 'badge--success' :
                         exec.status === 'paused' ? 'badge--warning' :
                         exec.status === 'completed' ? 'badge--info' : '';
      const date = new Date(exec.startedAt);
      const timeAgo = this.formatTimeAgo(date);

      return `
        <div class="execution-list-item card card--interactive" data-exec-id="${exec.id}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <span class="badge ${statusClass}">${exec.status}</span>
            <span style="font-size: var(--text-xs); color: var(--color-text-muted);">${timeAgo}</span>
          </div>
          <div style="font-size: var(--text-sm); color: var(--color-text-secondary);">
            Step ${exec.currentStep} | Started ${date.toLocaleString()}
          </div>
        </div>
      `;
    }).join('');
  }

  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async startBrainExecution() {
    if (!this.selectedBrainData) return;

    const input = this.shadowRoot.querySelector('#start-prompt');
    const message = input?.value?.trim();
    if (!message) return;

    try {
      const execution = await api.startExecution(this.selectedBrainData.id, {
        initialInput: message,
      });

      // Navigate to execution view
      router.navigate(`/brains/${this.selectedBrainData.id}/exec/${execution.id}`);
      window.dispatchEvent(new CustomEvent('executions:refresh'));
    } catch (error) {
      console.error('Failed to start execution:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderExecutionsView() {
    return `
      <div class="app-container">
        <header class="app-header">
          <div class="app-header__logo">
            <button class="btn btn--ghost" id="back-btn">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
            <span>Active Executions</span>
          </div>
          <div class="app-header__actions">
            <button class="btn btn--ghost" id="logout-btn">Logout</button>
          </div>
        </header>
        <main class="app-main executions-main">
          <executions-panel></executions-panel>
        </main>
      </div>
    `;
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
          height: 100vh;
        }

        .content {
          height: 100%;
        }
      </style>
      <div class="content"></div>
    `;

    // Setup event delegation
    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.id === 'logout-btn') {
        api.logout();
      }
      if (e.target.id === 'new-brain-btn') {
        this.createNewBrain();
      }
      if (e.target.id === 'executions-btn' || e.target.closest('#executions-btn')) {
        toggleExecutionsPanel();
      }
      if (e.target.id === 'back-btn' || e.target.closest('#back-btn')) {
        router.navigate('/brains');
      }
    });
  }

  async createNewBrain() {
    try {
      const brain = await api.createBrain({
        name: 'New Brain',
        description: 'A new neural network',
        neurons: [
          {
            name: 'Input',
            type: 'text_input',
            systemPrompt: 'You receive user input and pass it to the network.',
            model: 'openai/gpt-4o-mini',
            memoryLength: 5,
            position: { x: 0, y: 0, z: 0 },
            color: '#3b82f6',
          },
          {
            name: 'Output',
            type: 'text_output',
            systemPrompt: 'You generate the final response based on inputs from other neurons.',
            model: 'openai/gpt-4o-mini',
            memoryLength: 5,
            position: { x: 3, y: 0, z: 0 },
            color: '#22c55e',
          },
        ],
        connections: [],
      });

      // Dispatch event for brain list to refresh
      window.dispatchEvent(new CustomEvent('brains:refresh'));

      // Navigate to editor
      router.navigate(`/brains/${brain.id}/edit`);
    } catch (error) {
      console.error('Failed to create brain:', error);
    }
  }
}

customElements.define('app-shell', AppShell);
