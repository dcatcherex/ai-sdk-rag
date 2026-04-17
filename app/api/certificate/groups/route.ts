import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getCurrentUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { recipientGroup } from '@/db/schema';

async function getUserId()  {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

// GET /api/certificate/groups — list all groups for the user
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await db
    .select()
    .from(recipientGroup)
    .where(eq(recipientGroup.userId, userId))
    .orderBy(desc(recipientGroup.updatedAt));

  return NextResponse.json({ groups });
}

// POST /api/certificate/groups — create a new group
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    name: string;
    description?: string;
    recipients?: Array<{ id: string; values: Record<string, string> }>;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const id = nanoid();
  const [group] = await db
    .insert(recipientGroup)
    .values({
      id,
      userId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      recipients: body.recipients ?? [],
    })
    .returning();

  return NextResponse.json({ group });
}
