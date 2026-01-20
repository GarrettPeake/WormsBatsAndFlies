// JWT authentication middleware

import { Context, Next } from 'hono';
import { verifyToken, extractBearerToken } from '../utils/auth';
import type { Env } from '../types';

/**
 * Middleware to verify JWT token on protected routes
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader ?? null);

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

/**
 * Optional auth middleware - doesn't require token but attaches user if present
 */
export async function optionalAuthMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader ?? null);

  if (token) {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (payload) {
      c.set('user', payload);
    }
  }

  await next();
}
