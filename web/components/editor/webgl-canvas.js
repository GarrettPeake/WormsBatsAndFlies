// WebGL canvas component for 3D brain visualization

import { Renderer } from '../../webgl/renderer.js';
import { appState, setSelectedNeuron } from '../../lib/state.js';

class WebGLCanvas extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.renderer = null;
    this.brain = null;
  }

  connectedCallback() {
    this.render();
    this.initRenderer();

    // Listen for brain updates
    window.addEventListener('brain:updated', (e) => {
      if (e.detail) {
        this.brain = e.detail;
        this.updateRenderer();
      }
    });

    window.addEventListener('neuron:updated', (e) => {
      if (this.brain && e.detail) {
        const index = this.brain.neurons.findIndex(n => n.id === e.detail.id);
        if (index >= 0) {
          this.brain.neurons[index] = e.detail;
          this.updateRenderer();
        }
      }
    });

    // Listen for selection changes
    appState.subscribe((state) => {
      if (this.renderer) {
        this.renderer.setSelectedNeuron(state.selectedNeuronId);
      }
    });
  }

  disconnectedCallback() {
    if (this.renderer) {
      this.renderer.destroy();
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
