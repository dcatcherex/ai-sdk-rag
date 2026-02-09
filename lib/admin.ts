import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

export type AdminSession = {
  user: { id: string; email: string; name: string; image: string | null };
};

export const requireAdmin = async (): Promise<
  | { ok: true; session: AdminSession }
  | { ok: false; response: Response }
> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!ADMIN_EMAILS.includes(session.user.email)) {
    return {
      ok: false,
      response: Response.json({ error: 'Forbidden: admin only' }, { status: 403 }),
    };
  }

  return { ok: true, session: session as AdminSession };
};

export const isAdminEmail = (email: string): boolean =>
  ADMIN_EMAILS.includes(email);
