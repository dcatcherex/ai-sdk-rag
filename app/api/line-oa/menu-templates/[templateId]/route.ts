import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { lineRichMenuTemplate } from '@/db/schema';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { templateId } = await params;

  const deleted = await db
    .delete(lineRichMenuTemplate)
    .where(and(eq(lineRichMenuTemplate.id, templateId), eq(lineRichMenuTemplate.userId, session.user.id)))
    .returning({ id: lineRichMenuTemplate.id });

  if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new Response(null, { status: 204 });
}
