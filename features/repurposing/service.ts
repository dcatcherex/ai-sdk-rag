/**
 * Canonical content repurposing business logic.
 * All logic lives here — agent adapters and API routes call these functions.
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { contentPiece } from '@/db/schema';
import type { ContentPiece } from '@/features/long-form/types';
import type { RepurposeFormat, RepurposeInput } from './types';

const CONTENT_MODEL = 'google/gemini-2.5-flash-lite';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Format-specific prompt instructions ───────────────────────────────────────

function getFormatInstructions(format: RepurposeFormat): string {
  switch (format) {
    case 'blog_post':
      return 'Transform into an SEO-optimized blog post with H2/H3 headings, 600-800 words. Include a compelling intro, structured sections, and a conclusion.';
    case 'newsletter':
      return 'Transform into a conversational newsletter. Be personal and direct. Include a hook, main value sections, and a clear call-to-action. 300-500 words.';
    case 'linkedin_post':
      return 'Transform into a professional LinkedIn post. 200-300 words. Use line breaks for readability. End with a thoughtful question or call-to-action to drive engagement.';
    case 'tweet_thread':
      return 'Transform into a tweet thread of 8-12 tweets. Each tweet must be under 280 characters. Number each tweet (1/, 2/, etc.). Make each tweet punchy and standalone but connected.';
    case 'social_caption':
      return 'Transform into a social media caption of max 150 characters followed by 3-5 relevant hashtags. Make it engaging and punchy.';
    case 'ad_copy':
      return 'Transform into ad copy. Write: 1) A powerful headline (max 8 words), 2) A subheadline that supports it (1 sentence), 3) Three benefit bullets starting with power verbs, 4) A strong CTA.';
    case 'email_sequence':
      return 'Transform into a 3-email sequence. Separate each email with ---EMAIL BREAK---. Format each as: Subject: [subject line]\n\n[email body]. Progress from awareness → value → action.';
  }
}

function contentTypeForFormat(format: RepurposeFormat): string {
  if (format === 'linkedin_post') return 'linkedin_post';
  if (format === 'tweet_thread') return 'tweet_thread';
  if (format === 'social_caption') return 'ad_copy';
  if (format === 'ad_copy') return 'ad_copy';
  if (format === 'email_sequence') return 'email_sequence';
  if (format === 'newsletter') return 'newsletter';
  return 'blog_post';
}

// ── Core repurposing function ─────────────────────────────────────────────────

async function repurposeToFormat(
  sourceText: string,
  format: RepurposeFormat,
  opts: { sourceTitle?: string; brandContext?: string; tone?: string },
): Promise<{ title: string; body: string; excerpt: string }> {
  const systemPrompt = `You are a content repurposing expert. You take existing content and expertly adapt it for different formats and channels while preserving the core message and value. Always respond with valid JSON only — no markdown code blocks.`;

  const userPrompt = `Repurpose the following content into ${format.replace(/_/g, ' ')} format.

${opts.sourceTitle ? `Source Title: ${opts.sourceTitle}\n` : ''}Source Content:
${sourceText}

Format Instructions: ${getFormatInstructions(format)}
${opts.tone ? `\nTone: ${opts.tone}` : ''}${opts.brandContext ? `\n\nBrand Context:\n${opts.brandContext}` : ''}

Return a JSON object with this exact shape:
{
  "title": "Title or headline for this ${format.replace(/_/g, ' ')}",
  "body": "The full repurposed content",
  "excerpt": "A 1-2 sentence summary"
}`;

  const { text } = await generateText({
    model: openrouter(CONTENT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
  });

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as { title?: string; body?: string; excerpt?: string };
  return {
    title: parsed.title ?? `${format.replace(/_/g, ' ')} — repurposed`,
    body: parsed.body ?? '',
    excerpt: parsed.excerpt ?? '',
  };
}

// ── Public service function ───────────────────────────────────────────────────

export async function repurposeContent(
  userId: string,
  input: RepurposeInput,
): Promise<ContentPiece[]> {
  const { sourceText, sourceTitle, targetFormats, brandContext, tone } = input;

  // Create a source record to act as the parent
  const sourceId = nanoid();
  await db.insert(contentPiece).values({
    id: sourceId,
    userId,
    contentType: 'blog_post',
    title: sourceTitle ?? 'Source Content',
    body: sourceText,
    excerpt: sourceText.slice(0, 160),
    status: 'archived',
    metadata: { isSourceOnly: true },
  });

  // Generate repurposed versions in parallel
  const results = await Promise.all(
    targetFormats.map(async (format) => {
      const generated = await repurposeToFormat(sourceText, format, {
        sourceTitle,
        brandContext,
        tone,
      });

      const id = nanoid();
      const [row] = await db
        .insert(contentPiece)
        .values({
          id,
          userId,
          contentType: contentTypeForFormat(format),
          title: generated.title,
          body: generated.body,
          excerpt: generated.excerpt,
          status: 'draft',
          parentId: sourceId,
          metadata: { repurposedFormat: format },
        })
        .returning();

      return {
        id: row.id,
        userId: row.userId,
        brandId: row.brandId ?? null,
        contentType: row.contentType as ContentPiece['contentType'],
        title: row.title,
        body: row.body ?? null,
        excerpt: row.excerpt ?? null,
        status: (row.status ?? 'draft') as ContentPiece['status'],
        channel: row.channel ?? null,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        parentId: row.parentId ?? null,
        generatedByTeamRunId: row.generatedByTeamRunId ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } satisfies ContentPiece;
    }),
  );

  return results;
}
