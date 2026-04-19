import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { lineOaChannel, lineRichMenu } from '@/db/schema';
import { deleteDeployedRichMenu } from '@/features/line-oa/webhook/rich-menu';
import type { RichMenuAreaConfig } from '@/features/line-oa/webhook/rich-menu';

const boundsSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).optional();

const areaSchema = z.object({
  label: z.string().min(1).max(30),
  emoji: z.string().min(1).max(10),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  bounds: boundsSchema,
  action: z.union([
    z.object({ type: z.literal('message'), text: z.string() }),
    z.object({ type: z.literal('uri'), uri: z.string().url() }),
    z.object({
      type: z.literal('postback'),
      data: z.string().min(1),
      displayText: z.string().optional(),
    }),
  ]),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  chatBarText: z.string().min(1).max(14).optional(),
  areas: z.array(areaSchema).min(1).max(6).optional(),
});

async function verifyOwnership(menuId: string, userId: string) {
  const rows = await db
    .select({ menu: lineRichMenu, channelUserId: lineOaChannel.userId })
    .from(lineRichMenu)
    .innerJoin(lineOaChannel, eq(lineRichMenu.channelId, lineOaChannel.id))
    .where(eq(lineRichMenu.id, menuId))
    .limit(1);
  const row = rows[0];
  if (!row || row.channelUserId !== userId) return null;
  return row.menu;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { menuId } = await params;
  const menu = await verifyOwnership(menuId, authResult.user.id);
  if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Normalize message action: fallback empty text to label
  const areas: RichMenuAreaConfig[] | undefined = body.areas?.map((area) => ({
    ...area,
    action:
      area.action.type === 'message' && !area.action.text.trim()
        ? { type: 'message' as const, text: area.label }
        : area.action,
  }));

  const updated = await db
    .update(lineRichMenu)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.chatBarText !== undefined && { chatBarText: body.chatBarText }),
      ...(areas !== undefined && { areas, lineMenuId: null, status: 'draft' }),
      updatedAt: new Date(),
    })
    .where(eq(lineRichMenu.id, menuId))
    .returning();

  return NextResponse.json({ menu: updated[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { menuId } = await params;
  const menu = await verifyOwnership(menuId, authResult.user.id);
  if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteDeployedRichMenu(menuId, authResult.user.id);
  return new Response(null, { status: 204 });
}
