import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import { appendSheetValues, createSheetTab, createSpreadsheet, readSheetRange, updateSheetValues } from '@/lib/google/sheets';
import type {
  AppendSheetRowInput,
  CreateSheetTabInput,
  CreateSpreadsheetInput,
  ReadSheetRangeInput,
  UpdateSheetRangeInput,
} from './schema';

async function createPendingToolRun(userId: string, inputJson: unknown) {
  const id = nanoid();
  await db.insert(toolRun).values({
    id,
    toolSlug: 'google-sheets',
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

export async function runReadSheetRange(input: ReadSheetRangeInput, userId: string) {
  return readSheetRange(userId, input.spreadsheetId, input.range);
}

export async function runAppendSheetRow(input: AppendSheetRowInput, userId: string) {
  const headerRange = `${input.sheetName}!1:1`;
  const headerResult = await readSheetRange(userId, input.spreadsheetId, headerRange);
  const headers = headerResult.values?.[0] ?? [];

  if (headers.length === 0) {
    throw new Error(`Sheet "${input.sheetName}" has no header row`);
  }

  const values = [
    headers.map((header) => {
      const value = input.row[header];
      return value === undefined ? null : value;
    }),
  ];

  const appendRange = `${input.sheetName}!A1`;
  const result = await appendSheetValues(userId, input.spreadsheetId, appendRange, values);

  return {
    sheetName: input.sheetName,
    appended: true,
    row: input.row,
    updates: result.updates ?? null,
  };
}

export async function runUpdateSheetRange(input: UpdateSheetRangeInput, userId: string) {
  return updateSheetValues(userId, input.spreadsheetId, input.range, input.values);
}

export async function runCreateSheetTab(input: CreateSheetTabInput, userId: string) {
  const result = await createSheetTab(userId, input.spreadsheetId, input.title);
  const properties = result.replies?.[0]?.addSheet?.properties;

  return {
    sheetId: properties?.sheetId ?? null,
    title: properties?.title ?? input.title,
  };
}

export async function runCreateSpreadsheet(input: CreateSpreadsheetInput, userId: string) {
  return createSpreadsheet(userId, input);
}

export async function readSheetRangeAction(
  input: ReadSheetRangeInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runReadSheetRange(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_sheets',
      runId,
      title: `Read ${input.range}`,
      summary: `${data.values?.length ?? 0} rows fetched`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read sheet range';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function appendSheetRowAction(
  input: AppendSheetRowInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runAppendSheetRow(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_sheets',
      runId,
      title: `Append row to ${input.sheetName}`,
      summary: '1 row appended',
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to append row';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function updateSheetRangeAction(
  input: UpdateSheetRangeInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runUpdateSheetRange(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_sheets',
      runId,
      title: `Update ${input.range}`,
      summary: `${data.updatedCells ?? 0} cells updated`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update range';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function createSheetTabAction(
  input: CreateSheetTabInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateSheetTab(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_sheets',
      runId,
      title: `Create tab ${input.title}`,
      summary: `Created worksheet tab ${data.title}`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create sheet tab';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function createSpreadsheetAction(
  input: CreateSpreadsheetInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateSpreadsheet(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_sheets',
      runId,
      title: `Create spreadsheet ${input.title}`,
      summary: input.folderId
        ? 'Spreadsheet created in the specified Drive folder'
        : 'Spreadsheet created in Google Drive',
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create spreadsheet';
    await failToolRun(runId, message);
    throw error;
  }
}
