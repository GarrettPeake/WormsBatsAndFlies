// Sphere geometry generation and rendering

import { hexToRgb } from '../utils/math.js';

/**
 * Generate sphere vertex data
 */
export function generateSphereGeometry(segments = 32, rings = 16) {
  const positions = [];
  const normals = [];
  const indices = [];

  // Generate vertices
  for (let ring = 0; ring <= rings; ring++) {
    const phi = (ring / rings) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let seg = 0; seg <= segments; seg++) {
      const theta = (seg / segments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const x = cosTheta * sinPhi;
      const y = cosPhi;
      const z = sinTheta * sinPhi;

      positions.push(x, y, z);
      normals.push(x, y, z);
    }
  }

  // Generate indices
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = ring * (segments + 1) + seg;
      const b = a + segments + 1;
      const c = a + 1;
      const d = b + 1;

      indices.push(a, b, c);
      indices.push(c, b, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

export class SphereRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.vao = null;
    this.indexCount = 0;

    this.init();
  }

  init() {
    const gl = this.gl;

    // Create shader program
    this.program = this.createProgram();

    // Generate geometry
    const geometry = generateSphereGeometry(24, 16);
    this.indexCount = geometry.indices.length;

    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Normal buffer
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    // Index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    // Get uniform locations
    this.uniforms = {
      uViewProjection: gl.getUniformLocation(this.program, 'uViewProjection'),
      uPosition: gl.getUniformLocation(this.program, 'uPosition'),
      uRadius: gl.getUniformLocation(this.program, 'uRadius'),
      uColor: gl.getUniformLocation(this.program, 'uColor'),
      uEmissive: gl.getUniformLocation(this.program, 'uEmissive'),
      uPickingId: gl.getUniformLocation(this.program, 'uPickingId'),
      uIsPicking: gl.getUniformLocation(this.program, 'uIsPicking'),
    };
  }

  createProgram() {
    const gl = this.gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec3 aNormal;

      uniform mat4 uViewProjection;
      uniform vec3 uPosition;
      uniform float uRadius;

      out vec3 vNormal;
      out vec3 vWorldPos;

      void main() {
        vec3 worldPos = aPosition * uRadius + uPosition;
        vWorldPos = worldPos;
        vNormal = aNormal;
        gl_Position = uViewProjection * vec4(worldPos, 1.0);
      }
    `);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `#version 300 es
      precision highp float;

      in vec3 vNormal;
      in vec3 vWorldPos;

      uniform vec3 uColor;
      uniform float uEmissive;
      uniform int uPickingId;
      uniform bool uIsPicking;

      out vec4 fragColor;

      void main() {
        if (uIsPicking) {
          // Output picking ID as color
          int id = uPickingId;
          fragColor = vec4(
            float((id >> 16) & 0xFF) / 255.0,
            float((id >> 8) & 0xFF) / 255.0,
            float(id & 0xFF) / 255.0,
            1.0
          );
          return;
        }

        // Simple lighting
        vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
        vec3 normal = normalize(vNormal);

        float diff = max(dot(normal, lightDir), 0.0);
        float ambient = 0.3;

        vec3 color = uColor * (ambient + diff * 0.7);

        // Add emissive glow
        color = mix(color, uColor, uEmissive);

        fragColor = vec4(color, 1.0);
      }
    `);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Sphere shader error:', gl.getProgramInfoLog(program));
    }

    return program;
  }

  /**
   * Render a single sphere
   */
  render(viewProjection, position, radius, color, emissive = 0, pickingId = 0, isPicking = false) {
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, viewProjection);
    gl.uniform3f(this.uniforms.uPosition, position.x, position.y, position.z);
    gl.uniform1f(this.uniforms.uRadius, radius);

    const rgb = typeof color === 'string' ? hexToRgb(color) : color;
    gl.uniform3f(this.uniforms.uColor, rgb[0], rgb[1], rgb[2]);
    gl.uniform1f(this.uniforms.uEmissive, emissive);
    gl.uniform1i(this.uniforms.uPickingId, pickingId);
    gl.uniform1i(this.uniforms.uIsPicking, isPicking ? 1 : 0);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
  }

  /**
   * Render multiple spheres efficiently
   */
  renderBatch(viewProjection, spheres, isPicking = false) {
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, viewProjection);
    gl.uniform1i(this.uniforms.uIsPicking, isPicking ? 1 : 0);

    for (const sphere of spheres) {
      gl.uniform3f(this.uniforms.uPosition, sphere.position.x, sphere.position.y, sphere.position.z);
      gl.uniform1f(this.uniforms.uRadius, sphere.radius || 0.5);

      const rgb = typeof sphere.color === 'string' ? hexToRgb(sphere.color) : (sphere.color || [0.5, 0.5, 0.5]);
      gl.uniform3f(this.uniforms.uColor, rgb[0], rgb[1], rgb[2]);
      gl.uniform1f(this.uniforms.uEmissive, sphere.emissive || 0);
      gl.uniform1i(this.uniforms.uPickingId, sphere.id || 0);

      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindVertexArray(null);
  }
}
