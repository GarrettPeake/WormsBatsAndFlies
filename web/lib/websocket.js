// WebSocket manager for live execution streaming

export class ExecutionWebSocket {
  constructor(execId, token) {
    this.execId = execId;
    this.token = token;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    this.listeners = {
      open: [],
      close: [],
      error: [],
      message: [],
      // Specific message types
      execution_started: [],
      step_started: [],
      neuron_processing: [],
      neuron_output: [],
      neuron_error: [],
      step_completed: [],
      execution_paused: [],
      execution_resumed: [],
      execution_fizzled: [],
      final_output: [],
    };
  }

  /**
   * Connect to the WebSocket
   */
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // WebSocket connections can't send Authorization headers, so we pass the token as a query parameter
    const url = `${protocol}//${window.location.host}/api/executions/${this.execId}/stream?token=${encodeURIComponent(this.token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('open');
    };

    this.ws.onclose = (event) => {
      this.emit('close', event);

      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', message);

        // Emit specific message type
        if (message.type && this.listeners[message.type]) {
          this.emit(message.type, message.data);
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect() {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  send(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  /**
   * Send pause command
   */
  pause() {
    this.send('pause');
  }

  /**
   * Send resume command
   */
  resume() {
    this.send('resume');
  }

  /**
   * Send step command
   */
  step() {
    this.send('step');
  }

  /**
   * Send input to the brain
   */
  sendInput(content, type = 'text') {
    this.send('input', { content, type });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(data);
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
