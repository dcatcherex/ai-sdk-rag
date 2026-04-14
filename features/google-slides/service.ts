import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import {
  createGoogleSlidesDeck,
  createGoogleSlidesFromTemplate,
} from '@/lib/google/slides';
import type {
  CreateGoogleSlidesDeckInput,
  CreateGoogleSlidesFromTemplateInput,
} from './schema';

async function createPendingToolRun(userId: string, inputJson: unknown) {
  const id = nanoid();
  await db.insert(toolRun).values({
    id,
    toolSlug: 'google-slides',
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

export async function runCreateGoogleSlidesDeck(
  input: CreateGoogleSlidesDeckInput,
  userId: string,
) {
  return createGoogleSlidesDeck(userId, input);
}

export async function runCreateGoogleSlidesFromTemplate(
  input: CreateGoogleSlidesFromTemplateInput,
  userId: string,
) {
  return createGoogleSlidesFromTemplate(userId, input);
}

export async function createGoogleSlidesDeckAction(
  input: CreateGoogleSlidesDeckInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateGoogleSlidesDeck(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_slides',
      runId,
      title: `Create deck ${input.title}`,
      summary: `${data.createdSlideCount} slides created`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create Google Slides deck';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function createGoogleSlidesFromTemplateAction(
  input: CreateGoogleSlidesFromTemplateInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateGoogleSlidesFromTemplate(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_slides',
      runId,
      title: `Create deck from template ${input.title}`,
      summary: `${data.createdSlideCount} slides created in copied deck`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create Google Slides deck from template';
    await failToolRun(runId, message);
    throw error;
  }
}
