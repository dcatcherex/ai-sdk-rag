import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Pure HMAC-SHA256 verification. Signature must be in the form "sha256=<hex>".
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyHmacSignature(body: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) return false;

  const provided = signature.slice('sha256='.length);
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  // Pad to equal length before constant-time compare
  const a = Buffer.from(provided.padEnd(expected.length, '0'), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
