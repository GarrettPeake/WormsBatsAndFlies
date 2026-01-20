// Login form component

import { api } from '../lib/api-client.js';
import { setAuthenticated } from '../lib/state.js';
import { router } from '../lib/router.js';

class LoginForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupForm();
  }

  setupForm() {
    const form = this.shadowRoot.querySelector('form');
    const errorEl = this.shadowRoot.querySelector('.form-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';

      const username = form.username.value.trim();
      const password = form.password.value;

      if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Logging in...';

      try {
        await api.login(username, password);
        setAuthenticated(true, { username });
        router.navigate('/brains');
      } catch (error) {
        errorEl.textContent = error.message || 'Login failed';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
      }
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--color-bg-primary);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          box-shadow: var(--shadow-lg);
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          margin-bottom: var(--space-8);
        }

        .logo svg {
          color: var(--color-primary);
        }

        .logo-text {
          font-size: var(--text-xl);
          font-weight: 600;
        }

        h1 {
          text-align: center;
          font-size: var(--text-2xl);
          margin-bottom: var(--space-2);
        }

        .subtitle {
          text-align: center;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-6);
        }

        .form-error {
          min-height: 1.5em;
          margin-bottom: var(--space-4);
        }

        button[type="submit"] {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border-width: 2px;
        }

        .footer {
          margin-top: var(--space-6);
          text-align: center;
          color: var(--color-text-muted);
          font-size: var(--text-xs);
        }
      </style>

      <div class="login-card">
        <div class="logo">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
          <span class="logo-text">WormsBatsAndFlies</span>
        </div>

        <h1>Welcome Back</h1>
        <p class="subtitle">Sign in to continue to your neural networks</p>

        <form>
          <div class="form-error"></div>

          <div class="form-group">
            <label class="form-label" for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              class="input"
              placeholder="Enter your username"
              autocomplete="username"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              class="input"
              placeholder="Enter your password"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" class="btn btn--primary btn--lg">
            Login
          </button>
        </form>

        <p class="footer">
          LLM Orchestration System inspired by Neal Stephenson's Anathem
        </p>
      </div>
    `;
  }
}

customElements.define('login-form', LoginForm);
