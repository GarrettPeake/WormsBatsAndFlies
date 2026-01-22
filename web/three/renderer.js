// Three.js renderer for brain visualization

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class Renderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.enableEditing = options.enableEditing !== false;

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

    // Transform gizmo
    this.gizmoGroup = null;
    this.gizmoArrows = new Map(); // 'x' | 'y' | 'z' -> mesh
    this.isDraggingGizmo = false;
    this.activeGizmoAxis = null;
    this.dragPlane = new THREE.Plane();
    this.dragStartPoint = new THREE.Vector3();
    this.dragStartPosition = new THREE.Vector3();

    // Shift+click connection mode
    this.isShiftDown = false;
    this.pendingConnectionSource = null;

    // Reusable objects to avoid per-frame allocations
    this._tempColor = new THREE.Color();
    this._tempVec3 = new THREE.Vector3();

    // Animation state
    this.animationFrame = null;

    // Callbacks
    this.onNeuronSelect = null;
    this.onNeuronHover = null;
    this.onNeuronMove = null;
    this.onConnectionCreate = null;

    // Bound event handlers
    this._boundOnClick = this.onClick.bind(this);
    this._boundOnMouseMove = this.onMouseMove.bind(this);
    this._boundOnMouseDown = this.onMouseDown.bind(this);
    this._boundOnMouseUp = this.onMouseUp.bind(this);
    this._boundOnKeyDown = this.onKeyDown.bind(this);
    this._boundOnKeyUp = this.onKeyUp.bind(this);
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
    this.canvas.addEventListener("click", this._boundOnClick);
    this.canvas.addEventListener("mousemove", this._boundOnMouseMove);
    this.canvas.addEventListener("mousedown", this._boundOnMouseDown);
    this.canvas.addEventListener("mouseup", this._boundOnMouseUp);
    window.addEventListener("keydown", this._boundOnKeyDown);
    window.addEventListener("keyup", this._boundOnKeyUp);
    window.addEventListener("resize", this._boundOnResize);

    // Create transform gizmo
    if (this.enableEditing) {
      this.createGizmo();
    }

    this.resize();
  }

  /**
   * Create the transform gizmo (axis arrows)
   */
  createGizmo() {
    this.gizmoGroup = new THREE.Group();
    this.gizmoGroup.visible = false;

    const arrowLength = 1.2;
    const arrowHeadLength = 0.2;
    const arrowHeadWidth = 0.1;

    // X axis (red)
    const xArrow = this.createArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0xff4444,
      arrowHeadLength,
      arrowHeadWidth,
    );
    xArrow.userData.axis = "x";
    this.gizmoGroup.add(xArrow);
    this.gizmoArrows.set("x", xArrow);

    // Y axis (green)
    const yArrow = this.createArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x44ff44,
      arrowHeadLength,
      arrowHeadWidth,
    );
    yArrow.userData.axis = "y";
    this.gizmoGroup.add(yArrow);
    this.gizmoArrows.set("y", yArrow);

    // Z axis (blue)
    const zArrow = this.createArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x4444ff,
      arrowHeadLength,
      arrowHeadWidth,
    );
    zArrow.userData.axis = "z";
    this.gizmoGroup.add(zArrow);
    this.gizmoArrows.set("z", zArrow);

    this.scene.add(this.gizmoGroup);
  }

  createArrowHelper(direction, origin, length, color, headLength, headWidth) {
    // Create a custom arrow using cylinder and cone for better picking
    const group = new THREE.Group();

    // Shaft
    const shaftGeometry = new THREE.CylinderGeometry(
      0.04,
      0.04,
      length - headLength,
      8,
    );
    const shaftMaterial = new THREE.MeshBasicMaterial({ color });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.copy(
      direction.clone().multiplyScalar((length - headLength) / 2),
    );
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    group.add(shaft);

    // Head (cone)
    const headGeometry = new THREE.ConeGeometry(headWidth, headLength, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.copy(
      direction.clone().multiplyScalar(length - headLength / 2),
    );
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    group.add(head);

    return group;
  }

  /**
   * Update gizmo position to selected neuron
   */
  updateGizmoPosition() {
    if (!this.gizmoGroup || !this.enableEditing) return;

    if (this.selectedNeuronId) {
      const neuron = this.neurons.find((n) => n.id === this.selectedNeuronId);
      if (neuron) {
        this.gizmoGroup.position.set(
          neuron.position.x,
          neuron.position.y,
          neuron.position.z,
        );
        this.gizmoGroup.visible = true;
        return;
      }
    }
    this.gizmoGroup.visible = false;
  }

  /**
   * Pick gizmo arrow at mouse position
   */
  pickGizmoAxis(event) {
    if (!this.gizmoGroup || !this.gizmoGroup.visible) return null;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Collect all gizmo meshes
    const gizmoMeshes = [];
    this.gizmoGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        gizmoMeshes.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(gizmoMeshes, false);

    if (intersects.length > 0) {
      // Find the parent group with the axis userData
      let obj = intersects[0].object;
      while (obj && !obj.userData.axis) {
        obj = obj.parent;
      }
      return obj?.userData.axis || null;
    }

    return null;
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
    this.updateGizmoPosition();
  }

  /**
   * Update a single neuron's properties without rebuilding the entire scene.
   * This is much more efficient than rebuildScene() for property changes.
   */
  updateNeuron(neuron) {
    const mesh = this.neuronMeshes.get(neuron.id);
    if (!mesh) return;

    // Update position
    mesh.position.set(neuron.position.x, neuron.position.y, neuron.position.z);

    // Update color
    const color = new THREE.Color(neuron.color || "#6366f1");
    mesh.material.color.copy(color);

    // Update label sprite position and text if needed
    const sprite = this.labelSprites.get(neuron.id);
    if (sprite) {
      sprite.position.set(
        neuron.position.x,
        neuron.position.y + 0.9,
        neuron.position.z,
      );

      // Check if name changed by comparing with stored name
      const storedNeuron = this.neurons.find((n) => n.id === neuron.id);
      if (storedNeuron && storedNeuron.name !== neuron.name) {
        // Name changed - update the sprite
        this.scene.remove(sprite);
        sprite.material.map.dispose();
        sprite.material.dispose();

        const newSprite = this.createLabelSprite(neuron.name);
        newSprite.position.set(
          neuron.position.x,
          neuron.position.y + 0.9,
          neuron.position.z,
        );
        this.scene.add(newSprite);
        this.labelSprites.set(neuron.id, newSprite);
      }
    }

    // Update the neuron in our array
    const index = this.neurons.findIndex((n) => n.id === neuron.id);
    if (index >= 0) {
      this.neurons[index] = neuron;
    }
  }

  /**
   * Set neuron status (for live view)
   */
  setNeuronStatus(neuronId, status) {
    const neuron = this.neurons.find((n) => n.id === neuronId);
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
      const color = new THREE.Color(neuron.color || "#6366f1");
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1,
        emissive: new THREE.Color(0x000000),
      });

      const mesh = new THREE.Mesh(this.sharedGeometry, material);
      mesh.position.set(
        neuron.position.x,
        neuron.position.y,
        neuron.position.z,
      );
      mesh.userData.neuronId = neuron.id;

      this.scene.add(mesh);
      this.neuronMeshes.set(neuron.id, mesh);

      // Create label sprite
      const sprite = this.createLabelSprite(neuron.name);
      sprite.position.set(
        neuron.position.x,
        neuron.position.y + 0.9,
        neuron.position.z,
      );
      this.scene.add(sprite);
      this.labelSprites.set(neuron.id, sprite);
    }

    // Note: rebuildConnections() is NOT called here to avoid double-rebuild.
    // The caller should call setConnections() separately if needed.
  }

  /**
   * Rebuild connections (arrows between neurons)
   */
  rebuildConnections() {
    // Clear existing connections
    for (const obj of this.connectionLines) {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
    this.connectionLines = [];

    const connectionColor = 0x6b7280; // Gray color

    for (const conn of this.connections) {
      const sourceNeuron = this.neurons.find(
        (n) => n.id === conn.sourceNeuronId,
      );
      const targetNeuron = this.neurons.find(
        (n) => n.id === conn.targetNeuronId,
      );

      if (!sourceNeuron || !targetNeuron) continue;

      const sourcePos = new THREE.Vector3(
        sourceNeuron.position.x,
        sourceNeuron.position.y,
        sourceNeuron.position.z,
      );
      const targetPos = new THREE.Vector3(
        targetNeuron.position.x,
        targetNeuron.position.y,
        targetNeuron.position.z,
      );

      // Calculate direction and offset from sphere surface
      const direction = new THREE.Vector3()
        .subVectors(targetPos, sourcePos)
        .normalize();
      const start = sourcePos
        .clone()
        .add(direction.clone().multiplyScalar(0.55));
      const end = targetPos.clone().sub(direction.clone().multiplyScalar(0.55));

      // Create thick tube for the main line
      const path = new THREE.LineCurve3(start, end);
      const tubeGeometry = new THREE.TubeGeometry(path, 1, 0.04, 8, false);
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: 0.8,
      });
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      this.scene.add(tube);
      this.connectionLines.push(tube);

      // Create arrowhead (cone)
      const arrowLength = 0.25;
      const arrowWidth = 0.12;

      const coneGeometry = new THREE.ConeGeometry(arrowWidth, arrowLength, 8);
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: connectionColor,
        transparent: true,
        opacity: 0.8,
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);

      // Position and rotate cone to point in direction
      cone.position.copy(end);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      // Move cone back slightly so it points at target
      cone.position.sub(direction.clone().multiplyScalar(arrowLength / 2));

      this.scene.add(cone);
      this.connectionLines.push(cone);
    }
  }

  /**
   * Create a billboard sprite with text
   */
  createLabelSprite(text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const font = "16px sans-serif";
    const padding = 8;

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const width = Math.ceil(metrics.width + padding * 2);
    const height = Math.ceil(32 + padding * 2);

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
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
      this._tempColor.set(neuron.color || "#6366f1");

      let emissiveIntensity = 0;

      // Selected glow
      if (neuron.id === this.selectedNeuronId) {
        emissiveIntensity = 0.3;
      }

      // Status-based effects
      if (neuron.status === "processing") {
        emissiveIntensity = 0.5 + Math.sin(time * 0.01) * 0.2;
      } else if (neuron.status === "fired") {
        emissiveIntensity = 0.4;
      }

      material.emissive.copy(this._tempColor).multiplyScalar(emissiveIntensity);
    }
  }

  /**
   * Handle keyboard down
   */
  onKeyDown(event) {
    if (event.key === "Shift") {
      this.isShiftDown = true;
    }
  }

  /**
   * Handle keyboard up
   */
  onKeyUp(event) {
    if (event.key === "Shift") {
      this.isShiftDown = false;
      this.pendingConnectionSource = null;
    }
  }

  /**
   * Handle mouse down for gizmo dragging
   */
  onMouseDown(event) {
    if (!this.enableEditing) return;

    // Check if clicking on gizmo
    const axis = this.pickGizmoAxis(event);
    if (axis && this.selectedNeuronId) {
      this.isDraggingGizmo = true;
      this.activeGizmoAxis = axis;
      this.controls.enabled = false; // Disable orbit controls while dragging

      // Get the neuron's current position
      const neuron = this.neurons.find((n) => n.id === this.selectedNeuronId);
      if (neuron) {
        this.dragStartPosition.set(
          neuron.position.x,
          neuron.position.y,
          neuron.position.z,
        );

        // Set up drag plane perpendicular to camera but containing the axis
        const axisVector = new THREE.Vector3(
          axis === "x" ? 1 : 0,
          axis === "y" ? 1 : 0,
          axis === "z" ? 1 : 0,
        );

        // Get camera direction
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);

        // Create plane normal that is perpendicular to the axis and aligned with camera view
        const planeNormal = new THREE.Vector3()
          .crossVectors(axisVector, camDir)
          .cross(axisVector)
          .normalize();
        if (planeNormal.length() < 0.1) {
          // If axis is parallel to camera direction, use a default perpendicular
          planeNormal.set(
            axis === "x" ? 0 : 1,
            axis === "y" ? 0 : 1,
            axis === "z" ? 1 : 0,
          );
        }

        this.dragPlane.setFromNormalAndCoplanarPoint(
          planeNormal,
          this.dragStartPosition,
        );

        // Get initial intersection point
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
      }

      event.preventDefault();
      return;
    }
  }

  /**
   * Handle mouse up
   */
  onMouseUp(event) {
    if (this.isDraggingGizmo) {
      this.isDraggingGizmo = false;
      this.activeGizmoAxis = null;
      this.controls.enabled = true;
    }
  }

  /**
   * Handle click for selection
   */
  onClick(event) {
    // Don't process click if we were dragging
    if (this.isDraggingGizmo) return;

    const neuronId = this.pickNeuron(event);

    // Shift+click to create connection
    if (this.isShiftDown && this.enableEditing && neuronId) {
      if (
        this.pendingConnectionSource &&
        this.pendingConnectionSource !== neuronId
      ) {
        // Create connection from pending source to clicked neuron
        if (this.onConnectionCreate) {
          this.onConnectionCreate(this.pendingConnectionSource, neuronId);
        }
        this.pendingConnectionSource = null;
      } else {
        // Set this neuron as the connection source
        this.pendingConnectionSource = neuronId;
      }
      return;
    }

    // Clear pending connection on regular click
    this.pendingConnectionSource = null;

    if (this.onNeuronSelect) {
      this.onNeuronSelect(neuronId);
    }
  }

  /**
   * Handle mouse move for hover and gizmo dragging
   */
  onMouseMove(event) {
    // Handle gizmo dragging
    if (this.isDraggingGizmo && this.activeGizmoAxis && this.selectedNeuronId) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersectPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
        // Calculate movement along the axis
        const delta = intersectPoint.sub(this.dragStartPoint);

        // Project delta onto the active axis
        let newPosition;
        switch (this.activeGizmoAxis) {
          case "x":
            newPosition = this.dragStartPosition.clone();
            newPosition.x += delta.x;
            break;
          case "y":
            newPosition = this.dragStartPosition.clone();
            newPosition.y += delta.y;
            break;
          case "z":
            newPosition = this.dragStartPosition.clone();
            newPosition.z += delta.z;
            break;
        }

        // Update neuron position
        const neuron = this.neurons.find((n) => n.id === this.selectedNeuronId);
        if (neuron && newPosition) {
          neuron.position.x = newPosition.x;
          neuron.position.y = newPosition.y;
          neuron.position.z = newPosition.z;

          // Update mesh position
          const mesh = this.neuronMeshes.get(this.selectedNeuronId);
          if (mesh) {
            mesh.position.copy(newPosition);
          }

          // Update label position
          const sprite = this.labelSprites.get(this.selectedNeuronId);
          if (sprite) {
            sprite.position.set(
              newPosition.x,
              newPosition.y + 0.9,
              newPosition.z,
            );
          }

          // Update gizmo position
          if (this.gizmoGroup) {
            this.gizmoGroup.position.copy(newPosition);
          }

          // Notify about position change
          if (this.onNeuronMove) {
            this.onNeuronMove(this.selectedNeuronId, neuron.position);
          }

          // Rebuild connections to update their positions
          this.rebuildConnections();
        }
      }
      return;
    }

    // Throttle picking for hover
    const now = performance.now();
    if (now - this._lastPickTime < this._pickThrottleMs) {
      return;
    }
    this._lastPickTime = now;

    // Check gizmo hover
    if (this.enableEditing && this.gizmoGroup?.visible) {
      const gizmoAxis = this.pickGizmoAxis(event);
      if (gizmoAxis) {
        this.canvas.style.cursor = "grab";
        return;
      }
    }

    const neuronId = this.pickNeuron(event);

    if (neuronId !== this.hoveredNeuronId) {
      this.hoveredNeuronId = neuronId;
      this.canvas.style.cursor = neuronId ? "pointer" : "default";

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
    const neuron = this.neurons.find((n) => n.id === neuronId);
    if (neuron) {
      this.animateTo(
        new THREE.Vector3(
          neuron.position.x,
          neuron.position.y,
          neuron.position.z,
        ),
        5,
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
    this.canvas.removeEventListener("click", this._boundOnClick);
    this.canvas.removeEventListener("mousemove", this._boundOnMouseMove);
    this.canvas.removeEventListener("mousedown", this._boundOnMouseDown);
    this.canvas.removeEventListener("mouseup", this._boundOnMouseUp);
    window.removeEventListener("keydown", this._boundOnKeyDown);
    window.removeEventListener("keyup", this._boundOnKeyUp);
    window.removeEventListener("resize", this._boundOnResize);

    // Dispose controls
    this.controls.dispose();

    // Dispose shared geometry once
    if (this.sharedGeometry) {
      this.sharedGeometry.dispose();
      this.sharedGeometry = null;
    }

    // Dispose gizmo
    if (this.gizmoGroup) {
      this.gizmoGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          child.material?.dispose();
        }
      });
      this.scene.remove(this.gizmoGroup);
      this.gizmoGroup = null;
    }

    // Dispose all mesh materials (geometry already disposed above)
    for (const mesh of this.neuronMeshes.values()) {
      mesh.material.dispose();
    }

    for (const sprite of this.labelSprites.values()) {
      sprite.material.map.dispose();
      sprite.material.dispose();
    }

    for (const obj of this.connectionLines) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    // Dispose renderer
    this.renderer.dispose();
  }
}
