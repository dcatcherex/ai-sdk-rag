import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { lineRichMenuTemplate } from '@/db/schema';
import type { RichMenuAreaConfig } from '@/features/line-oa/webhook/rich-menu';

const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const areaSchema = z.object({
  label: z.string().min(1).max(30),
  emoji: z.string().min(1).max(10),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  bounds: boundsSchema.optional(),
  action: z.union([
    z.object({ type: z.literal('message'), text: z.string() }),
    z.object({ type: z.literal('uri'), uri: z.string().url() }),
    z.object({ type: z.literal('postback'), data: z.string(), displayText: z.string().optional() }),
  ]),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  chatBarText: z.string().min(1).max(14).default('เมนู'),
  areas: z.array(areaSchema).min(1).max(6),
});

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const templates = await db
    .select()
    .from(lineRichMenuTemplate)
    .where(eq(lineRichMenuTemplate.userId, authResult.user.id))
    .orderBy(desc(lineRichMenuTemplate.createdAt));

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, chatBarText, areas } = parsed.data;
  const now = new Date();

  const template = {
    id: crypto.randomUUID(),
    userId: authResult.user.id,
    name,
    chatBarText,
    areas: areas as RichMenuAreaConfig[],
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(lineRichMenuTemplate).values(template);
  return NextResponse.json({ template }, { status: 201 });
}
