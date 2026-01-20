// WebGL canvas component for 3D brain visualization

import { Renderer } from '../../webgl/renderer.js';
import { appState, setSelectedNeuron } from '../../lib/state.js';

class WebGLCanvas extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.renderer = null;
    this.brain = null;

    // Bound event handlers for cleanup
    this._onBrainUpdated = (e) => {
      if (e.detail) {
        this.brain = e.detail;
        this.updateRenderer();
      }
    };

    this._onNeuronUpdated = (e) => {
      if (this.brain && e.detail) {
        const index = this.brain.neurons.findIndex(n => n.id === e.detail.id);
        if (index >= 0) {
          this.brain.neurons[index] = e.detail;
          this.updateRenderer();
        }
      }
    };

    this._onStateChange = (state) => {
      if (this.renderer) {
        this.renderer.setSelectedNeuron(state.selectedNeuronId);
      }
    };

    this._unsubscribeState = null;
  }

  connectedCallback() {
    this.render();
    this.initRenderer();

    // Listen for brain updates
    window.addEventListener('brain:updated', this._onBrainUpdated);
    window.addEventListener('neuron:updated', this._onNeuronUpdated);

    // Listen for selection changes
    this._unsubscribeState = appState.subscribe(this._onStateChange);
  }

  disconnectedCallback() {
    // Remove event listeners to prevent memory leaks
    window.removeEventListener('brain:updated', this._onBrainUpdated);
    window.removeEventListener('neuron:updated', this._onNeuronUpdated);

    // Unsubscribe from state changes
    if (this._unsubscribeState) {
      this._unsubscribeState();
      this._unsubscribeState = null;
    }

    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }

  initRenderer() {
    const canvas = this.shadowRoot.querySelector('canvas');
    if (!canvas) return;

    this.renderer = new Renderer(canvas);

    // Handle neuron selection
    this.renderer.onNeuronSelect = (neuronId) => {
      setSelectedNeuron(neuronId);
    };

    // Handle neuron hover
    this.renderer.onNeuronHover = (neuronId) => {
      // Could show tooltip or highlight
    };

    this.renderer.start();
  }

  setBrain(brain) {
    this.brain = brain;
    this.updateRenderer();
  }

  updateRenderer() {
    if (!this.renderer || !this.brain) return;

    this.renderer.setNeurons(this.brain.neurons);
    this.renderer.setConnections(this.brain.connections);
  }

  resetCamera() {
    if (this.renderer) {
      this.renderer.resetCamera();
    }
  }

  focusNeuron(neuronId) {
    if (this.renderer) {
      this.renderer.focusNeuron(neuronId);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }

        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
      <canvas></canvas>
    `;
  }
}

customElements.define('webgl-canvas', WebGLCanvas);
