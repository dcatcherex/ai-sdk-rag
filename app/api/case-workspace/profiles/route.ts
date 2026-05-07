import { requireUser } from '@/lib/auth-server';
import {
  createCaseWorkspaceProfile,
  listCaseWorkspaceProfiles,
} from '@/features/case-workspace/service';
import { createWorkspaceProfileInputSchema } from '@/features/case-workspace/schema';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const profiles = await listCaseWorkspaceProfiles({ userId: auth.user.id });
  return Response.json({ profiles });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createWorkspaceProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const profile = await createCaseWorkspaceProfile(parsed.data, { userId: auth.user.id });
  return Response.json({ profile }, { status: 201 });
}
