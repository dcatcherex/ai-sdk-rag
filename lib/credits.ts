import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { userCredit, creditTransaction } from '@/db/schema';
import { KIE_AUDIO_MODELS } from '@/lib/models/kie-audio';
import { KIE_VIDEO_MODELS } from '@/lib/models/kie-video';
import { KIE_IMAGE_MODELS } from '@/lib/models/kie-image';

// Credit cost per model (per AI request)
const MODEL_CREDIT_COSTS: Record<string, number> = {
  'google/gemini-2.5-flash-lite': 1,
  'google/gemini-3-flash': 2,
  'google/gemini-3-pro-preview': 5,
  'google/gemini-2.5-flash-image': 3,
  'openai/gpt-5-nano': 1,
  'openai/gpt-5-mini': 3,
  'openai/gpt-5.2': 8,
  'anthropic/claude-haiku-4.5': 2,
  'anthropic/claude-sonnet-4.5': 5,
  'anthropic/claude-opus-4.6': 10,
};

const DEFAULT_CREDIT_COST = 2;

export const SIGNUP_BONUS_CREDITS = 100;

export type TransactionType = 'grant' | 'usage' | 'refund' | 'signup_bonus' | 'topup';

const KIE_MODELS = [...KIE_AUDIO_MODELS, ...KIE_VIDEO_MODELS, ...KIE_IMAGE_MODELS];

export const getCreditCost = (modelId: string): number => {
  if (modelId in MODEL_CREDIT_COSTS) return MODEL_CREDIT_COSTS[modelId]!;

  // Fall back to costPerGeneration from KIE model definitions
  const kieModel = KIE_MODELS.find(m => m.id === modelId);
  if (kieModel?.costPerGeneration) return kieModel.costPerGeneration;

  return DEFAULT_CREDIT_COST;
};

export const getUserBalance = async (userId: string): Promise<number> => {
  const result = await db
    .select({ balance: userCredit.balance })
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1);

  return result[0]?.balance ?? 0;
};

export const ensureUserCreditRow = async (userId: string): Promise<void> => {
  await db
    .insert(userCredit)
    .values({ userId, balance: 0 })
    .onConflictDoNothing();
};

export const addCredits = async (options: {
  userId: string;
  amount: number;
  type: TransactionType;
  description?: string;
}): Promise<{ balance: number }> => {
  const { userId, amount, type, description } = options;

  await ensureUserCreditRow(userId);

  const updated = await db
    .update(userCredit)
    .set({
      balance: sql`${userCredit.balance} + ${amount}`,
    })
    .where(eq(userCredit.userId, userId))
    .returning({ balance: userCredit.balance });

  const newBalance = updated[0]?.balance ?? 0;

  await db.insert(creditTransaction).values({
    id: nanoid(),
    userId,
    amount,
    balance: newBalance,
    type,
    description,
  });

  return { balance: newBalance };
};

export const deductCredits = async (options: {
  userId: string;
  amount: number;
  description?: string;
}): Promise<{ balance: number; success: boolean }> => {
  const { userId, amount, description } = options;

  const current = await getUserBalance(userId);
  if (current < amount) {
    return { balance: current, success: false };
  }

  const result = await addCredits({
    userId,
    amount: -amount,
    type: 'usage',
    description,
  });

  return { balance: result.balance, success: true };
};
