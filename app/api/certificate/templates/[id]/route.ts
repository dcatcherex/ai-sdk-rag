import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { certificateTemplate } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { TextFieldConfig } from '@/lib/certificate-generator';

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** GET /api/certificate/templates/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [template] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)));

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template });
}

/**
 * PUT /api/certificate/templates/[id]
 * JSON body: { name?, description?, fields? }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string; fields?: TextFieldConfig[] };

  const [updated] = await db
    .update(certificateTemplate)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.fields !== undefined && { fields: body.fields }),
    })
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template: updated });
}

/** DELETE /api/certificate/templates/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db
    .delete(certificateTemplate)
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
