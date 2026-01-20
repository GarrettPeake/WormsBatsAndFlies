// Three.js renderer for brain visualization

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Three.js core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.set(7, 5, 7);

    // Orbit controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 50;

    // Raycaster for picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Data
    this.neurons = [];
    this.connections = [];
    this.selectedNeuronId = null;
    this.hoveredNeuronId = null;

    // Three.js objects
    this.neuronMeshes = new Map(); // neuronId -> mesh
    this.connectionLines = [];
    this.labelSprites = new Map(); // neuronId -> sprite
    this.sharedGeometry = null; // Shared sphere geometry for all neurons

    // Reusable objects to avoid per-frame allocations
    this._tempColor = new THREE.Color();

    // Animation state
    this.animationFrame = null;

    // Callbacks
    this.onNeuronSelect = null;
    this.onNeuronHover = null;

    // Bound event handlers
    this._boundOnClick = this.onClick.bind(this);
    this._boundOnMouseMove = this.onMouseMove.bind(this);
    this._boundOnResize = this.resize.bind(this);

    // Throttle state for mousemove
    this._lastPickTime = 0;
    this._pickThrottleMs = 50;

    this.init();
  }

  init() {
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Event listeners
    this.canvas.addEventListener('click', this._boundOnClick);
    this.canvas.addEventListener('mousemove', this._boundOnMouseMove);
    window.addEventListener('resize', this._boundOnResize);

    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();

    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Set neurons to render
   */
  setNeurons(neurons) {
    this.neurons = neurons;
    this.rebuildScene();
  }

  /**
   * Set connections to render
   */
  setConnections(connections) {
    this.connections = connections;
    this.rebuildConnections();
  }

  /**
   * Set the selected neuron
   */
  setSelectedNeuron(neuronId) {
    this.selectedNeuronId = neuronId;
    this.updateNeuronAppearance();
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
   * Rebuild the entire scene with current neurons
   */
  rebuildScene() {
    // Clear existing neuron meshes (dispose materials only, not shared geometry)
    for (const mesh of this.neuronMeshes.values()) {
      this.scene.remove(mesh);
      mesh.material.dispose();
    }
    this.neuronMeshes.clear();

    // Dispose old shared geometry once
    if (this.sharedGeometry) {
      this.sharedGeometry.dispose();
      this.sharedGeometry = null;
    }

    // Clear existing labels
    for (const sprite of this.labelSprites.values()) {
      this.scene.remove(sprite);
      sprite.material.map.dispose();
      sprite.material.dispose();
    }
    this.labelSprites.clear();

    // Create shared geometry for all neuron meshes
    this.sharedGeometry = new THREE.SphereGeometry(0.5, 32, 24);

    for (const neuron of this.neurons) {
      const color = new THREE.Color(neuron.color || '#6366f1');
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1,
        emissive: new THREE.Color(0x000000),
      });

      const mesh = new THREE.Mesh(this.sharedGeometry, material);
      mesh.position.set(neuron.position.x, neuron.position.y, neuron.position.z);
      mesh.userData.neuronId = neuron.id;

      this.scene.add(mesh);
      this.neuronMeshes.set(neuron.id, mesh);

      // Create label sprite
      const sprite = this.createLabelSprite(neuron.name);
      sprite.position.set(
        neuron.position.x,
        neuron.position.y + 0.9,
        neuron.position.z
      );
      this.scene.add(sprite);
      this.labelSprites.set(neuron.id, sprite);
    }

    this.rebuildConnections();
  }

  /**
   * Rebuild connections (arrows between neurons)
   */
  rebuildConnections() {
    // Clear existing connections
    for (const line of this.connectionLines) {
      this.scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }
    this.connectionLines = [];

    const connectionColor = new THREE.Color('#4b5563');

    for (const conn of this.connections) {
      const sourceNeuron = this.neurons.find(n => n.id === conn.sourceNeuronId);
      const targetNeuron = this.neurons.find(n => n.id === conn.targetNeuronId);

      if (!sourceNeuron || !targetNeuron) continue;

      const sourcePos = new THREE.Vector3(
        sourceNeuron.position.x,
        sourceNeuron.position.y,
        sourceNeuron.position.z
      );
      const targetPos = new THREE.Vector3(
        targetNeuron.position.x,
        targetNeuron.position.y,
        targetNeuron.position.z
      );

      // Calculate direction and offset from sphere surface
      const direction = new THREE.Vector3().subVectors(targetPos, sourcePos).normalize();
      const start = sourcePos.clone().add(direction.clone().multiplyScalar(0.55));
      const end = targetPos.clone().sub(direction.clone().multiplyScalar(0.55));

      // Create main line
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: 0.7,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(line);
      this.connectionLines.push(line);

      // Create arrowhead
      const arrowLength = 0.2;
      const arrowWidth = 0.1;

      // Get perpendicular vector
      const up = Math.abs(direction.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
      const perp = new THREE.Vector3().crossVectors(direction, up).normalize();

      const arrowBase = end.clone().sub(direction.clone().multiplyScalar(arrowLength));
      const arrowTip1 = arrowBase.clone().add(perp.clone().multiplyScalar(arrowWidth));
      const arrowTip2 = arrowBase.clone().sub(perp.clone().multiplyScalar(arrowWidth));

      const arrow1Geometry = new THREE.BufferGeometry().setFromPoints([end, arrowTip1]);
      const arrow2Geometry = new THREE.BufferGeometry().setFromPoints([end, arrowTip2]);

      const arrow1 = new THREE.Line(arrow1Geometry, lineMaterial.clone());
      const arrow2 = new THREE.Line(arrow2Geometry, lineMaterial.clone());

      this.scene.add(arrow1);
      this.scene.add(arrow2);
      this.connectionLines.push(arrow1, arrow2);
    }
  }

  /**
   * Create a billboard sprite with text
   */
  createLabelSprite(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const font = '24px sans-serif';
    const padding = 8;

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const width = Math.ceil(metrics.width + padding * 2);
    const height = Math.ceil(32 + padding * 2);

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    const scale = 0.02;
    sprite.scale.set(width * scale, height * scale, 1);

    return sprite;
  }

  /**
   * Update neuron appearance based on selection and status
   */
  updateNeuronAppearance() {
    const time = Date.now();

    for (const neuron of this.neurons) {
      const mesh = this.neuronMeshes.get(neuron.id);
      if (!mesh) continue;

      const material = mesh.material;
      // Reuse temp color to avoid allocations every frame
      this._tempColor.set(neuron.color || '#6366f1');

      let emissiveIntensity = 0;

      // Selected glow
      if (neuron.id === this.selectedNeuronId) {
        emissiveIntensity = 0.3;
      }

      // Status-based effects
      if (neuron.status === 'processing') {
        emissiveIntensity = 0.5 + Math.sin(time * 0.01) * 0.2;
      } else if (neuron.status === 'fired') {
        emissiveIntensity = 0.4;
      }

      material.emissive.copy(this._tempColor).multiplyScalar(emissiveIntensity);
    }
  }

  /**
   * Handle click for selection
   */
  onClick(event) {
    const neuronId = this.pickNeuron(event);

    if (this.onNeuronSelect) {
      this.onNeuronSelect(neuronId);
    }
  }

  /**
   * Handle mouse move for hover
   */
  onMouseMove(event) {
    // Throttle picking
    const now = performance.now();
    if (now - this._lastPickTime < this._pickThrottleMs) {
      return;
    }
    this._lastPickTime = now;

    const neuronId = this.pickNeuron(event);

    if (neuronId !== this.hoveredNeuronId) {
      this.hoveredNeuronId = neuronId;
      this.canvas.style.cursor = neuronId ? 'pointer' : 'default';

      if (this.onNeuronHover) {
        this.onNeuronHover(neuronId);
      }
    }
  }

  /**
   * Pick neuron at mouse position using raycaster
   */
  pickNeuron(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = Array.from(this.neuronMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      return intersects[0].object.userData.neuronId;
    }

    return null;
  }

  /**
   * Start the render loop
   */
  start() {
    const loop = () => {
      this.controls.update();
      this.updateNeuronAppearance();
      this.renderer.render(this.scene, this.camera);
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
      this.animateTo(
        new THREE.Vector3(neuron.position.x, neuron.position.y, neuron.position.z),
        5
      );
    }
  }

  /**
   * Smoothly animate camera to target
   */
  animateTo(target, distance, duration = 500) {
    const startTarget = this.controls.target.clone();
    const startPosition = this.camera.position.clone();

    // Calculate end position (maintain current direction but adjust distance)
    const direction = new THREE.Vector3()
      .subVectors(startPosition, startTarget)
      .normalize();
    const endPosition = target.clone().add(direction.multiplyScalar(distance));

    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // Ease out cubic

      this.controls.target.lerpVectors(startTarget, target, eased);
      this.camera.position.lerpVectors(startPosition, endPosition, eased);

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Reset camera to default view
   */
  resetCamera() {
    this.animateTo(new THREE.Vector3(0, 0, 0), 10);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();

    // Remove event listeners
    this.canvas.removeEventListener('click', this._boundOnClick);
    this.canvas.removeEventListener('mousemove', this._boundOnMouseMove);
    window.removeEventListener('resize', this._boundOnResize);

    // Dispose controls
    this.controls.dispose();

    // Dispose shared geometry once
    if (this.sharedGeometry) {
      this.sharedGeometry.dispose();
      this.sharedGeometry = null;
    }

    // Dispose all mesh materials (geometry already disposed above)
    for (const mesh of this.neuronMeshes.values()) {
      mesh.material.dispose();
    }

    for (const sprite of this.labelSprites.values()) {
      sprite.material.map.dispose();
      sprite.material.dispose();
    }

    for (const line of this.connectionLines) {
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }

    // Dispose renderer
    this.renderer.dispose();
  }
}
