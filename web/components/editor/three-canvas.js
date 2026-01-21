// Three.js canvas component for 3D brain visualization

import { Renderer } from '../../three/renderer.js';
import { api } from '../../lib/api-client.js';
import { appState, setSelectedNeuron } from '../../lib/state.js';

class ThreeCanvas extends HTMLElement {
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
      if (this.brain && e.detail && this.renderer) {
        const index = this.brain.neurons.findIndex(n => n.id === e.detail.id);
        if (index >= 0) {
          this.brain.neurons[index] = e.detail;
          // Use incremental update instead of full rebuild to avoid memory leak
          this.renderer.updateNeuron(e.detail);
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

    // Destroy existing renderer to prevent WebGL context leaks
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    this.renderer = new Renderer(canvas, { enableEditing: true });

    // Handle neuron selection
    this.renderer.onNeuronSelect = (neuronId) => {
      setSelectedNeuron(neuronId);
    };

    // Handle neuron hover
    this.renderer.onNeuronHover = (neuronId) => {
      // Could show tooltip or highlight
    };

    // Handle neuron position change (from gizmo drag)
    this.renderer.onNeuronMove = (neuronId, position) => {
      if (!this.brain) return;

      const neuron = this.brain.neurons.find(n => n.id === neuronId);
      if (neuron) {
        neuron.position = { ...position };
        // Dispatch event for autosave
        window.dispatchEvent(new CustomEvent('neuron:updated', { detail: neuron }));
      }
    };

    // Handle connection creation (shift+click)
    this.renderer.onConnectionCreate = async (sourceNeuronId, targetNeuronId) => {
      if (!this.brain) return;

      // Check if connection already exists
      const exists = this.brain.connections.some(
        c => c.sourceNeuronId === sourceNeuronId && c.targetNeuronId === targetNeuronId
      );
      if (exists) return;

      try {
        const connection = await api.addConnection(this.brain.id, {
          sourceNeuronId,
          targetNeuronId,
        });

        this.brain.connections.push(connection);
        this.updateRenderer();

        // Dispatch event for autosave and UI update
        window.dispatchEvent(new CustomEvent('brain:updated', { detail: this.brain }));
      } catch (error) {
        console.error('Failed to add connection:', error);
      }
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

customElements.define('three-canvas', ThreeCanvas);
