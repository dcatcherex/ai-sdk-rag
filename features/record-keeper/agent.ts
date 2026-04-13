/**
 * Thin AI SDK adapter for record-keeper tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { logActivityInputSchema, getRecordsInputSchema, summarizeRecordsInputSchema } from './schema';
import { runLogActivity, runGetRecords, runSummarizeRecords } from './service';

export function createRecordKeeperAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    log_activity: tool({
      description:
        'Save an activity or farm/class/work event to the record log. Use this after the user confirms an entry — e.g. "วันนี้ใส่ปุ๋ยยูเรีย 50 กก." or "fed 3 patients". Always confirm details with the user before calling this tool.',
      needsApproval: true,
      inputSchema: logActivityInputSchema,
      async execute(input) {
        return { success: true, ...(await runLogActivity(input, userId)) };
      },
    }),

    get_activity_records: tool({
      description:
        'Retrieve saved activity records. Use when the user asks to see logs, check history, or wants to know what was done in a period. Supports filtering by entity, category, and date range.',
      inputSchema: getRecordsInputSchema,
      async execute(input) {
        return { success: true, ...(await runGetRecords(input, userId)) };
      },
    }),

    summarize_activity_records: tool({
      description:
        'Summarize activity records for a period and compute cost/income totals. Use when the user asks for a weekly or monthly summary, or wants to know total expenses.',
      inputSchema: summarizeRecordsInputSchema,
      async execute(input) {
        return { success: true, ...(await runSummarizeRecords(input, userId)) };
      },
    }),
  };
}
