/**
 * Canonical brand-guardrails business logic.
 * All callers (agent, API routes) import from here.
 */

import { generateText } from 'ai';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { brandGuardrail } from '@/db/schema';
import { searchDocumentsWithFilter } from '@/lib/vector-store';
import type { BrandGuardrail, GuardrailCheckResult, GuardrailViolation } from './types';
import type { CreateGuardrailInput, UpdateGuardrailInput } from './schema';

const GUARDRAIL_MODEL = 'google/gemini-2.5-flash-lite';

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getBrandGuardrails(brandId: string): Promise<BrandGuardrail[]> {
  const rows = await db
    .select()
    .from(brandGuardrail)
    .where(eq(brandGuardrail.brandId, brandId));

  return rows.map((r) => ({
    ...r,
    ruleType: r.ruleType as BrandGuardrail['ruleType'],
    severity: r.severity as BrandGuardrail['severity'],
  }));
}

export async function createGuardrail(
  brandId: string,
  data: CreateGuardrailInput,
): Promise<BrandGuardrail> {
  const id = nanoid();
  const now = new Date();
  await db.insert(brandGuardrail).values({
    id,
    brandId,
    ruleType: data.ruleType,
    title: data.title,
    description: data.description ?? null,
    pattern: data.pattern ?? null,
    severity: data.severity,
    isActive: data.isActive,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(brandGuardrail)
    .where(eq(brandGuardrail.id, id))
    .limit(1);

  return {
    ...rows[0],
    ruleType: rows[0].ruleType as BrandGuardrail['ruleType'],
    severity: rows[0].severity as BrandGuardrail['severity'],
  };
}

export async function updateGuardrail(
  brandId: string,
  id: string,
  data: UpdateGuardrailInput,
): Promise<BrandGuardrail | null> {
  const now = new Date();
  await db
    .update(brandGuardrail)
    .set({
      ...(data.ruleType !== undefined && { ruleType: data.ruleType }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.pattern !== undefined && { pattern: data.pattern }),
      ...(data.severity !== undefined && { severity: data.severity }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: now,
    })
    .where(and(eq(brandGuardrail.id, id), eq(brandGuardrail.brandId, brandId)));

  const rows = await db
    .select()
    .from(brandGuardrail)
    .where(eq(brandGuardrail.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  return {
    ...rows[0],
    ruleType: rows[0].ruleType as BrandGuardrail['ruleType'],
    severity: rows[0].severity as BrandGuardrail['severity'],
  };
}

export async function deleteGuardrail(brandId: string, id: string): Promise<void> {
  await db
    .delete(brandGuardrail)
    .where(and(eq(brandGuardrail.id, id), eq(brandGuardrail.brandId, brandId)));
}

// ── Check ─────────────────────────────────────────────────────────────────────

export async function checkGuardrails(
  brandId: string,
  content: string,
  userId: string,
): Promise<GuardrailCheckResult> {
  const allGuardrails = await getBrandGuardrails(brandId);
  const active = allGuardrails.filter((g) => g.isActive);

  if (active.length === 0) {
    return { passed: true, violations: [] };
  }

  const violations: GuardrailViolation[] = [];

  // Phase 1 — regex/phrase scan
  for (const guardrail of active) {
    if (!guardrail.pattern) continue;
    try {
      const regex = new RegExp(guardrail.pattern, 'gi');
      const match = regex.exec(content);
      if (match) {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(content.length, match.index + guardrail.pattern.length + 60);
        const excerpt = content.slice(start, end);
        violations.push({
          ruleId: guardrail.id,
          title: guardrail.title,
          severity: guardrail.severity,
          excerpt: excerpt.length > 100 ? excerpt.slice(0, 100) + '…' : excerpt,
          suggestion: null,
        });
      }
    } catch {
      // Invalid regex — skip
    }
  }

  // Phase 2 — semantic check via RAG brand docs
  try {
    const docs = await searchDocumentsWithFilter(
      content,
      { category: `brand-${brandId}` },
      { userId, limit: 5 },
    );

    if (docs.length > 0) {
      const docsContent = docs.map((d) => d.content).join('\n\n');
      const guardrailsSummary = active
        .map((g) => `- ${g.title} (${g.ruleType}, ${g.severity}): ${g.description ?? ''}`)
        .join('\n');

      const prompt = `Given these brand guidelines and guardrail rules:

BRAND DOCUMENTS:
${docsContent}

GUARDRAIL RULES:
${guardrailsSummary}

Check if the following content violates any guidelines or rules. Return ONLY a JSON array of violations (or empty array if none). Each violation object must have: {"title": string, "severity": "block"|"warning"|"info", "suggestion": string}

CONTENT TO CHECK:
${content.slice(0, 3000)}

Return ONLY the raw JSON array, no markdown, no code fences.`;

      const { text } = await generateText({
        model: GUARDRAIL_MODEL as Parameters<typeof generateText>[0]['model'],
        prompt,
      });

      try {
        const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean) as Array<{
          title: string;
          severity: string;
          suggestion: string;
        }>;

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            violations.push({
              ruleId: `semantic-${nanoid(6)}`,
              title: item.title ?? 'Semantic violation',
              severity: (['block', 'warning', 'info'].includes(item.severity)
                ? item.severity
                : 'warning') as GuardrailViolation['severity'],
              excerpt: null,
              suggestion: item.suggestion ?? null,
            });
          }
        }
      } catch {
        // JSON parse failed — skip semantic violations
      }
    }
  } catch (err) {
    console.error('[checkGuardrails] RAG semantic check failed:', err);
  }

  return { passed: violations.length === 0, violations };
}
