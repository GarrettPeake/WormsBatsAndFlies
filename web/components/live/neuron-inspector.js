// Neuron state inspector panel for live view

class NeuronInspector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.neuron = null;
    this.state = null;
  }

  connectedCallback() {
    this.render();
  }

  setNeuron(neuron, state) {
    this.neuron = neuron;
    this.state = state;
    this.updateDisplay();
  }

  updateDisplay() {
    const content = this.shadowRoot.querySelector('.inspector-content');
    if (!content) return;

    if (!this.neuron) {
      content.innerHTML = this.renderEmptyState();
      return;
    }

    content.innerHTML = this.renderNeuronInfo();
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p class="empty-state__title">No Neuron Selected</p>
        <p class="empty-state__description">Click on a neuron to inspect its state</p>
      </div>
    `;
  }

  renderNeuronInfo() {
    const n = this.neuron;
    const s = this.state || {};

    const statusColors = {
      idle: 'var(--color-neuron-idle)',
      queued: 'var(--color-neuron-queued)',
      processing: 'var(--color-neuron-processing)',
      fired: 'var(--color-neuron-fired)',
      error: 'var(--color-neuron-error)',
    };

    return `
      <div class="neuron-header">
        <div class="neuron-color" style="background-color: ${n.color || '#6366f1'}"></div>
        <div class="neuron-title">
          <h3>${this.escapeHtml(n.name)}</h3>
          <span class="neuron-type badge badge--info">${n.type}</span>
        </div>
      </div>

      <div class="section">
        <h4>Status</h4>
        <div class="status-row">
          <span class="status-dot" style="background-color: ${statusColors[s.status] || statusColors.idle}"></span>
          <span class="status-text">${s.status || 'idle'}</span>
        </div>
      </div>

      <div class="section">
        <h4>Metrics</h4>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-value">${s.totalFireCount || 0}</span>
            <span class="metric-label">Fires</span>
          </div>
          <div class="metric">
            <span class="metric-value">${s.totalTokensUsed || 0}</span>
            <span class="metric-label">Tokens</span>
          </div>
          <div class="metric">
            <span class="metric-value">${Math.round(s.averageResponseTimeMs || 0)}ms</span>
            <span class="metric-label">Avg Time</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4>Input Queue (${(s.inputQueue || []).length})</h4>
        <div class="queue-list">
          ${(s.inputQueue || []).length === 0
            ? '<p class="empty-text">No queued inputs</p>'
            : (s.inputQueue || []).map(msg => `
              <div class="queue-item">
                <span class="queue-source">${this.escapeHtml(msg.sourceNeuronName)}:</span>
                <span class="queue-content">${this.truncate(msg.content, 100)}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

      <div class="section">
        <h4>Memory (${(s.memory || []).length}/${n.memoryLength})</h4>
        <div class="memory-list">
          ${(s.memory || []).length === 0
            ? '<p class="empty-text">No memory entries</p>'
            : (s.memory || []).slice(-5).reverse().map(entry => `
              <div class="memory-item">
                <span class="memory-step">Step ${entry.step}</span>
                <span class="memory-content">${this.truncate(entry.selfUpdate, 150)}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

      ${s.lastOutput ? `
        <div class="section">
          <h4>Last Output</h4>
          <div class="output-content">${this.escapeHtml(s.lastOutput)}</div>
        </div>
      ` : ''}

      ${s.lastSelfUpdate ? `
        <div class="section">
          <h4>Last Self-Update</h4>
          <div class="output-content">${this.escapeHtml(s.lastSelfUpdate)}</div>
        </div>
      ` : ''}
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return this.escapeHtml(text);
    return this.escapeHtml(text.slice(0, maxLength)) + '...';
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
        }

        .inspector {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .inspector-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .inspector-header h3 {
          font-size: var(--text-base);
          font-weight: 600;
        }

        .inspector-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .neuron-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .neuron-color {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .neuron-title h3 {
          font-size: var(--text-base);
          font-weight: 600;
          margin-bottom: var(--space-1);
        }

        .section {
          margin-bottom: var(--space-4);
        }

        .section h4 {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-2);
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .status-text {
          font-size: var(--text-sm);
          text-transform: capitalize;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-3);
        }

        .metric {
          text-align: center;
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .metric-value {
          display: block;
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-primary);
        }

        .metric-label {
          display: block;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: var(--space-1);
        }

        .queue-list,
        .memory-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-height: 150px;
          overflow-y: auto;
        }

        .queue-item,
        .memory-item {
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
        }

        .queue-source,
        .memory-step {
          display: block;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-1);
        }

        .queue-content,
        .memory-content {
          color: var(--color-text-primary);
          word-break: break-word;
        }

        .output-content {
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .empty-text {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-style: italic;
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

      <div class="inspector">
        <div class="inspector-header">
          <h3>Neuron Inspector</h3>
        </div>
        <div class="inspector-content">
          ${this.renderEmptyState()}
        </div>
      </div>
    `;
  }
}

customElements.define('neuron-inspector', NeuronInspector);
