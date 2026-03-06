import { db } from '@/lib/db';
import { userModelScore } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type ModelScoreMap = Map<string, number>; // key: `${modelId}::${persona}`

export async function getUserModelScores(userId: string): Promise<ModelScoreMap> {
  try {
    const rows = await db
      .select({ modelId: userModelScore.modelId, persona: userModelScore.persona, score: userModelScore.score })
      .from(userModelScore)
      .where(eq(userModelScore.userId, userId));
    return new Map(rows.map((r) => [`${r.modelId}::${r.persona}`, r.score]));
  } catch {
    return new Map();
  }
}

export async function updateModelScore(options: {
  userId: string;
  modelId: string;
  persona: string;
  previousReaction: string | null;
  newReaction: string | null;
}): Promise<void> {
  const { userId, modelId, persona, previousReaction, newReaction } = options;
  let upDelta = 0, downDelta = 0;
  if (previousReaction === 'thumbs_up') upDelta -= 1;
  if (previousReaction === 'thumbs_down') downDelta -= 1;
  if (newReaction === 'thumbs_up') upDelta += 1;
  if (newReaction === 'thumbs_down') downDelta += 1;
  if (upDelta === 0 && downDelta === 0) return;

  try {
    const existing = await db
      .select({ id: userModelScore.id, thumbsUp: userModelScore.thumbsUp, thumbsDown: userModelScore.thumbsDown })
      .from(userModelScore)
      .where(and(eq(userModelScore.userId, userId), eq(userModelScore.modelId, modelId), eq(userModelScore.persona, persona)))
      .limit(1);

    if (existing.length === 0) {
      const up = Math.max(0, upDelta), down = Math.max(0, downDelta);
      await db.insert(userModelScore).values({ id: nanoid(), userId, modelId, persona, thumbsUp: up, thumbsDown: down, score: up - down });
    } else {
      const row = existing[0];
      const up = Math.max(0, row.thumbsUp + upDelta), down = Math.max(0, row.thumbsDown + downDelta);
      await db.update(userModelScore).set({ thumbsUp: up, thumbsDown: down, score: up - down, updatedAt: new Date() }).where(eq(userModelScore.id, row.id));
    }
  } catch (error) {
    console.error('Failed to update model score:', error);
  }
}
