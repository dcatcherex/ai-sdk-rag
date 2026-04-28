import { eq } from 'drizzle-orm';

import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const templates = await db
    .select()
    .from(lineFlexTemplate)
    .where(eq(lineFlexTemplate.catalogStatus, 'published'))
    .orderBy(lineFlexTemplate.category, lineFlexTemplate.name);

  return Response.json({ templates });
}
