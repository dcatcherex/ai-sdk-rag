import { requireUser } from '@/lib/auth-server';
import { createContact, listContacts } from '@/features/case-workspace/service';
import { createContactInputSchema } from '@/features/case-workspace/schema';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  if (!profileId) {
    return Response.json({ error: 'profileId is required' }, { status: 400 });
  }

  const contacts = await listContacts(profileId, { userId: auth.user.id });
  return Response.json({ contacts });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createContactInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const contact = await createContact(parsed.data, { userId: auth.user.id });
  return Response.json({ contact }, { status: 201 });
}
