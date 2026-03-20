import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Server-Side Rate Limiter
 *
 * Limits generation requests per user using the existing toolRun table.
 *
 * Limits:
 *   - Per minute:  5 generations  (burst protection)
 *   - Per hour:   30 generations  (sustained abuse prevention)
 *   - Per day:   100 generations  (daily cap)
 */

interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    retryAfterSeconds?: number;
}

const LIMITS = {
    perMinute: { max: 5, windowMs: 60_000 },
    perHour: { max: 30, windowMs: 3_600_000 },
    perDay: { max: 100, windowMs: 86_400_000 },
} as const;

const MEDIA_SLUGS = ['audio', 'video', 'speech'];

export async function checkServerRateLimit(userId: string): Promise<RateLimitResult> {
    const now = new Date();

    const oneMinuteAgo = new Date(now.getTime() - LIMITS.perMinute.windowMs);
    const minuteCount = await db
        .select({ id: toolRun.id })
        .from(toolRun)
        .where(
            and(
                eq(toolRun.userId, userId),
                gte(toolRun.createdAt, oneMinuteAgo),
            )
        );

    if (minuteCount.length >= LIMITS.perMinute.max) {
        return {
            allowed: false,
            reason: `Rate limit: max ${LIMITS.perMinute.max} generations per minute. Please wait.`,
            retryAfterSeconds: 60,
        };
    }

    const oneHourAgo = new Date(now.getTime() - LIMITS.perHour.windowMs);
    const hourCount = await db
        .select({ id: toolRun.id })
        .from(toolRun)
        .where(
            and(
                eq(toolRun.userId, userId),
                gte(toolRun.createdAt, oneHourAgo),
            )
        );

    if (hourCount.length >= LIMITS.perHour.max) {
        return {
            allowed: false,
            reason: `Rate limit: max ${LIMITS.perHour.max} generations per hour. Please try again later.`,
            retryAfterSeconds: 600,
        };
    }

    const oneDayAgo = new Date(now.getTime() - LIMITS.perDay.windowMs);
    const dayCount = await db
        .select({ id: toolRun.id })
        .from(toolRun)
        .where(
            and(
                eq(toolRun.userId, userId),
                gte(toolRun.createdAt, oneDayAgo),
            )
        );

    if (dayCount.length >= LIMITS.perDay.max) {
        return {
            allowed: false,
            reason: `Daily limit of ${LIMITS.perDay.max} generations reached. Resets in 24 hours.`,
            retryAfterSeconds: 3600,
        };
    }

    return { allowed: true };
}
