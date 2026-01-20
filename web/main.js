// Main entry point - initialize application

// Import all Web Components
import './components/app-shell.js';
import './components/brain-list.js';
import './components/login-form.js';
import './components/editor/brain-editor.js';
import './components/editor/neuron-panel.js';
import './components/editor/three-canvas.js';
import './components/chat/chat-view.js';
import './components/live/live-view.js';
import './components/live/neuron-inspector.js';
import './components/executions-panel.js';

// Remove loading state once components are registered
document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('app-loading');
  if (loading) {
    loading.style.display = 'none';
  }

  const app = document.getElementById('app');
  if (app) {
    app.style.display = 'block';
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Log app initialization
console.log(
  '%cWormsBatsAndFlies',
  'font-size: 24px; font-weight: bold; color: #6366f1;'
);
console.log(
  '%cLLM Orchestration System',
  'font-size: 14px; color: #a0a0b0;'
);
console.log(
  '%cInspired by Neal Stephenson\'s Anathem',
  'font-size: 12px; color: #606070; font-style: italic;'
);
