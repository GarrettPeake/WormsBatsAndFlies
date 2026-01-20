// Simple hash-based router

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  /**
   * Register a route
   */
  register(pattern, handler) {
    this.routes.set(pattern, handler);
    return this;
  }

  /**
   * Navigate to a route
   */
  navigate(path, params = {}) {
    let url = path;

    // Replace params in path
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, value);
    }

    window.location.hash = url;
  }

  /**
   * Get current path
   */
  getPath() {
    return window.location.hash.slice(1) || '/';
  }

  /**
   * Handle route change
   */
  handleRoute() {
    const path = this.getPath();

    for (const [pattern, handler] of this.routes) {
      const match = this.matchRoute(pattern, path);
      if (match) {
        this.currentRoute = pattern;
        this.params = match.params;
        handler(match.params);
        return;
      }
    }

    // No match - navigate to default
    this.navigate('/');
  }

  /**
   * Match a route pattern against a path
   */
  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        // Parameter
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart !== pathPart) {
        // No match
        return null;
      }
    }

    return { params };
  }

  /**
   * Get current params
   */
  getParams() {
    return this.params;
  }

  /**
   * Start the router
   */
  start() {
    this.handleRoute();
  }
}

// Export singleton instance
export const router = new Router();

// Define routes
router
  .register('/', () => {
    window.dispatchEvent(new CustomEvent('route:home'));
  })
  .register('/login', () => {
    window.dispatchEvent(new CustomEvent('route:login'));
  })
  .register('/brains', () => {
    window.dispatchEvent(new CustomEvent('route:brains'));
  })
  .register('/brains/:id', (params) => {
    window.dispatchEvent(new CustomEvent('route:brain', { detail: params }));
  })
  .register('/brains/:id/edit', (params) => {
    window.dispatchEvent(new CustomEvent('route:editor', { detail: params }));
  })
  .register('/brains/:id/chat', (params) => {
    window.dispatchEvent(new CustomEvent('route:chat', { detail: params }));
  })
  .register('/brains/:id/live', (params) => {
    window.dispatchEvent(new CustomEvent('route:live', { detail: params }));
  })
  .register('/brains/:id/live/:execId', (params) => {
    window.dispatchEvent(new CustomEvent('route:live', { detail: params }));
  });
