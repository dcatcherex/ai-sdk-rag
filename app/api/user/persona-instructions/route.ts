import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { personaCustomization } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { SystemPromptKey } from '@/lib/prompt';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({ personaKey: personaCustomization.personaKey, extraInstructions: personaCustomization.extraInstructions })
    .from(personaCustomization)
    .where(eq(personaCustomization.userId, session.user.id));

  // Return as a map { personaKey: extraInstructions }
  const result: Record<string, string> = {};
  for (const row of rows) result[row.personaKey] = row.extraInstructions;
  return Response.json(result);
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { personaKey, extraInstructions } = await req.json() as { personaKey: SystemPromptKey; extraInstructions: string };
  if (!personaKey) return Response.json({ error: 'personaKey is required' }, { status: 400 });

  const trimmed = (extraInstructions ?? '').trim();

  if (!trimmed) {
    // Empty — delete the customization
    await db
      .delete(personaCustomization)
      .where(and(eq(personaCustomization.userId, session.user.id), eq(personaCustomization.personaKey, personaKey)));
  } else {
    await db
      .insert(personaCustomization)
      .values({ userId: session.user.id, personaKey, extraInstructions: trimmed.slice(0, 2000) })
      .onConflictDoUpdate({
        target: [personaCustomization.userId, personaCustomization.personaKey],
        set: { extraInstructions: trimmed.slice(0, 2000), updatedAt: new Date() },
      });
  }

  return Response.json({ ok: true });
}
