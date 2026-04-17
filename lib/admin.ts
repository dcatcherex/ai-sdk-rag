// Thin facade over the auth seam. Kept so existing callers that import
// `requireAdmin` / `isAdminEmail` from `@/lib/admin` do not need to change.
// New code should prefer importing from `@/lib/auth-server` directly.

import { requireAdmin as requireAdminFromAuth, type AppUser } from '@/lib/auth-server';

export { isAdminEmail } from '@/lib/admin-emails';

export type AdminSession = {
  user: { id: string; email: string; name: string; image: string | null };
};

// Legacy shape: existing callers destructure `session.user`. We wrap the
// new `{ user }` return as `{ session: { user } }` so no caller breaks.
export const requireAdmin = async (): Promise<
  | { ok: true; session: AdminSession }
  | { ok: false; response: Response }
> => {
  const result = await requireAdminFromAuth();
  if (!result.ok) return result;
  const u: AppUser = result.user;
  return {
    ok: true,
    session: {
      user: { id: u.id, email: u.email, name: u.name, image: u.image },
    },
  };
};
