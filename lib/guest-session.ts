/**
 * Utilities for guest session tokens on public shared agents.
 *
 * Password flow:
 *   1. Owner sets a password → stored as HMAC-SHA256(password, secret)
 *   2. Guest submits password → we hash it the same way and compare
 *   3. On match → return a session token = HMAC-SHA256("session:" + shareToken, secret)
 *   4. Guest stores token in sessionStorage, sends as X-Guest-Token header
 *   5. Chat API re-derives the expected token and compares
 *
 * The session token is deterministic per share link — all verified guests
 * of the same link get the same token, which is fine for this use-case.
 */

import { createHmac } from 'crypto';

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error('BETTER_AUTH_SECRET is not set');
  return s;
}

/** Hash a plain-text password for storage. */
export function hashPassword(password: string): string {
  return createHmac('sha256', secret()).update(password).digest('hex');
}

/** Verify a submitted password against a stored hash. */
export function verifyPassword(submitted: string, storedHash: string): boolean {
  const h = hashPassword(submitted);
  // Constant-time comparison to avoid timing attacks
  if (h.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}

/** Derive the expected session token for a share link. */
export function makeSessionToken(shareToken: string): string {
  return createHmac('sha256', secret()).update(`session:${shareToken}`).digest('hex');
}

/** Verify the session token from a guest request. */
export function verifySessionToken(shareToken: string, token: string): boolean {
  const expected = makeSessionToken(shareToken);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
