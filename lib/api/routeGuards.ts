import { NextResponse } from 'next/server';
import { checkAndDeductCredits } from '@/lib/api/creditGate';
import { checkServerRateLimit } from '@/lib/api/rateLimit';

/**
 * Shared route guard utilities used across all generation routes.
 *
 * Note: The image route has its own `enforceCredits` variant in
 * `image/_lib/guards.ts` that passes a `creditContext` (image quality)
 * for fine-grained cost calculation. Use this simpler version for
 * audio, video, speech, and text routes.
 */

export const enforceRateLimit = async (userId: string) => {
    const rateCheck = await checkServerRateLimit(userId);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: rateCheck.reason },
            { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds || 60) } }
        );
    }
    return null;
};

export const enforceCredits = async (userId: string, modelId: string, costOverride?: number) => {
    const creditResult = await checkAndDeductCredits(userId, modelId, costOverride);
    if (creditResult.error === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json(
            {
                error: 'Insufficient credits. Please purchase more credits to continue.',
                insufficientCredits: true,
                requiredCredits: creditResult.cost,
            },
            { status: 402 }
        );
    }
    return null;
};

/**
 * Returns the KIE API key from environment variables, or null if not configured.
 */
export const getKieApiKey = (): string | null => {
    return process.env.KIE_API_KEY || process.env.KIE_AI_API_KEY || null;
};
