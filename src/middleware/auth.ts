// JWT authentication middleware

import { Context, Next } from 'hono';
import { verifyToken, extractBearerToken } from '../utils/auth';
import type { Env, ContextVariables } from '../types';

/**
 * Middleware to verify JWT token on protected routes
 * Supports both Authorization header and query parameter (for WebSocket connections)
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: ContextVariables }>,
  next: Next
) {
  // Try Authorization header first
  const authHeader = c.req.header('Authorization');
  let token = extractBearerToken(authHeader ?? null);

  // Fall back to query parameter (needed for WebSocket connections which can't send headers)
  if (!token) {
    const url = new URL(c.req.url);
    token = url.searchParams.get('token');
  }

  if (!token) {
    return c.json(
      { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
      401
    );
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(
      { error: 'Unauthorized', message: 'Invalid or expired token' },
      401
    );
  }

  // Attach user to context for use in handlers
  c.set('user', payload);

  await next();
}
