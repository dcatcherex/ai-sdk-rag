import { requireUser } from "@/lib/auth-server";
import { disconnectGoogleAccount } from '@/lib/google/oauth';

export async function POST() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  await disconnectGoogleAccount(authResult.user.id);
  return Response.json({ ok: true });
}
