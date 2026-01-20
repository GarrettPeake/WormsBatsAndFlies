// Main application shell component

import { api } from '../lib/api-client.js';
import { appState, setAuthenticated, navigateTo } from '../lib/state.js';
import { router } from '../lib/router.js';

class AppShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
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

    appState.subscribe((state) => {
      const viewChanged = state.currentView !== lastView;
      const brainChanged = state.currentBrainId !== lastBrainId;
      const execChanged = state.currentExecId !== lastExecId;

      if (viewChanged || brainChanged || execChanged) {
        lastView = state.currentView;
        lastBrainId = state.currentBrainId;
        lastExecId = state.currentExecId;
        this.updateView(state);
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

    window.addEventListener('route:editor', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('editor', { currentBrainId: e.detail.id });
    });

    window.addEventListener('route:chat', (e) => {
      if (!appState.getState().isAuthenticated) {
        router.navigate('/login');
        return;
      }
      navigateTo('chat', { currentBrainId: e.detail.id });
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
        break;
      case 'editor':
        content.innerHTML = `<brain-editor brain-id="${state.currentBrainId}"></brain-editor>`;
        break;
      case 'chat':
        content.innerHTML = `<chat-view brain-id="${state.currentBrainId}"></chat-view>`;
        break;
      case 'live':
        content.innerHTML = `<live-view brain-id="${state.currentBrainId}" exec-id="${state.currentExecId || ''}"></live-view>`;
        break;
      default:
        content.innerHTML = '<login-form></login-form>';
    }
  }

  renderBrainsView() {
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
          <div class="app-content">
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
