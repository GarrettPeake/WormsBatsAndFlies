// API client for backend communication

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  /**
   * Set the authentication token
   */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  /**
   * Get the authentication token
   */
  getToken() {
    return this.token;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Make an authenticated request
   */
  async request(method, path, body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${path}`, options);

    if (response.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth endpoints
  async login(username, password) {
    const result = await this.request('POST', '/auth/login', { username, password });
    this.setToken(result.token);
    return result;
  }

  async verifyToken() {
    try {
      await this.request('GET', '/auth/verify');
      return true;
    } catch {
      return false;
    }
  }

  logout() {
    this.setToken(null);
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  // Brain endpoints
  async listBrains() {
    const result = await this.request('GET', '/brains');
    return result.brains;
  }

  async getBrain(id) {
    const result = await this.request('GET', `/brains/${id}`);
    return result.brain;
  }

  async createBrain(data) {
    const result = await this.request('POST', '/brains', data);
    return result.brain;
  }

  async updateBrain(id, data) {
    const result = await this.request('PUT', `/brains/${id}`, data);
    return result.brain;
  }

  async deleteBrain(id) {
    await this.request('DELETE', `/brains/${id}`);
  }

  // Neuron endpoints
  async addNeuron(brainId, data) {
    const result = await this.request('POST', `/brains/${brainId}/neurons`, data);
    return result.neuron;
  }

  async updateNeuron(brainId, neuronId, data) {
    const result = await this.request('PUT', `/brains/${brainId}/neurons/${neuronId}`, data);
    return result.neuron;
  }

  async deleteNeuron(brainId, neuronId) {
    await this.request('DELETE', `/brains/${brainId}/neurons/${neuronId}`);
  }

  // Connection endpoints
  async addConnection(brainId, data) {
    const result = await this.request('POST', `/brains/${brainId}/connections`, data);
    return result.connection;
  }

  async deleteConnection(brainId, connectionId) {
    await this.request('DELETE', `/brains/${brainId}/connections/${connectionId}`);
  }

  // Execution endpoints
  async startExecution(brainId, options = {}) {
    const result = await this.request('POST', `/brains/${brainId}/execute`, options);
    return result.execution;
  }

  async getExecution(execId) {
    const result = await this.request('GET', `/executions/${execId}`);
    return result.execution;
  }

  async pauseExecution(execId) {
    return this.request('POST', `/executions/${execId}/pause`);
  }

  async resumeExecution(execId) {
    return this.request('POST', `/executions/${execId}/resume`);
  }

  async stepExecution(execId) {
    return this.request('POST', `/executions/${execId}/step`);
  }

  async sendInput(execId, content, type = 'text') {
    return this.request('POST', `/executions/${execId}/input`, { content, type });
  }

  /**
   * Get WebSocket URL for execution streaming
   */
  getExecutionStreamUrl(execId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/executions/${execId}/stream`;
  }
}

// Export singleton instance
export const api = new ApiClient();
