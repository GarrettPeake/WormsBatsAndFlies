// Text label rendering using Canvas 2D to texture

export class TextRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.textureCache = new Map();
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.init();
  }

  init() {
    const gl = this.gl;

    // Create shader program
    this.program = this.createProgram();

    // Create quad geometry
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const vertices = new Float32Array([
      -0.5, -0.5, 0, 0, 1,
      0.5, -0.5, 0, 1, 1,
      -0.5, 0.5, 0, 0, 0,
      0.5, 0.5, 0, 1, 0,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

    gl.bindVertexArray(null);

    // Get uniform locations
    this.uniforms = {
      uViewProjection: gl.getUniformLocation(this.program, 'uViewProjection'),
      uPosition: gl.getUniformLocation(this.program, 'uPosition'),
      uScale: gl.getUniformLocation(this.program, 'uScale'),
      uTexture: gl.getUniformLocation(this.program, 'uTexture'),
      uBillboard: gl.getUniformLocation(this.program, 'uBillboard'),
    };
  }

  createProgram() {
    const gl = this.gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec2 aTexCoord;

      uniform mat4 uViewProjection;
      uniform vec3 uPosition;
      uniform vec2 uScale;
      uniform bool uBillboard;

      out vec2 vTexCoord;

      void main() {
        vTexCoord = aTexCoord;

        if (uBillboard) {
          // Billboard - always face camera
          vec4 pos = uViewProjection * vec4(uPosition, 1.0);
          vec2 offset = aPosition.xy * uScale;
          gl_Position = pos + vec4(offset * pos.w, 0.0, 0.0);
        } else {
          vec3 worldPos = aPosition * vec3(uScale, 1.0) + uPosition;
          gl_Position = uViewProjection * vec4(worldPos, 1.0);
        }
      }
    `);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `#version 300 es
      precision highp float;

      in vec2 vTexCoord;

      uniform sampler2D uTexture;

      out vec4 fragColor;

      void main() {
        vec4 color = texture(uTexture, vTexCoord);
        if (color.a < 0.1) discard;
        fragColor = color;
      }
    `);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Text shader error:', gl.getProgramInfoLog(program));
    }

    return program;
  }

  /**
   * Create or get cached texture for text
   */
  getTextTexture(text, options = {}) {
    const {
      font = '24px sans-serif',
      color = '#ffffff',
      backgroundColor = 'transparent',
      padding = 8,
    } = options;

    const cacheKey = `${text}|${font}|${color}|${backgroundColor}`;

    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const gl = this.gl;
    const ctx = this.ctx;

    // Measure text
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const width = Math.ceil(metrics.width + padding * 2);
    const height = Math.ceil(32 + padding * 2);

    // Resize canvas
    this.canvas.width = width;
    this.canvas.height = height;

    // Draw background
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Draw text
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const textureData = {
      texture,
      width,
      height,
      aspectRatio: width / height,
    };

    this.textureCache.set(cacheKey, textureData);
    return textureData;
  }

  /**
   * Render text at a position
   */
  render(viewProjection, text, position, options = {}) {
    const {
      scale = 0.5,
      billboard = true,
      offset = { x: 0, y: 0.8, z: 0 },
    } = options;

    const gl = this.gl;
    const textureData = this.getTextTexture(text, options);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, viewProjection);
    gl.uniform3f(
      this.uniforms.uPosition,
      position.x + offset.x,
      position.y + offset.y,
      position.z + offset.z
    );
    gl.uniform2f(this.uniforms.uScale, scale * textureData.aspectRatio, scale);
    gl.uniform1i(this.uniforms.uBillboard, billboard ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureData.texture);
    gl.uniform1i(this.uniforms.uTexture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /**
   * Render multiple text labels
   */
  renderBatch(viewProjection, labels) {
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, viewProjection);

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uniforms.uTexture, 0);

    for (const label of labels) {
      const textureData = this.getTextTexture(label.text, label);
      const scale = label.scale || 0.5;
      const offset = label.offset || { x: 0, y: 0.8, z: 0 };

      gl.uniform3f(
        this.uniforms.uPosition,
        label.position.x + offset.x,
        label.position.y + offset.y,
        label.position.z + offset.z
      );
      gl.uniform2f(this.uniforms.uScale, scale * textureData.aspectRatio, scale);
      gl.uniform1i(this.uniforms.uBillboard, label.billboard !== false ? 1 : 0);

      gl.bindTexture(gl.TEXTURE_2D, textureData.texture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /**
   * Clear texture cache
   */
  clearCache() {
    const gl = this.gl;
    for (const data of this.textureCache.values()) {
      gl.deleteTexture(data.texture);
    }
    this.textureCache.clear();
  }
}
