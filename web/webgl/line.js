// Line rendering for connections between neurons

import { hexToRgb, vec3Sub, vec3Normalize, vec3Cross, vec3Scale, vec3Add } from '../utils/math.js';

export class LineRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.maxLines = 1000;
    this.lineCount = 0;

    this.init();
  }

  init() {
    const gl = this.gl;

    // Create shader program
    this.program = this.createProgram();

    // Create buffers for dynamic line data
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // Position buffer (2 vertices per line, 3 components each)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxLines * 6 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Color buffer (2 vertices per line, 3 components each)
    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxLines * 6 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Get uniform locations
    this.uniforms = {
      uViewProjection: gl.getUniformLocation(this.program, 'uViewProjection'),
    };
  }

  createProgram() {
    const gl = this.gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec3 aColor;

      uniform mat4 uViewProjection;

      out vec3 vColor;

      void main() {
        vColor = aColor;
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
      }
    `);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `#version 300 es
      precision highp float;

      in vec3 vColor;
      out vec4 fragColor;

      void main() {
        fragColor = vec4(vColor, 0.7);
      }
    `);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Line shader error:', gl.getProgramInfoLog(program));
    }

    return program;
  }

  /**
   * Render a batch of lines
   * @param {Float32Array} viewProjection - View projection matrix
   * @param {Array} lines - Array of {start, end, color} objects
   */
  render(viewProjection, lines) {
    if (lines.length === 0) return;

    const gl = this.gl;
    const lineCount = Math.min(lines.length, this.maxLines);

    // Build position and color arrays
    const positions = new Float32Array(lineCount * 6);
    const colors = new Float32Array(lineCount * 6);

    for (let i = 0; i < lineCount; i++) {
      const line = lines[i];
      const offset = i * 6;

      positions[offset] = line.start.x;
      positions[offset + 1] = line.start.y;
      positions[offset + 2] = line.start.z;
      positions[offset + 3] = line.end.x;
      positions[offset + 4] = line.end.y;
      positions[offset + 5] = line.end.z;

      const rgb = typeof line.color === 'string' ? hexToRgb(line.color) : (line.color || [0.5, 0.5, 0.5]);
      colors[offset] = rgb[0];
      colors[offset + 1] = rgb[1];
      colors[offset + 2] = rgb[2];
      colors[offset + 3] = rgb[0];
      colors[offset + 4] = rgb[1];
      colors[offset + 5] = rgb[2];
    }

    // Upload data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors);

    // Render
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, viewProjection);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.LINES, 0, lineCount * 2);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /**
   * Render an arrow (line with arrowhead) between two points
   */
  renderArrow(viewProjection, start, end, color) {
    const lines = [];

    // Main line
    lines.push({ start, end, color });

    // Calculate arrowhead
    const dir = vec3Normalize(vec3Sub(end, start));
    const arrowLength = 0.3;
    const arrowWidth = 0.15;

    // Get perpendicular vectors
    const up = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const perp1 = vec3Normalize(vec3Cross(dir, up));
    const perp2 = vec3Cross(dir, perp1);

    const arrowBase = vec3Sub(end, vec3Scale(dir, arrowLength));
    const arrowTip1 = vec3Add(arrowBase, vec3Scale(perp1, arrowWidth));
    const arrowTip2 = vec3Sub(arrowBase, vec3Scale(perp1, arrowWidth));
    const arrowTip3 = vec3Add(arrowBase, vec3Scale(perp2, arrowWidth));
    const arrowTip4 = vec3Sub(arrowBase, vec3Scale(perp2, arrowWidth));

    lines.push({ start: end, end: arrowTip1, color });
    lines.push({ start: end, end: arrowTip2, color });
    lines.push({ start: end, end: arrowTip3, color });
    lines.push({ start: end, end: arrowTip4, color });

    this.render(viewProjection, lines);
  }

  /**
   * Render multiple arrows efficiently
   */
  renderArrows(viewProjection, arrows) {
    const lines = [];

    for (const arrow of arrows) {
      const { start, end, color } = arrow;

      // Main line
      lines.push({ start, end, color });

      // Calculate arrowhead
      const dir = vec3Normalize(vec3Sub(end, start));
      const arrowLength = 0.2;
      const arrowWidth = 0.1;

      const up = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const perp1 = vec3Normalize(vec3Cross(dir, up));

      const arrowBase = vec3Sub(end, vec3Scale(dir, arrowLength));
      const arrowTip1 = vec3Add(arrowBase, vec3Scale(perp1, arrowWidth));
      const arrowTip2 = vec3Sub(arrowBase, vec3Scale(perp1, arrowWidth));

      lines.push({ start: end, end: arrowTip1, color });
      lines.push({ start: end, end: arrowTip2, color });
    }

    this.render(viewProjection, lines);
  }
}
