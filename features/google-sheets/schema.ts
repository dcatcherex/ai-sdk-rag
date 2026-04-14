import { z } from 'zod';

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const readSheetRangeInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1).describe('A1 notation, e.g. Sheet1!A1:F50'),
});

export const appendSheetRowInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
  row: z.record(z.string(), cellValueSchema),
});

export const updateSheetRangeInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.array(cellValueSchema)).min(1),
});

export const createSheetTabInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  title: z.string().min(1).max(100),
});

export const createSpreadsheetInputSchema = z.object({
  title: z.string().min(1).max(200),
  folderId: z.string().optional(),
  headers: z.array(z.string().min(1)).optional(),
});

export type ReadSheetRangeInput = z.infer<typeof readSheetRangeInputSchema>;
export type AppendSheetRowInput = z.infer<typeof appendSheetRowInputSchema>;
export type UpdateSheetRangeInput = z.infer<typeof updateSheetRangeInputSchema>;
export type CreateSheetTabInput = z.infer<typeof createSheetTabInputSchema>;
export type CreateSpreadsheetInput = z.infer<typeof createSpreadsheetInputSchema>;
