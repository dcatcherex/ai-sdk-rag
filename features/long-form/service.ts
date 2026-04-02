/**
 * Canonical long-form content generation business logic.
 * All logic lives here — agent adapters and API routes call these functions.
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contentPiece } from '@/db/schema';
import type {
  ContentPiece,
  ContentType,
  ContentStatus,
  GenerateBlogPostInput,
  GenerateNewsletterInput,
  GenerateEmailSequenceInput,
  GenerateLandingPageInput,
  GeneratedContent,
} from './types';
import type { CreateContentPieceInput, UpdateContentPieceInput } from './schema';

const CONTENT_MODEL = 'google/gemini-2.5-flash-lite';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseGeneratedJson(text: string): GeneratedContent {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as { title?: string; body?: string; excerpt?: string };
  return {
    title: parsed.title ?? 'Untitled',
    body: parsed.body ?? '',
    excerpt: parsed.excerpt ?? '',
  };
}

function buildBrandSection(brandContext?: string): string {
  if (!brandContext) return '';
  return `\n\nBrand Context:\n${brandContext}`;
}

// ── AI Generation Functions ───────────────────────────────────────────────────

export async function generateBlogPost(input: GenerateBlogPostInput): Promise<GeneratedContent> {
  const { topic, targetKeyword, tone, wordCount = 800, brandContext, outline } = input;

  const systemPrompt = `You are an expert content marketer and SEO writer. You create compelling, well-structured blog posts that engage readers and rank well in search engines. Always respond with valid JSON only — no markdown code blocks.`;

  const userPrompt = `Write a complete blog post on the following topic.

Topic: ${topic}${targetKeyword ? `\nTarget SEO Keyword: ${targetKeyword}` : ''}
Tone: ${tone ?? 'professional yet approachable'}
Word Count Target: approximately ${wordCount} words${outline ? `\n\nOutline / Key Points to Cover:\n${outline}` : ''}${buildBrandSection(brandContext)}

Requirements:
- Use proper markdown formatting with H2 and H3 headings
- Include a compelling introduction that hooks the reader
- Add relevant subheadings that naturally include the target keyword if provided
- Write a strong conclusion with a clear takeaway
- Optimize naturally for the target keyword without keyword stuffing
- Aim for approximately ${wordCount} words

Return a JSON object with this exact shape:
{
  "title": "The blog post title (compelling, SEO-optimized)",
  "body": "Full markdown content of the blog post",
  "excerpt": "A 1-2 sentence summary (max 160 characters) suitable for meta description"
}`;

  const { text } = await generateText({
    model: openrouter(CONTENT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
  });

  return parseGeneratedJson(text);
}

export async function generateNewsletter(input: GenerateNewsletterInput): Promise<GeneratedContent> {
  const { topic, audience, tone, brandContext } = input;

  const systemPrompt = `You are an expert email newsletter writer. You craft personal, engaging newsletters that readers look forward to opening. Always respond with valid JSON only — no markdown code blocks.`;

  const userPrompt = `Write a newsletter on the following topic.

Topic: ${topic}${audience ? `\nTarget Audience: ${audience}` : ''}
Tone: ${tone ?? 'conversational and personal'}${buildBrandSection(brandContext)}

Requirements:
- Start with a warm, personal greeting or hook
- Use short paragraphs and white space for easy reading
- Include 2-3 main content sections with clear value
- Add a clear call-to-action at the end
- Feel like it was written by a real person, not a brand
- Use markdown formatting

Return a JSON object with this exact shape:
{
  "title": "The newsletter subject line (compelling, under 60 characters)",
  "body": "Full markdown content of the newsletter",
  "excerpt": "A 1-2 sentence preview text (max 150 characters)"
}`;

  const { text } = await generateText({
    model: openrouter(CONTENT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
  });

  return parseGeneratedJson(text);
}

export async function generateEmailSequence(input: GenerateEmailSequenceInput): Promise<GeneratedContent> {
  const { goal, product, sequenceLength = 3, tone, brandContext } = input;

  const systemPrompt = `You are an expert email copywriter specializing in high-converting email sequences. Always respond with valid JSON only — no markdown code blocks.`;

  const userPrompt = `Write an email sequence with ${sequenceLength} emails.

Goal: ${goal}${product ? `\nProduct/Service: ${product}` : ''}
Tone: ${tone ?? 'professional and persuasive'}${buildBrandSection(brandContext)}

Requirements:
- Each email should have a clear subject line and purpose
- Progress logically: awareness → consideration → action
- Separate each email with exactly: ---EMAIL BREAK---
- Format each email as: Subject: [subject line]\n\n[email body]
- Keep emails focused and not too long (200-350 words each)

Return a JSON object with this exact shape:
{
  "title": "Email Sequence: [brief description of the sequence goal]",
  "body": "All emails separated by ---EMAIL BREAK---",
  "excerpt": "A 1-2 sentence description of this email sequence"
}`;

  const { text } = await generateText({
    model: openrouter(CONTENT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
  });

  return parseGeneratedJson(text);
}

export async function generateLandingPage(input: GenerateLandingPageInput): Promise<GeneratedContent> {
  const { product, targetAudience, keyBenefit, tone, brandContext } = input;

  const systemPrompt = `You are an expert conversion copywriter who creates high-converting landing page copy. Always respond with valid JSON only — no markdown code blocks.`;

  const userPrompt = `Write landing page copy for the following product or service.

Product/Service: ${product}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${keyBenefit ? `\nKey Benefit / Value Proposition: ${keyBenefit}` : ''}
Tone: ${tone ?? 'confident and benefit-focused'}${buildBrandSection(brandContext)}

Requirements:
- Start with a powerful headline that communicates the main benefit
- Add a compelling subheadline that supports the headline
- Include a Benefits section with 3-5 specific, concrete benefits
- Add a Social Proof section (testimonial placeholders or proof points)
- Include a Features section highlighting key features
- End with a strong CTA section with urgency or value statement
- Use markdown formatting with clear section headings

Return a JSON object with this exact shape:
{
  "title": "Landing Page: [product name] — [key benefit]",
  "body": "Full markdown landing page copy with all sections",
  "excerpt": "The main headline of the landing page (1 sentence)"
}`;

  const { text } = await generateText({
    model: openrouter(CONTENT_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
  });

  return parseGeneratedJson(text);
}

// ── CRUD Operations ───────────────────────────────────────────────────────────

function mapRow(row: typeof contentPiece.$inferSelect): ContentPiece {
  return {
    id: row.id,
    userId: row.userId,
    brandId: row.brandId ?? null,
    contentType: row.contentType as ContentType,
    title: row.title,
    body: row.body ?? null,
    excerpt: row.excerpt ?? null,
    status: (row.status ?? 'draft') as ContentStatus,
    channel: row.channel ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    parentId: row.parentId ?? null,
    generatedByTeamRunId: row.generatedByTeamRunId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createContentPiece(
  userId: string,
  data: CreateContentPieceInput,
): Promise<ContentPiece> {
  const id = nanoid();
  const [row] = await db
    .insert(contentPiece)
    .values({
      id,
      userId,
      brandId: data.brandId ?? null,
      contentType: data.contentType,
      title: data.title,
      body: data.body ?? null,
      excerpt: data.excerpt ?? null,
      status: data.status ?? 'draft',
      channel: data.channel ?? null,
      metadata: data.metadata ?? {},
      parentId: data.parentId ?? null,
      generatedByTeamRunId: data.generatedByTeamRunId ?? null,
    })
    .returning();

  return mapRow(row);
}

export async function updateContentPiece(
  userId: string,
  id: string,
  data: UpdateContentPieceInput,
): Promise<ContentPiece | null> {
  const [row] = await db
    .update(contentPiece)
    .set({
      ...(data.brandId !== undefined && { brandId: data.brandId }),
      ...(data.contentType !== undefined && { contentType: data.contentType }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.body !== undefined && { body: data.body }),
      ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.channel !== undefined && { channel: data.channel }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      updatedAt: new Date(),
    })
    .where(and(eq(contentPiece.id, id), eq(contentPiece.userId, userId)))
    .returning();

  return row ? mapRow(row) : null;
}

export async function deleteContentPiece(userId: string, id: string): Promise<void> {
  await db
    .delete(contentPiece)
    .where(and(eq(contentPiece.id, id), eq(contentPiece.userId, userId)));
}

export async function getContentPiece(userId: string, id: string): Promise<ContentPiece | null> {
  const [row] = await db
    .select()
    .from(contentPiece)
    .where(and(eq(contentPiece.id, id), eq(contentPiece.userId, userId)))
    .limit(1);

  return row ? mapRow(row) : null;
}

export async function getUserContentPieces(
  userId: string,
  opts?: {
    contentType?: ContentType;
    status?: ContentStatus;
    brandId?: string;
    limit?: number;
  },
): Promise<ContentPiece[]> {
  const conditions = [eq(contentPiece.userId, userId)];

  if (opts?.contentType) conditions.push(eq(contentPiece.contentType, opts.contentType));
  if (opts?.status) conditions.push(eq(contentPiece.status, opts.status));
  if (opts?.brandId) conditions.push(eq(contentPiece.brandId, opts.brandId));

  const rows = await db
    .select()
    .from(contentPiece)
    .where(and(...conditions))
    .orderBy(desc(contentPiece.createdAt))
    .limit(opts?.limit ?? 50);

  return rows.map(mapRow);
}
