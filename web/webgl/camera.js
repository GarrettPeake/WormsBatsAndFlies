// Orbit camera controls for WebGL

import {
  vec3,
  vec3Sub,
  vec3Normalize,
  vec3Scale,
  vec3Add,
  vec3Length,
  mat4LookAt,
  mat4Perspective,
  mat4Multiply,
  clamp,
  degToRad,
} from '../utils/math.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;

    // Camera position in spherical coordinates
    this.distance = 10;
    this.phi = Math.PI / 4; // Vertical angle
    this.theta = Math.PI / 4; // Horizontal angle

    // Target point
    this.target = vec3(0, 0, 0);

    // Camera limits
    this.minDistance = 2;
    this.maxDistance = 50;
    this.minPhi = 0.1;
    this.maxPhi = Math.PI - 0.1;

    // Projection settings
    this.fov = degToRad(60);
    this.near = 0.1;
    this.far = 100;

    // Sensitivity
    this.rotateSensitivity = 0.005;
    this.panSensitivity = 0.01;
    this.zoomSensitivity = 0.001;

    // State
    this.isDragging = false;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onMouseDown(e) {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (e.button === 0) {
      // Left click - rotate
      this.isDragging = true;
    } else if (e.button === 2) {
      // Right click - pan
      this.isPanning = true;
    }
  }

  onMouseMove(e) {
    if (!this.isDragging && !this.isPanning) return;

    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (this.isDragging) {
      this.rotate(deltaX, deltaY);
    } else if (this.isPanning) {
      this.pan(deltaX, deltaY);
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.isPanning = false;
  }

  onWheel(e) {
    e.preventDefault();
    this.zoom(e.deltaY);
  }

  rotate(deltaX, deltaY) {
    this.theta -= deltaX * this.rotateSensitivity;
    this.phi += deltaY * this.rotateSensitivity;
    this.phi = clamp(this.phi, this.minPhi, this.maxPhi);
  }

  pan(deltaX, deltaY) {
    // Get camera right and up vectors
    const position = this.getPosition();
    const forward = vec3Normalize(vec3Sub(this.target, position));
    const right = vec3Normalize({
      x: Math.sin(this.theta - Math.PI / 2),
      y: 0,
      z: Math.cos(this.theta - Math.PI / 2),
    });
    const up = vec3(0, 1, 0);

    // Move target
    const panScale = this.distance * this.panSensitivity;
    const rightMove = vec3Scale(right, -deltaX * panScale);
    const upMove = vec3Scale(up, deltaY * panScale);

    this.target = vec3Add(this.target, vec3Add(rightMove, upMove));
  }

  zoom(delta) {
    this.distance += delta * this.zoomSensitivity * this.distance;
    this.distance = clamp(this.distance, this.minDistance, this.maxDistance);
  }

  getPosition() {
    return {
      x: this.target.x + this.distance * Math.sin(this.phi) * Math.sin(this.theta),
      y: this.target.y + this.distance * Math.cos(this.phi),
      z: this.target.z + this.distance * Math.sin(this.phi) * Math.cos(this.theta),
    };
  }

  getViewMatrix() {
    return mat4LookAt(this.getPosition(), this.target, vec3(0, 1, 0));
  }

  getProjectionMatrix() {
    const aspect = this.canvas.width / this.canvas.height;
    return mat4Perspective(this.fov, aspect, this.near, this.far);
  }

  getViewProjectionMatrix() {
    return mat4Multiply(this.getProjectionMatrix(), this.getViewMatrix());
  }

  /**
   * Set camera to look at a specific point
   */
  lookAt(target) {
    this.target = { ...target };
  }

  /**
   * Set camera distance
   */
  setDistance(distance) {
    this.distance = clamp(distance, this.minDistance, this.maxDistance);
  }

  /**
   * Reset camera to default position
   */
  reset() {
    this.distance = 10;
    this.phi = Math.PI / 4;
    this.theta = Math.PI / 4;
    this.target = vec3(0, 0, 0);
  }

  /**
   * Smoothly animate to a position
   */
  animateTo(target, distance, duration = 500) {
    const startTarget = { ...this.target };
    const startDistance = this.distance;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // Ease out cubic

      this.target.x = startTarget.x + (target.x - startTarget.x) * eased;
      this.target.y = startTarget.y + (target.y - startTarget.y) * eased;
      this.target.z = startTarget.z + (target.z - startTarget.z) * eased;
      this.distance = startDistance + (distance - startDistance) * eased;

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }
}
