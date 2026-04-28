import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';
import { AGRISPARK_TEMPLATES } from '@/features/line-oa/flex/seeds/agrispark-templates';

export async function POST() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const results = { inserted: 0, skipped: 0 };

  for (const seed of AGRISPARK_TEMPLATES) {
    const existing = await db
      .select({ id: lineFlexTemplate.id })
      .from(lineFlexTemplate)
      .where(eq(lineFlexTemplate.name, seed.name))
      .limit(1);

    if (existing[0]) {
      results.skipped++;
      continue;
    }

    const now = new Date();
    await db.insert(lineFlexTemplate).values({
      id: nanoid(),
      name: seed.name,
      description: seed.description,
      category: seed.category,
      tags: seed.tags,
      flexPayload: seed.flexPayload,
      altText: seed.altText,
      previewImageUrl: null,
      catalogStatus: 'published',
      createdBy: null,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    results.inserted++;
  }

  return Response.json({ ok: true, ...results });
}
