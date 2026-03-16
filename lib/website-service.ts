import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { db } from '@/lib/db';
import { website, websiteGenerationLog } from '@/db/schema';
import { getUserBalance, deductCredits } from '@/lib/credits';
import { uploadPublicObject } from '@/lib/r2';
import { renderSiteToHtml } from '@/features/website-builder/templates/renderer';
import {
  createPagesProject,
  deployToPagesProject,
  deletePagesProject,
} from '@/lib/cloudflare-pages';
import { siteDataJsonSchema } from '@/features/website-builder/schema';
import type { SiteDataJson, WebsiteRecord, SiteActionSource } from '@/features/website-builder/types';
import type { ToolExecutionResult } from '@/features/tools/registry/types';

const WEBSITE_MODEL = 'google/gemini-2.5-flash-lite';

function getAiModel() {
  const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENAI_API_KEY ?? '',
  });
  return openai(WEBSITE_MODEL);
}

type ServiceContext = {
  userId: string;
  source?: SiteActionSource;
};

type GenerateInput = {
  businessDescription: string;
  templateSlug: 'portfolio' | 'service-landing' | 'consulting' | 'personal';
  siteName: string;
};

type EditInput = {
  websiteId: string;
  editRequest: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyEditComplexity(editRequest: string): 'simple' | 'structural' {
  const structural = ['add', 'remove', 'delete', 'insert', 'new section', 'move', 'reorder'];
  return structural.some(k => editRequest.toLowerCase().includes(k)) ? 'structural' : 'simple';
}

function toWebsiteRecord(row: typeof website.$inferSelect): WebsiteRecord {
  return {
    ...row,
    status: row.status as WebsiteRecord['status'],
    siteDataJson: row.siteDataJson as SiteDataJson | null,
  };
}

async function uploadHtml(
  userId: string,
  websiteId: string,
  generationCount: number,
  html: string,
): Promise<{ key: string; url: string }> {
  const key = `websites/${userId}/${websiteId}/v${generationCount}/index.html`;
  const result = await uploadPublicObject({
    key,
    body: Buffer.from(html, 'utf-8'),
    contentType: 'text/html; charset=utf-8',
    cacheControl: 'no-cache',
  });
  return result;
}

async function logGeneration(options: {
  websiteId: string;
  userId: string;
  action: string;
  promptText: string;
  promptTokens?: number;
  completionTokens?: number;
  creditsDeducted: number;
  status?: string;
  errorMessage?: string;
}) {
  await db.insert(websiteGenerationLog).values({
    id: nanoid(),
    websiteId: options.websiteId,
    userId: options.userId,
    action: options.action,
    promptText: options.promptText,
    modelId: WEBSITE_MODEL,
    promptTokens: options.promptTokens,
    completionTokens: options.completionTokens,
    creditsDeducted: options.creditsDeducted,
    status: options.status ?? 'success',
    errorMessage: options.errorMessage,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runGenerateWebsite(
  input: GenerateInput,
  ctx: ServiceContext,
): Promise<{ websiteId: string; siteData: SiteDataJson; htmlUrl: string }> {
  const { userId } = ctx;
  const COST = 100;

  const balance = await getUserBalance(userId);
  if (balance < COST) {
    throw new Error(`Insufficient credits. Need ${COST}, have ${balance}.`);
  }

  const systemPrompt = `You are a professional website copywriter and designer.
Generate complete website content as structured JSON based on the business description.
Use engaging, professional language. Choose appropriate colors and fonts.
Primary color should match the industry (e.g. blue for tech, green for health, etc.)
Always include: hero, features/services, about, contact sections.
Hero headline should be punchy and compelling (under 12 words).
Generate 3-5 feature/service items. Generate 2-3 testimonials (make them realistic and specific).
Use real-looking email addresses and contact info based on the business name.
Template slug must match: ${input.templateSlug}`;

  const userPrompt = `Business description: ${input.businessDescription}
Site name: ${input.siteName}
Template: ${input.templateSlug}
Current date: ${new Date().toISOString()}`;

  const { object: siteData, usage } = await generateObject({
    model: getAiModel(),
    schema: siteDataJsonSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  // Ensure required fields are populated
  const finalData: SiteDataJson = {
    ...siteData,
    businessDescription: input.businessDescription,
    generatedAt: new Date().toISOString(),
    templateSlug: input.templateSlug,
  };

  const websiteId = nanoid();
  const generationCount = 1;
  const html = renderSiteToHtml(finalData);
  const { key, url } = await uploadHtml(userId, websiteId, generationCount, html);

  await db.insert(website).values({
    id: websiteId,
    userId,
    name: input.siteName,
    slug: input.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    templateSlug: input.templateSlug,
    status: 'ready',
    siteDataJson: finalData as unknown as typeof website.$inferInsert['siteDataJson'],
    renderedHtmlKey: key,
    renderedHtmlUrl: url,
    generationCount,
  });

  await deductCredits({ userId, amount: COST, description: `Website generate: ${input.siteName}` });

  await logGeneration({
    websiteId,
    userId,
    action: 'generate',
    promptText: input.businessDescription,
    promptTokens: usage?.inputTokens,
    completionTokens: usage?.outputTokens,
    creditsDeducted: COST,
  });

  return { websiteId, siteData: finalData, htmlUrl: url };
}

export async function runEditWebsite(
  input: EditInput,
  ctx: ServiceContext,
): Promise<{ websiteId: string; siteData: SiteDataJson; htmlUrl: string }> {
  const { userId } = ctx;

  const rows = await db.select().from(website).where(
    and(eq(website.id, input.websiteId), eq(website.userId, userId))
  ).limit(1);

  const row = rows[0];
  if (!row) throw new Error('Website not found or access denied.');
  if (!row.siteDataJson) throw new Error('Website has no generated content to edit.');

  const complexity = classifyEditComplexity(input.editRequest);
  const COST = complexity === 'structural' ? 20 : 10;

  const balance = await getUserBalance(userId);
  if (balance < COST) {
    throw new Error(`Insufficient credits. Need ${COST}, have ${balance}.`);
  }

  const currentData = row.siteDataJson as unknown as SiteDataJson;

  const systemPrompt = `You are updating an existing website's content based on a user request.
Apply the requested changes while keeping everything else the same.
Return the complete updated site data JSON.
Keep the same templateSlug, businessDescription, fontHeading, fontBody unless explicitly asked to change them.`;

  const userPrompt = `Current site data:
${JSON.stringify(currentData, null, 2)}

User edit request: ${input.editRequest}`;

  const { object: updatedData, usage } = await generateObject({
    model: getAiModel(),
    schema: siteDataJsonSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  const finalData: SiteDataJson = {
    ...updatedData,
    businessDescription: currentData.businessDescription,
    generatedAt: currentData.generatedAt,
    templateSlug: currentData.templateSlug,
  };

  const newGenerationCount = (row.generationCount ?? 1) + 1;
  const newEditCount = (row.editCount ?? 0) + 1;
  const html = renderSiteToHtml(finalData);
  const { key, url } = await uploadHtml(userId, row.id, newGenerationCount, html);

  await db.update(website)
    .set({
      siteDataJson: finalData as unknown as typeof website.$inferInsert['siteDataJson'],
      renderedHtmlKey: key,
      renderedHtmlUrl: url,
      status: 'ready',
      generationCount: newGenerationCount,
      editCount: newEditCount,
    })
    .where(eq(website.id, row.id));

  await deductCredits({ userId, amount: COST, description: `Website edit (${complexity}): ${row.name}` });

  await logGeneration({
    websiteId: row.id,
    userId,
    action: `edit_${complexity}`,
    promptText: input.editRequest,
    promptTokens: usage?.inputTokens,
    completionTokens: usage?.outputTokens,
    creditsDeducted: COST,
  });

  return { websiteId: row.id, siteData: finalData, htmlUrl: url };
}

export async function runPublishWebsite(
  websiteId: string,
  ctx: ServiceContext,
): Promise<{ liveUrl: string }> {
  const { userId } = ctx;
  const COST = 5;

  const rows = await db.select().from(website).where(
    and(eq(website.id, websiteId), eq(website.userId, userId))
  ).limit(1);

  const row = rows[0];
  if (!row) throw new Error('Website not found or access denied.');
  if (row.status !== 'ready' && row.status !== 'published') {
    throw new Error('Website must be in ready status to publish.');
  }
  if (!row.renderedHtmlKey) throw new Error('No rendered HTML found — generate the website first.');

  const balance = await getUserBalance(userId);
  if (balance < COST) {
    throw new Error(`Insufficient credits. Need ${COST}, have ${balance}.`);
  }

  await db.update(website).set({ status: 'publishing' }).where(eq(website.id, websiteId));

  try {
    // Create project if needed
    let projectName = row.pagesProjectName;
    if (!projectName) {
      projectName = `wb-${userId.slice(0, 8)}-${websiteId.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await createPagesProject(projectName);
      await db.update(website).set({ pagesProjectName: projectName }).where(eq(website.id, websiteId));
    }

    const htmlContent = row.siteDataJson
      ? renderSiteToHtml(row.siteDataJson as unknown as SiteDataJson)
      : '<html><body><p>No content</p></body></html>';

    const { deploymentId, url } = await deployToPagesProject(projectName, htmlContent);

    await db.update(website)
      .set({
        status: 'published',
        pagesDeploymentId: deploymentId,
        liveUrl: url,
      })
      .where(eq(website.id, websiteId));

    await deductCredits({ userId, amount: COST, description: `Website publish: ${row.name}` });

    await logGeneration({
      websiteId,
      userId,
      action: 'publish',
      promptText: `Deploy to ${projectName}`,
      creditsDeducted: COST,
    });

    return { liveUrl: url };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await db.update(website)
      .set({ status: 'failed', error: msg })
      .where(eq(website.id, websiteId));
    throw error;
  }
}

export async function runGetWebsiteStatus(
  websiteId: string,
  ctx: ServiceContext,
): Promise<WebsiteRecord> {
  const rows = await db.select().from(website).where(
    and(eq(website.id, websiteId), eq(website.userId, ctx.userId))
  ).limit(1);

  if (!rows[0]) throw new Error('Website not found or access denied.');
  return toWebsiteRecord(rows[0]);
}

export async function listUserWebsites(userId: string): Promise<WebsiteRecord[]> {
  const rows = await db.select().from(website)
    .where(eq(website.userId, userId))
    .orderBy(desc(website.updatedAt));
  return rows.map(toWebsiteRecord);
}

export async function deleteWebsite(websiteId: string, ctx: ServiceContext): Promise<void> {
  const rows = await db.select().from(website).where(
    and(eq(website.id, websiteId), eq(website.userId, ctx.userId))
  ).limit(1);

  const row = rows[0];
  if (!row) throw new Error('Website not found or access denied.');

  if (row.pagesProjectName) {
    try {
      await deletePagesProject(row.pagesProjectName);
    } catch {
      // Best-effort: don't fail delete if CF cleanup fails
    }
  }

  await db.delete(website).where(eq(website.id, websiteId));
}

// ── ToolExecutionResult wrappers ──────────────────────────────────────────────

export async function websiteGenerateAction(
  input: GenerateInput,
  ctx: ServiceContext,
): Promise<ToolExecutionResult<{ websiteId: string; htmlUrl: string; siteData: SiteDataJson }>> {
  const result = await runGenerateWebsite(input, ctx);
  return {
    tool: 'website_builder',
    runId: nanoid(),
    title: `Website generated: ${input.siteName}`,
    summary: `Your website has been generated using the ${input.templateSlug} template.`,
    data: result,
    artifacts: [{ type: 'link', label: 'Preview HTML', url: result.htmlUrl }],
    createdAt: new Date().toISOString(),
  };
}

export async function websiteEditAction(
  input: EditInput,
  ctx: ServiceContext,
): Promise<ToolExecutionResult<{ websiteId: string; htmlUrl: string }>> {
  const result = await runEditWebsite(input, ctx);
  return {
    tool: 'website_builder',
    runId: nanoid(),
    title: 'Website updated',
    summary: `Changes applied: ${input.editRequest}`,
    data: { websiteId: result.websiteId, htmlUrl: result.htmlUrl },
    artifacts: [{ type: 'link', label: 'Preview HTML', url: result.htmlUrl }],
    createdAt: new Date().toISOString(),
  };
}
