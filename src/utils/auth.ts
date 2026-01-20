// Authentication utilities - JWT handling

import * as jose from 'jose';
import type { AuthPayload } from '../types';

const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRY = '15m';

/**
 * Create a JWT token for the admin user
 */
export async function createToken(
  username: string,
  secret: string
): Promise<{ token: string; expiresAt: string }> {
  const secretKey = new TextEncoder().encode(secret);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const token = await new jose.SignJWT({ sub: username })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secretKey);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<AuthPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM],
    });

    return {
      sub: payload.sub as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verify password against stored hash using timing-safe comparison
 * Note: In a real implementation, you'd use Argon2. For Cloudflare Workers,
 * we use a simple hash comparison since Argon2 isn't natively available.
 * For production, consider using a KV-stored pre-hashed password or
 * an external auth service.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // For simplicity, we're using SHA-256 hash comparison
  // In production, use Argon2 via WebAssembly or external service
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Timing-safe comparison
  if (hashHex.length !== storedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < hashHex.length; i++) {
    result |= hashHex.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Hash a password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
