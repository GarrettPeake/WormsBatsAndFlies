// Simple reactive state management

/**
 * Create a reactive store
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    /**
     * Get current state
     */
    getState() {
      return state;
    },

    /**
     * Update state (shallow merge)
     */
    setState(updates) {
      const prevState = state;
      state = { ...state, ...updates };

      // Notify listeners
      for (const listener of listeners) {
        listener(state, prevState);
      }
    },

    /**
     * Subscribe to state changes
     */
    subscribe(listener) {
      listeners.add(listener);

      // Return unsubscribe function
      return () => {
        listeners.delete(listener);
      };
    },

    /**
     * Reset to initial state
     */
    reset() {
      this.setState(initialState);
    },
  };
}

// Global application state
export const appState = createStore({
  // Auth
  isAuthenticated: false,
  user: null,

  // Navigation
  currentView: 'login', // login, brains, editor, chat, live, executions
  currentBrainId: null,
  currentExecId: null,

  // Data
  brains: [],
  currentBrain: null,
  selectedNeuronId: null,

  // Execution
  execution: null,
  executions: [], // List of all executions

  // UI
  isLoading: false,
  error: null,
  showExecutionsPanel: false, // Toggle for executions panel visibility
});

// Convenience methods
export function setAuthenticated(isAuthenticated, user = null) {
  appState.setState({
    isAuthenticated,
    user,
    currentView: isAuthenticated ? 'brains' : 'login',
  });
}

export function setCurrentBrain(brain) {
  appState.setState({
    currentBrain: brain,
    currentBrainId: brain?.id || null,
    selectedNeuronId: null,
  });
}

export function setSelectedNeuron(neuronId) {
  appState.setState({ selectedNeuronId: neuronId });
}

export function navigateTo(view, params = {}) {
  appState.setState({
    currentView: view,
    ...params,
  });
}

export function setExecutions(executions) {
  appState.setState({ executions });
}

export function toggleExecutionsPanel() {
  const current = appState.getState().showExecutionsPanel;
  appState.setState({ showExecutionsPanel: !current });
}
