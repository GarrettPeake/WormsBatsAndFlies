// Brain list sidebar component

import { api } from '../lib/api-client.js';
import { appState, setCurrentBrain } from '../lib/state.js';
import { router } from '../lib/router.js';

class BrainList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.brains = [];
  }

  connectedCallback() {
    this.render();
    this.loadBrains();

    // Listen for refresh events
    window.addEventListener('brains:refresh', () => this.loadBrains());

    // Listen for state changes
    appState.subscribe((state) => {
      this.updateSelection(state.currentBrainId);
    });
  }

  async loadBrains() {
    try {
      this.brains = await api.listBrains();
      this.renderBrains();
    } catch (error) {
      console.error('Failed to load brains:', error);
    }
  }

  updateSelection(brainId) {
    const items = this.shadowRoot.querySelectorAll('.brain-item');
    items.forEach(item => {
      if (item.dataset.id === brainId) {
        item.classList.add('list-item--active');
      } else {
        item.classList.remove('list-item--active');
      }
    });
  }

  renderBrains() {
    const list = this.shadowRoot.querySelector('.brain-list');
    if (!list) return;

    if (this.brains.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <p>No brains yet.</p>
          <p>Create one to get started!</p>
        </div>
      `;
      return;
    }

    const currentBrainId = appState.getState().currentBrainId;

    list.innerHTML = this.brains.map(brain => `
      <div class="brain-item list-item ${brain.id === currentBrainId ? 'list-item--active' : ''}" data-id="${brain.id}">
        <div class="list-item__icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="list-item__content">
          <div class="list-item__title">${this.escapeHtml(brain.name)}</div>
          <div class="list-item__subtitle">${brain.neurons?.length || 0} neurons</div>
        </div>
        <div class="brain-actions">
          <button class="btn btn--ghost btn--icon edit-btn" data-id="${brain.id}" title="Edit">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn--ghost btn--icon chat-btn" data-id="${brain.id}" title="Chat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="btn btn--ghost btn--icon delete-btn" data-id="${brain.id}" title="Delete">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import '/css/variables.css';
        @import '/css/components.css';

        :host {
          display: block;
        }

        .brain-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .brain-item {
          position: relative;
        }

        .brain-actions {
          display: none;
          gap: var(--space-1);
        }

        .brain-item:hover .brain-actions {
          display: flex;
        }

        .empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--color-text-muted);
          font-size: var(--text-sm);
        }

        .empty p {
          margin-bottom: var(--space-2);
        }
      </style>
      <div class="brain-list">
        <div class="empty">
          <div class="spinner"></div>
          <p>Loading brains...</p>
        </div>
      </div>
    `;

    // Event delegation
    this.shadowRoot.addEventListener('click', (e) => {
      const brainItem = e.target.closest('.brain-item');
      const editBtn = e.target.closest('.edit-btn');
      const chatBtn = e.target.closest('.chat-btn');
      const deleteBtn = e.target.closest('.delete-btn');

      if (deleteBtn) {
        e.stopPropagation();
        this.deleteBrain(deleteBtn.dataset.id);
      } else if (editBtn) {
        e.stopPropagation();
        router.navigate(`/brains/${editBtn.dataset.id}/edit`);
      } else if (chatBtn) {
        e.stopPropagation();
        router.navigate(`/brains/${chatBtn.dataset.id}/chat`);
      } else if (brainItem) {
        // Navigate to brain detail view instead of editor
        router.navigate(`/brains/${brainItem.dataset.id}`);
      }
    });
  }

  async deleteBrain(id) {
    if (!confirm('Are you sure you want to delete this brain?')) {
      return;
    }

    try {
      await api.deleteBrain(id);
      this.brains = this.brains.filter(b => b.id !== id);
      this.renderBrains();

      // Clear selection if deleted brain was selected
      if (appState.getState().currentBrainId === id) {
        setCurrentBrain(null);
        router.navigate('/brains');
      }
    } catch (error) {
      console.error('Failed to delete brain:', error);
    }
  }
}

customElements.define('brain-list', BrainList);
