import { requireUser } from "@/lib/auth-server";
import {
  getConnectedAccounts,
  disconnectAccount,
} from '@/features/content-marketing/social-account-service';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const accounts = await getConnectedAccounts(authResult.user.id);
  return Response.json({ accounts });
}

export async function DELETE(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('id');
  if (!accountId) return new Response('Missing id', { status: 400 });

  await disconnectAccount(accountId, authResult.user.id);
  return new Response(null, { status: 204 });
}
