// Worker entry point - main router

import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import authHandlers from './handlers/auth';
import brainsHandlers from './handlers/brains';
import executionsHandlers from './handlers/executions';
import openaiHandlers from './handlers/openai';
import type { Env, ContextVariables } from './types';

// Re-export Durable Object for Cloudflare
export { BrainExecution } from './durable-objects/BrainExecution';

// Create main app
const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

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
  const pathname = new URL(c.req.url).pathname;

  // If it's an API route that wasn't matched, return 404
  if (pathname.startsWith('/api/') || pathname.startsWith('/v1/')) {
    return c.json({ error: 'Not Found', message: 'Endpoint not found' }, 404);
  }

  // Serve static assets using the ASSETS binding
  const response = await c.env.ASSETS.fetch(c.req.raw);

  // If the asset was found, return it
  if (response.status !== 404) {
    return response;
  }

  // For SPA routing: serve index.html for any non-file routes
  const indexRequest = new Request(new URL('/index.html', c.req.url), c.req.raw);
  return c.env.ASSETS.fetch(indexRequest);
});

// Export the fetch handler
export default {
  fetch: app.fetch,
};
