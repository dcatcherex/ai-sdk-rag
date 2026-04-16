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
  expiresInMs = 7 * 24 * 60 * 60 * 1000,
): Promise<string> {
  const token = nanoid(48);
  const now = new Date();

  await db.insert(verification).values({
    id: nanoid(),
    identifier: email.trim().toLowerCase(),
    value: token,
    expiresAt: new Date(now.getTime() + expiresInMs),
    createdAt: now,
    updatedAt: now,
  });

  return `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callbackURL)}`;
}

/**
 * Generates a server-side password-reset token by inserting into Better Auth's
 * verification table. Used to redirect a signed-in passwordless user to the
 * set-password page without sending an email.
 */
export async function generatePasswordSetupToken(
  email: string,
  expiresInMs = 60 * 60 * 1000, // 1 hour
): Promise<string> {
  const token = nanoid(32);
  const now = new Date();

  await db.insert(verification).values({
    id: nanoid(),
    identifier: email.trim().toLowerCase(),
    value: token,
    expiresAt: new Date(now.getTime() + expiresInMs),
    createdAt: now,
    updatedAt: now,
  });

  return token;
}
