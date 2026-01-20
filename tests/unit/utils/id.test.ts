import { describe, it, expect } from 'vitest';
import { generateId, generateShortId, isValidUUID } from '../../../src/utils/id';

describe('id utilities', () => {
  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();
      expect(isValidUUID(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateShortId', () => {
    it('should generate an 8-character ID', () => {
      const id = generateShortId();
      expect(id.length).toBe(8);
    });

    it('should only contain hexadecimal characters', () => {
      const id = generateShortId();
      expect(/^[0-9a-f]{8}$/i.test(id)).toBe(true);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4', () => {
      expect(isValidUUID('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(false); // wrong version
      expect(isValidUUID('')).toBe(false);
    });
  });
});
