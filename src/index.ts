// Worker entry point - main router

import { Hono } from 'hono';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
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
  const url = new URL(c.req.url);

  // If it's an API route that wasn't matched, return 404
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) {
    return c.json({ error: 'Not Found', message: 'Endpoint not found' }, 404);
  }

  // Serve static assets from KV
  try {
    return await getAssetFromKV(
      {
        request: c.req.raw,
        waitUntil: (promise) => c.executionCtx.waitUntil(promise),
      },
      {
        ASSET_NAMESPACE: (c.env as any).__STATIC_CONTENT,
        ASSET_MANIFEST: (c.env as any).__STATIC_CONTENT_MANIFEST,
      }
    );
  } catch (e) {
    // If asset not found, serve index.html for SPA routing
    try {
      const notFoundResponse = await getAssetFromKV(
        {
          request: new Request(`${url.origin}/index.html`, c.req.raw),
          waitUntil: (promise) => c.executionCtx.waitUntil(promise),
        },
        {
          ASSET_NAMESPACE: (c.env as any).__STATIC_CONTENT,
          ASSET_MANIFEST: (c.env as any).__STATIC_CONTENT_MANIFEST,
        }
      );
      return new Response(notFoundResponse.body, {
        ...notFoundResponse,
        status: 200,
      });
    } catch (e) {
      return c.text('Not Found', 404);
    }
  }
});

// Export the fetch handler
export default {
  fetch: app.fetch,
};
