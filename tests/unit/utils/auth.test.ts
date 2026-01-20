import { describe, it, expect } from 'vitest';
import {
  createToken,
  verifyToken,
  extractBearerToken,
  hashPassword,
  verifyPassword,
} from '../../../src/utils/auth';

describe('auth utilities', () => {
  const testSecret = 'test-secret-key-for-jwt-signing';

  describe('createToken', () => {
    it('should create a valid JWT token', async () => {
      const { token, expiresAt } = await createToken('admin', testSecret);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts

      expect(expiresAt).toBeDefined();
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const { token } = await createToken('admin', testSecret);
      const payload = await verifyToken(token, testSecret);

      expect(payload).toBeDefined();
      expect(payload?.sub).toBe('admin');
    });

    it('should reject token with wrong secret', async () => {
      const { token } = await createToken('admin', testSecret);
      const payload = await verifyToken(token, 'wrong-secret');

      expect(payload).toBeNull();
    });

    it('should reject malformed tokens', async () => {
      const payload = await verifyToken('not-a-valid-token', testSecret);
      expect(payload).toBeNull();
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = extractBearerToken('Bearer abc123');
      expect(token).toBe('abc123');
    });

    it('should return null for invalid headers', () => {
      expect(extractBearerToken(null)).toBeNull();
      expect(extractBearerToken('')).toBeNull();
      expect(extractBearerToken('Basic abc123')).toBeNull();
      expect(extractBearerToken('Bearer')).toBe('');
    });
  });

  describe('hashPassword', () => {
    it('should create a hex hash', async () => {
      const hash = await hashPassword('password123');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]{64}$/i.test(hash)).toBe(true); // SHA-256 produces 64 hex chars
    });

    it('should produce consistent hashes', async () => {
      const hash1 = await hashPassword('password123');
      const hash2 = await hashPassword('password123');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different passwords', async () => {
      const hash1 = await hashPassword('password1');
      const hash2 = await hashPassword('password2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const hash = await hashPassword('password123');
      const isValid = await verifyPassword('password123', hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword('password123');
      const isValid = await verifyPassword('wrongpassword', hash);

      expect(isValid).toBe(false);
    });
  });
});
