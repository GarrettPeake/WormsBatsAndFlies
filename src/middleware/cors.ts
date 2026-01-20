// CORS middleware

import { Context, Next } from 'hono';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8787',
  'https://worms-bats-and-flies.workers.dev',
];

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

/**
 * CORS middleware for handling cross-origin requests
 */
export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin');

  // Check if origin is allowed
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
        'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Continue with request
  await next();

  // Add CORS headers to response
  if (isAllowedOrigin) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
}
