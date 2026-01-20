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

/**
 * Create a computed value that updates when dependencies change
 */
export function computed(store, selector, callback) {
  let prevValue = selector(store.getState());

  return store.subscribe((state) => {
    const newValue = selector(state);
    if (newValue !== prevValue) {
      prevValue = newValue;
      callback(newValue);
    }
  });
}

// Global application state
export const appState = createStore({
  // Auth
  isAuthenticated: false,
  user: null,

  // Navigation
  currentView: 'login', // login, brains, editor, chat, live
  currentBrainId: null,
  currentExecId: null,

  // Data
  brains: [],
  currentBrain: null,
  selectedNeuronId: null,

  // Execution
  execution: null,
  isExecuting: false,

  // UI
  isLoading: false,
  error: null,
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

export function setLoading(isLoading) {
  appState.setState({ isLoading });
}

export function setError(error) {
  appState.setState({ error });
}

export function clearError() {
  appState.setState({ error: null });
}
