// UUID generation utilities

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID() which is available in Cloudflare Workers
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a short ID for more human-friendly references
 * Uses first 8 characters of a UUID
 */
export function generateShortId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
