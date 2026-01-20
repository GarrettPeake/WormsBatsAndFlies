// Chat interface component

import { api } from '../../lib/api-client.js';
import { ExecutionWebSocket } from '../../lib/websocket.js';
import { router } from '../../lib/router.js';

class ChatView extends HTMLElement {
  static get observedAttributes() {
    return ['brain-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.brain = null;
    this.messages = [];
    this.execution = null;
    this.ws = null;
    this.isLoading = false;
  }

  connectedCallback() {
    this.render();
    this.loadBrain();
  }

  disconnectedCallback() {
    if (this.ws) {
      this.ws.disconnect();
    }
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
      this.updateHeader();
    } catch (error) {
      console.error('Failed to load brain:', error);
    }
  }

  updateHeader() {
    const header = this.shadowRoot.querySelector('.chat-header h2');
    if (header && this.brain) {
      header.textContent = `Chat with ${this.brain.name}`;
    }
  }

  async sendMessage() {
    const input = this.shadowRoot.querySelector('.message-input');
    const content = input.value.trim();

    if (!content || this.isLoading || !this.brain) return;

    // Add user message
    this.addMessage('user', content);
    input.value = '';

    this.isLoading = true;
    this.updateInputState();

    try {
      // Start execution
      this.execution = await api.startExecution(this.brain.id, {
        initialInput: content,
      });

      // Connect WebSocket for streaming updates
      this.ws = new ExecutionWebSocket(this.execution.id, api.getToken());

      let assistantMessage = '';
      const messageId = this.addMessage('assistant', '', true);

      this.ws.on('final_output', (data) => {
        assistantMessage = data.content;
        this.updateMessage(messageId, assistantMessage);
      });

      this.ws.on('execution_fizzled', () => {
        this.isLoading = false;
        this.updateInputState();
        this.updateMessage(messageId, assistantMessage, false);
        this.ws.disconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.isLoading = false;
        this.updateInputState();
        this.ws.disconnect();
      });

      this.ws.connect();
    } catch (error) {
      console.error('Failed to send message:', error);
      this.isLoading = false;
      this.updateInputState();
      this.addMessage('assistant', 'Sorry, there was an error processing your message.');
    }
  }

  addMessage(role, content, isStreaming = false) {
    const id = Date.now().toString();
    const message = { id, role, content, isStreaming };
    this.messages.push(message);
    this.renderMessages();
    return id;
  }

  updateMessage(id, content, isStreaming = true) {
    const message = this.messages.find(m => m.id === id);
    if (message) {
      message.content = content;
      message.isStreaming = isStreaming;
      this.renderMessages();
    }
  }

  renderMessages() {
    const container = this.shadowRoot.querySelector('.messages');
    if (!container) return;

    container.innerHTML = this.messages.map(msg => `
      <div class="message message--${msg.role}">
        <div class="message__content">
          ${this.escapeHtml(msg.content)}
          ${msg.isStreaming ? '<span class="typing-indicator">...</span>' : ''}
        </div>
      </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  updateInputState() {
    const input = this.shadowRoot.querySelector('.message-input');
    const sendBtn = this.shadowRoot.querySelector('.send-btn');

    if (input) input.disabled = this.isLoading;
    if (sendBtn) {
      sendBtn.disabled = this.isLoading;
      sendBtn.innerHTML = this.isLoading
        ? '<span class="spinner"></span>'
        : this.getSendIcon();
    }
  }

  getSendIcon() {
    return `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    `;
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
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
        }

        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .chat-header h2 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .chat-header__actions {
          display: flex;
          gap: var(--space-2);
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .message {
          max-width: 80%;
        }

        .message--user {
          align-self: flex-end;
        }

        .message--assistant {
          align-self: flex-start;
        }

        .message__content {
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .message--user .message__content {
          background-color: var(--color-primary);
          color: white;
          border-bottom-right-radius: var(--radius-sm);
        }

        .message--assistant .message__content {
          background-color: var(--color-bg-tertiary);
          border-bottom-left-radius: var(--radius-sm);
        }

        .typing-indicator {
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .chat-input {
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
        }

        .input-container {
          display: flex;
          gap: var(--space-3);
          align-items: flex-end;
        }

        .message-input {
          flex: 1;
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          border-radius: var(--radius-lg);
          resize: none;
          min-height: 44px;
          max-height: 200px;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-primary);
          color: white;
          transition: background-color var(--transition-fast);
        }

        .send-btn:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
        }

        .empty-state__icon {
          margin-bottom: var(--space-4);
          opacity: 0.5;
        }
      </style>

      <div class="chat-container">
        <header class="chat-header">
          <h2>Chat with Brain</h2>
          <div class="chat-header__actions">
            <button class="btn btn--secondary" id="edit-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
            <button class="btn btn--secondary" id="live-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Live View
            </button>
          </div>
        </header>

        <div class="messages">
          <div class="empty-state">
            <svg class="empty-state__icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Send a message to start chatting with this brain</p>
          </div>
        </div>

        <div class="chat-input">
          <div class="input-container">
            <textarea
              class="input message-input"
              placeholder="Type your message..."
              rows="1"
            ></textarea>
            <button class="send-btn" type="button">
              ${this.getSendIcon()}
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const sendBtn = this.shadowRoot.querySelector('.send-btn');
    const input = this.shadowRoot.querySelector('.message-input');

    sendBtn.addEventListener('click', () => this.sendMessage());

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

    // Navigation buttons
    this.shadowRoot.getElementById('edit-btn').addEventListener('click', () => {
      if (this.brain) {
        router.navigate(`/brains/${this.brain.id}/edit`);
      }
    });

    this.shadowRoot.getElementById('live-btn').addEventListener('click', () => {
      if (this.brain) {
        router.navigate(`/brains/${this.brain.id}/live`);
      }
    });
  }
}

customElements.define('chat-view', ChatView);
