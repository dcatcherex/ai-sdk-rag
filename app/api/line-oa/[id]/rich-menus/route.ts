import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { lineOaChannel, lineRichMenu } from '@/db/schema';
import type { RichMenuAreaConfig } from '@/features/line-oa/webhook/rich-menu';

const areaSchema = z.object({
  label: z.string().min(1).max(30),
  emoji: z.string().min(1).max(10),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  action: z.union([
    // text defaults to label when empty — LINE requires non-empty message text
    z.object({ type: z.literal('message'), text: z.string() }),
    z.object({ type: z.literal('uri'), uri: z.string().url() }),
    z.object({
      type: z.literal('postback'),
      data: z.string().min(1),
      displayText: z.string().optional(),
    }),
  ]),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  chatBarText: z.string().min(1).max(14).default('เมนู'),
  areas: z.array(areaSchema).min(1).max(6),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  // Verify ownership
  const channel = await db
    .select({ id: lineOaChannel.id })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, id), eq(lineOaChannel.userId, authResult.user.id)))
    .limit(1);
  if (channel.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const menus = await db
    .select()
    .from(lineRichMenu)
    .where(eq(lineRichMenu.channelId, id))
    .orderBy(desc(lineRichMenu.createdAt));

  return NextResponse.json({ menus });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  const channel = await db
    .select({ id: lineOaChannel.id })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, id), eq(lineOaChannel.userId, authResult.user.id)))
    .limit(1);
  if (channel.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Normalize message action: if text is empty, fall back to the button label
  const areas: RichMenuAreaConfig[] = body.areas.map((area) => ({
    ...area,
    action:
      area.action.type === 'message' && !area.action.text.trim()
        ? { type: 'message' as const, text: area.label }
        : area.action,
  }));

  const now = new Date();
  const newMenu = {
    id: crypto.randomUUID(),
    channelId: id,
    lineMenuId: null,
    name: body.name,
    chatBarText: body.chatBarText,
    areas,
    isDefault: false,
    status: 'draft' as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(lineRichMenu).values(newMenu);
  return NextResponse.json({ menu: newMenu }, { status: 201 });
}
