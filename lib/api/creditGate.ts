import { getCreditCost, getUserBalance, deductCredits, addCredits } from '@/lib/credits';

export interface CreditCheckResult {
    cost: number;
    error?: 'INSUFFICIENT_CREDITS';
    balance?: number;
}

/**
 * Check if user can afford the generation and deduct credits.
 * Uses this project's own credit system (lib/credits.ts).
 * KIE API costs are a platform expense — not exposed to users.
 */
export async function checkAndDeductCredits(
    userId: string | null,
    modelId: string,
    costOverride?: number,
): Promise<CreditCheckResult> {
    if (!userId) return { cost: 0 };

    const cost = costOverride ?? getCreditCost(modelId);
    const balance = await getUserBalance(userId);

    if (balance < cost) {
        return { cost, error: 'INSUFFICIENT_CREDITS', balance };
    }

    const result = await deductCredits({
        userId,
        amount: cost,
        description: `Generation: ${modelId}`,
    });

    if (!result.success) {
        return { cost, error: 'INSUFFICIENT_CREDITS', balance: result.balance };
    }

    return { cost, balance: result.balance };
}

/**
 * Refund credits after a failed generation.
 */
export async function refundGenerationCredits(
    userId: string | null,
    modelId: string,
    costOverride?: number,
): Promise<void> {
    if (!userId) return;

    const cost = costOverride ?? getCreditCost(modelId);
    await addCredits({
        userId,
        amount: cost,
        type: 'refund',
        description: `Refund: generation failed (${modelId})`,
    });
}
