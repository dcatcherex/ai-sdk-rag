import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { verification } from "@/db/schema";

/**
 * Generates a server-side magic link by inserting directly into Better Auth's
 * verification table. Used for passwordless invite auto-login — the invite link
 * itself is proof of email ownership, so no email needs to be sent.
 */
export async function generateServerMagicLink(
  email: string,
  callbackURL: string,
  errorCallbackURL = callbackURL,
  expiresInMs = 7 * 24 * 60 * 60 * 1000,
): Promise<string> {
  const token = nanoid(32);
  const now = new Date();
  const normalizedEmail = email.trim().toLowerCase();

  await db.insert(verification).values({
    id: nanoid(),
    // Better Auth magic-link verification expects the raw token in `identifier`
    // and the JSON payload, including email, in `value`.
    identifier: token,
    value: JSON.stringify({ email: normalizedEmail }),
    expiresAt: new Date(now.getTime() + expiresInMs),
    createdAt: now,
    updatedAt: now,
  });

  return `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callbackURL)}&errorCallbackURL=${encodeURIComponent(errorCallbackURL)}`;
}
