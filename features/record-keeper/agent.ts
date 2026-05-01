/**
 * Thin AI SDK adapter for record-keeper tools.
 * All logic lives in service.ts - this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  getRecordsInputSchema,
  logActivityInputSchema,
  summarizeRecordsInputSchema,
} from './schema';
import { runGetRecords, runLogActivity, runSummarizeRecords } from './service';

export function createRecordKeeperAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    log_activity: tool({
      description:
        'Save an activity or farm/class/work event to the record log. Use this after the user confirms an entry. Include metadata such as profileId, entityIds, entityType, or source when structured domain context is available. Always confirm details with the user before calling this tool.',
      needsApproval: true,
      inputSchema: logActivityInputSchema,
      async execute(input) {
        const result = await runLogActivity(input, userId);
        return {
          success: true,
          kind: 'record_saved',
          contextType: input.contextType,
          ...result,
          recordId: result.id,
        };
      },
    }),

    get_activity_records: tool({
      description:
        'Retrieve saved activity records. Use when the user asks to see logs, check history, or wants to know what was done in a period. Supports filtering by entity, category, and date range.',
      inputSchema: getRecordsInputSchema,
      async execute(input) {
        return {
          success: true,
          kind: 'record_list',
          contextType: input.contextType,
          ...(await runGetRecords(input, userId)),
        };
      },
    }),

    summarize_activity_records: tool({
      description:
        'Summarize activity records for a period and compute cost/income totals. Use when the user asks for a weekly or monthly summary, or wants to know total expenses.',
      inputSchema: summarizeRecordsInputSchema,
      async execute(input) {
        return {
          success: true,
          kind: 'record_summary',
          contextType: input.contextType,
          ...(await runSummarizeRecords(input, userId)),
        };
      },
    }),
  };
}
