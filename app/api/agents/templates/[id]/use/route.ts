import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [template] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true)))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const now = new Date();
  const copy = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    name: template.name,
    description: template.description,
    systemPrompt: template.systemPrompt,
    structuredBehavior: template.structuredBehavior,
    modelId: template.modelId,
    enabledTools: template.enabledTools,
    documentIds: [],
    skillIds: [],
    brandId: null,
    isPublic: false,
    starterPrompts: template.starterPrompts,
    isTemplate: false,
    templateId: template.id,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(agent).values(copy);

  return NextResponse.json({ agent: copy }, { status: 201 });
}
