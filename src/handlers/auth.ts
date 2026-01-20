// Authentication handlers

import { Hono } from 'hono';
import { createToken, verifyPassword } from '../utils/auth';
import type { Env, LoginRequest, LoginResponse } from '../types';

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/login
 * Login with username and password, returns JWT token
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json<LoginRequest>();

    if (!body.username || !body.password) {
      return c.json(
        { error: 'Bad Request', message: 'Username and password are required' },
        400
      );
    }

    // Verify credentials
    const isValidUsername = body.username === c.env.ADMIN_USERNAME;
    const isValidPassword = await verifyPassword(body.password, c.env.ADMIN_PASSWORD_HASH);

    if (!isValidUsername || !isValidPassword) {
      return c.json(
        { error: 'Unauthorized', message: 'Invalid username or password' },
        401
      );
    }

    // Create JWT token
    const { token, expiresAt } = await createToken(body.username, c.env.JWT_SECRET);

    const response: LoginResponse = {
      token,
      expiresAt,
    };

    return c.json(response);
  } catch (error) {
    console.error('Login error:', error);
    return c.json(
      { error: 'Internal Server Error', message: 'Login failed' },
      500
    );
  }
});

/**
 * GET /api/auth/verify
 * Verify the current token is valid
 */
auth.get('/verify', async (c) => {
  // This endpoint is protected by authMiddleware
  // If we reach here, the token is valid
  const user = c.get('user');
  return c.json({ valid: true, user });
});

export default auth;
