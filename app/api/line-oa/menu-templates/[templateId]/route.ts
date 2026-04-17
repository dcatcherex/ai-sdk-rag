import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { lineRichMenuTemplate } from '@/db/schema';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { templateId } = await params;

  const deleted = await db
    .delete(lineRichMenuTemplate)
    .where(and(eq(lineRichMenuTemplate.id, templateId), eq(lineRichMenuTemplate.userId, authResult.user.id)))
    .returning({ id: lineRichMenuTemplate.id });

  if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new Response(null, { status: 204 });
}
