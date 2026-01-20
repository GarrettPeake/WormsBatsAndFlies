// GPU-based object picking

export class Picking {
  constructor(gl, width, height) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.framebuffer = null;
    this.texture = null;
    this.depthBuffer = null;

    this.init();
  }

  init() {
    const gl = this.gl;

    // Create framebuffer
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    // Create color texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0
    );

    // Create depth buffer
    this.depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      this.width,
      this.height
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      this.depthBuffer
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Resize the picking framebuffer
   */
  resize(width, height) {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    const gl = this.gl;

    // Resize texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    // Resize depth buffer
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  }

  /**
   * Begin picking render pass
   */
  begin() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * End picking render pass
   */
  end() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Read the picked ID at a screen position
   */
  pick(x, y) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    const pixel = new Uint8Array(4);
    gl.readPixels(x, this.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Decode ID from RGB
    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];

    return id > 0 ? id : null;
  }

  /**
   * Destroy picking resources
   */
  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteTexture(this.texture);
    gl.deleteRenderbuffer(this.depthBuffer);
  }
}
