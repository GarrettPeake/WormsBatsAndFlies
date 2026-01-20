// Worker entry point - main router

import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import authHandlers from './handlers/auth';
import brainsHandlers from './handlers/brains';
import executionsHandlers from './handlers/executions';
import openaiHandlers from './handlers/openai';
import type { Env } from './types';

// Re-export Durable Object for Cloudflare
export { BrainExecution } from './durable-objects/BrainExecution';

// Create main app
const app = new Hono<{ Bindings: Env }>();

// Apply CORS middleware to all routes
app.use('*', corsMiddleware);

// Public routes
app.route('/api/auth', authHandlers);

// Protected routes - require authentication
app.use('/api/brains/*', authMiddleware);
app.use('/api/executions/*', authMiddleware);

// Brain management
app.route('/api', brainsHandlers);

// Execution control
app.route('/api', executionsHandlers);

// OpenAI-compatible endpoint (can optionally require auth)
app.route('/v1', openaiHandlers);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for static files (serve frontend)
app.get('*', async (c) => {
  // In production, static files are served from the [site] config in wrangler.toml
  // This route handles any non-API requests for SPA routing
  const url = new URL(c.req.url);

  // If it's an API route that wasn't matched, return 404
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) {
    return c.json({ error: 'Not Found', message: 'Endpoint not found' }, 404);
  }

  // For SPA routing, return a message (actual static serving is handled by wrangler)
  return c.text('WormsBatsAndFlies - LLM Orchestration System');
});

// Export the fetch handler
export default {
  fetch: app.fetch,
};
