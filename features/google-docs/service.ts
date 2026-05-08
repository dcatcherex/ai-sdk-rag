import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import {
  appendGoogleDocSection,
  createGoogleDoc,
  createGoogleDocFromTemplate,
} from '@/lib/google/docs';
import { runExternalTool, toToolExecutionResult } from '@/features/external-tools';
import { toGoogleDocsProviderOptions } from '@/features/external-tools/integrations/google-bridge';
import type {
  AppendGoogleDocSectionInput,
  CreateGoogleDocFromTemplateInput,
  CreateGoogleDocInput,
} from './schema';

async function createPendingToolRun(userId: string, inputJson: unknown) {
  const id = nanoid();
  await db.insert(toolRun).values({
    id,
    toolSlug: 'google-docs',
    userId,
    source: 'manual',
    inputJson,
    status: 'pending',
  });
  return id;
}

async function completeToolRun(runId: string, outputJson: unknown) {
  await db
    .update(toolRun)
    .set({
      status: 'completed',
      outputJson,
      completedAt: new Date(),
    })
    .where(eq(toolRun.id, runId));
}

async function failToolRun(runId: string, message: string) {
  await db
    .update(toolRun)
    .set({
      status: 'failed',
      errorMessage: message,
      completedAt: new Date(),
    })
    .where(eq(toolRun.id, runId));
}

export async function runCreateGoogleDoc(input: CreateGoogleDocInput, userId: string) {
  return createGoogleDoc(userId, input);
}

export async function runCreateGoogleDocFromTemplate(
  input: CreateGoogleDocFromTemplateInput,
  userId: string,
) {
  return createGoogleDocFromTemplate(userId, input);
}

export async function runAppendGoogleDocSection(
  input: AppendGoogleDocSectionInput,
  userId: string,
) {
  return appendGoogleDocSection(userId, input);
}

export async function createGoogleDocAction(
  input: CreateGoogleDocInput,
  userId: string,
): Promise<ToolExecutionResult> {
  if (process.env.GOOGLE_INTEGRATIONS_PROVIDER_URL) {
    const opts = toGoogleDocsProviderOptions('create-doc', input as Record<string, unknown>, userId);
    const result = await runExternalTool(opts);
    return toToolExecutionResult('google_docs', result);
  }
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateGoogleDoc(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_docs',
      runId,
      title: `Create doc ${input.title}`,
      summary: 'Google Doc created from markdown content',
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create Google Doc';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function createGoogleDocFromTemplateAction(
  input: CreateGoogleDocFromTemplateInput,
  userId: string,
): Promise<ToolExecutionResult> {
  if (process.env.GOOGLE_INTEGRATIONS_PROVIDER_URL) {
    const opts = toGoogleDocsProviderOptions('create-doc-from-template', input as Record<string, unknown>, userId);
    const result = await runExternalTool(opts);
    return toToolExecutionResult('google_docs', result);
  }
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateGoogleDocFromTemplate(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_docs',
      runId,
      title: `Create doc from template ${input.title}`,
      summary: `${data.replacementCount ?? 0} placeholders replaced`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create Google Doc from template';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function appendGoogleDocSectionAction(
  input: AppendGoogleDocSectionInput,
  userId: string,
): Promise<ToolExecutionResult> {
  if (process.env.GOOGLE_INTEGRATIONS_PROVIDER_URL) {
    const opts = toGoogleDocsProviderOptions('append-doc-section', input as Record<string, unknown>, userId);
    const result = await runExternalTool(opts);
    return toToolExecutionResult('google_docs', result);
  }
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runAppendGoogleDocSection(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_docs',
      runId,
      title: `Append section to ${input.documentId}`,
      summary: input.heading
        ? `Section ${input.heading} appended`
        : 'Content appended to the Google Doc',
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to append Google Doc section';
    await failToolRun(runId, message);
    throw error;
  }
}
