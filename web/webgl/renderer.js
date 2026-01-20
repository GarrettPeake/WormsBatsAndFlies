// Main WebGL renderer

import { Camera } from './camera.js';
import { SphereRenderer } from './sphere.js';
import { LineRenderer } from './line.js';
import { TextRenderer } from './text.js';
import { Picking } from './picking.js';
import { vec3Sub, vec3Normalize, vec3Scale, vec3Add, vec3Length } from '../utils/math.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
    });

    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }

    this.camera = new Camera(canvas);
    this.sphereRenderer = null;
    this.lineRenderer = null;
    this.textRenderer = null;
    this.picking = null;

    this.neurons = [];
    this.connections = [];
    this.selectedNeuronId = null;
    this.hoveredNeuronId = null;

    this.neuronIdMap = new Map(); // Maps picking ID to neuron ID

    this.animationFrame = null;
    this.onNeuronSelect = null;
    this.onNeuronHover = null;

    // Bound event handlers (stored for cleanup)
    this._boundOnClick = this.onClick.bind(this);
    this._boundOnMouseMove = this.onMouseMove.bind(this);
    this._boundOnResize = this.resize.bind(this);

    // Throttle state for mousemove picking
    this._lastPickTime = 0;
    this._pickThrottleMs = 50; // Max 20 picks per second

    this.init();
  }

  init() {
    const gl = this.gl;

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Set clear color (dark background)
    gl.clearColor(0.04, 0.04, 0.06, 1.0);

    // Initialize renderers
    this.sphereRenderer = new SphereRenderer(gl);
    this.lineRenderer = new LineRenderer(gl);
    this.textRenderer = new TextRenderer(gl);
    this.picking = new Picking(gl, this.canvas.width, this.canvas.height);

    // Set up event listeners
    this.canvas.addEventListener('click', this._boundOnClick);
    this.canvas.addEventListener('mousemove', this._boundOnMouseMove);

    // Handle resize
    this.resize();
    window.addEventListener('resize', this._boundOnResize);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.picking.resize(this.canvas.width, this.canvas.height);
  }

  /**
   * Set neurons to render
   */
  setNeurons(neurons) {
    this.neurons = neurons;
    this.neuronIdMap.clear();

    // Build picking ID map (start from 1, 0 is reserved for "no pick")
    neurons.forEach((neuron, index) => {
      this.neuronIdMap.set(index + 1, neuron.id);
    });
  }

  /**
   * Set connections to render
   */
  setConnections(connections) {
    this.connections = connections;
  }

  /**
   * Set the selected neuron
   */
  setSelectedNeuron(neuronId) {
    this.selectedNeuronId = neuronId;
  }

  /**
   * Set neuron status (for live view)
   */
  setNeuronStatus(neuronId, status) {
    const neuron = this.neurons.find(n => n.id === neuronId);
    if (neuron) {
      neuron.status = status;
    }
  }

  /**
   * Get picking ID for a neuron
   */
  getPickingId(neuronId) {
    for (const [pickId, nId] of this.neuronIdMap) {
      if (nId === neuronId) return pickId;
    }
    return 0;
  }

  /**
   * Handle click for selection
   */
  onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    // Render picking pass
    this.renderPicking();

    const pickId = this.picking.pick(x, y);
    const neuronId = pickId ? this.neuronIdMap.get(pickId) : null;

    if (this.onNeuronSelect) {
      this.onNeuronSelect(neuronId);
    }
  }

  /**
   * Handle mouse move for hover (throttled to prevent excessive GPU work)
   */
  onMouseMove(e) {
    // Throttle picking to avoid excessive GPU readbacks
    const now = performance.now();
    if (now - this._lastPickTime < this._pickThrottleMs) {
      return;
    }
    this._lastPickTime = now;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    // Render picking pass
    this.renderPicking();

    const pickId = this.picking.pick(x, y);
    const neuronId = pickId ? this.neuronIdMap.get(pickId) : null;

    if (neuronId !== this.hoveredNeuronId) {
      this.hoveredNeuronId = neuronId;
      this.canvas.style.cursor = neuronId ? 'pointer' : 'default';

      if (this.onNeuronHover) {
        this.onNeuronHover(neuronId);
      }
    }
  }

  /**
   * Render picking pass
   */
  renderPicking() {
    const viewProjection = this.camera.getViewProjectionMatrix();

    this.picking.begin();

    // Render neurons with picking IDs
    const spheres = this.neurons.map((neuron, index) => ({
      id: index + 1,
      position: neuron.position,
      radius: 0.5,
      color: [1, 1, 1],
    }));

    this.sphereRenderer.renderBatch(viewProjection, spheres, true);

    this.picking.end();
  }

  /**
   * Render the scene
   */
  render() {
    const gl = this.gl;
    const viewProjection = this.camera.getViewProjectionMatrix();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Render connections first (behind spheres)
    this.renderConnections(viewProjection);

    // Render neurons
    this.renderNeurons(viewProjection);

    // Render labels
    this.renderLabels(viewProjection);
  }

  renderNeurons(viewProjection) {
    const spheres = this.neurons.map(neuron => {
      let emissive = 0;

      // Selected glow
      if (neuron.id === this.selectedNeuronId) {
        emissive = 0.3;
      }

      // Status-based effects
      if (neuron.status === 'processing') {
        emissive = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
      } else if (neuron.status === 'fired') {
        emissive = 0.4;
      }

      return {
        id: this.getPickingId(neuron.id),
        position: neuron.position,
        radius: 0.5,
        color: neuron.color || '#6366f1',
        emissive,
      };
    });

    this.sphereRenderer.renderBatch(viewProjection, spheres, false);
  }

  renderConnections(viewProjection) {
    const arrows = this.connections.map(conn => {
      const sourceNeuron = this.neurons.find(n => n.id === conn.sourceNeuronId);
      const targetNeuron = this.neurons.find(n => n.id === conn.targetNeuronId);

      if (!sourceNeuron || !targetNeuron) return null;

      // Calculate arrow endpoints (offset from sphere surface)
      const dir = vec3Normalize(vec3Sub(targetNeuron.position, sourceNeuron.position));
      const start = vec3Add(sourceNeuron.position, vec3Scale(dir, 0.55));
      const end = vec3Sub(targetNeuron.position, vec3Scale(dir, 0.55));

      return {
        start,
        end,
        color: '#4b5563',
      };
    }).filter(Boolean);

    this.lineRenderer.renderArrows(viewProjection, arrows);
  }

  renderLabels(viewProjection) {
    const labels = this.neurons.map(neuron => ({
      text: neuron.name,
      position: neuron.position,
      color: '#ffffff',
      scale: 0.4,
      offset: { x: 0, y: 0.9, z: 0 },
    }));

    this.textRenderer.renderBatch(viewProjection, labels);
  }

  /**
   * Start the render loop
   */
  start() {
    const loop = () => {
      this.render();
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Stop the render loop
   */
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Focus on a specific neuron
   */
  focusNeuron(neuronId) {
    const neuron = this.neurons.find(n => n.id === neuronId);
    if (neuron) {
      this.camera.animateTo(neuron.position, 5);
    }
  }

  /**
   * Reset camera to default view
   */
  resetCamera() {
    this.camera.reset();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();

    // Remove event listeners to prevent memory leaks
    this.canvas.removeEventListener('click', this._boundOnClick);
    this.canvas.removeEventListener('mousemove', this._boundOnMouseMove);
    window.removeEventListener('resize', this._boundOnResize);

    // Clean up WebGL resources
    this.picking.destroy();
    this.textRenderer.clearCache();
  }
}
