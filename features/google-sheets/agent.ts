import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  appendSheetRowInputSchema,
  createSheetTabInputSchema,
  createSpreadsheetInputSchema,
  readSheetRangeInputSchema,
  updateSheetRangeInputSchema,
} from './schema';
import {
  runAppendSheetRow,
  runCreateSheetTab,
  runCreateSpreadsheet,
  runReadSheetRange,
  runUpdateSheetRange,
} from './service';

export function createGoogleSheetsAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    read_google_sheet_range: tool({
      description: 'Read rows from a Google Sheet range using A1 notation.',
      inputSchema: readSheetRangeInputSchema,
      async execute(input) {
        return await runReadSheetRange(input, userId);
      },
    }),

    append_google_sheet_row: tool({
      description: 'Append one row to a Google Sheet using header names.',
      inputSchema: appendSheetRowInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runAppendSheetRow(input, userId);
      },
    }),

    update_google_sheet_range: tool({
      description: 'Update cells in a Google Sheet range.',
      inputSchema: updateSheetRangeInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runUpdateSheetRange(input, userId);
      },
    }),

    create_google_sheet_tab: tool({
      description: 'Create a new worksheet tab in an existing spreadsheet.',
      inputSchema: createSheetTabInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateSheetTab(input, userId);
      },
    }),

    create_google_spreadsheet: tool({
      description: 'Create a new Google Spreadsheet, optionally inside a specific Google Drive folder and with an initial header row.',
      inputSchema: createSpreadsheetInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateSpreadsheet(input, userId);
      },
    }),
  };
}
