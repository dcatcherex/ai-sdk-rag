import { z } from 'zod';

export const commonConfirmationRichMessageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  altText: z.string().min(1).optional(),
});

export const commonSummaryRichMessageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  altText: z.string().min(1).optional(),
});

export const commonApprovalRequestRichMessageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  approvalRequestId: z.string().min(1).optional(),
  contentPieceId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  assigneeName: z.string().min(1).optional(),
  dueAt: z.string().min(1).optional(),
  altText: z.string().min(1).optional(),
});

export const commonEscalationRichMessageSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  altText: z.string().min(1).optional(),
});

export const agricultureDiagnosisRichMessageSchema = z.object({
  crop_name: z.string().min(1),
  diagnosis: z.string().min(1),
  severity: z.string().min(1),
  recommendation: z.string().min(1),
  altText: z.string().min(1).optional(),
});

export const agricultureWeatherRiskRichMessageSchema = z.object({
  location: z.string().min(1),
  temperature: z.string().min(1),
  humidity: z.string().min(1),
  rain_chance: z.string().min(1),
  farm_advice: z.string().min(1),
  altText: z.string().min(1).optional(),
});

export const agricultureForecast7DayRichMessageSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  altText: z.string().min(1).optional(),
});

export const agricultureRecordEntryRichMessageSchema = z.object({
  activity: z.string().min(1),
  plot: z.string().min(1).optional(),
  date: z.string().min(1),
  cost: z.string().min(1).optional(),
  altText: z.string().min(1).optional(),
});

export const agricultureRecordConfirmationRichMessageSchema = z.object({
  activity: z.string().min(1),
  plot: z.string().min(1).optional(),
  date: z.string().min(1),
  log_id: z.string().min(1).optional(),
  altText: z.string().min(1).optional(),
});

export const agricultureWeeklySummaryRichMessageSchema = z.object({
  week_range: z.string().min(1),
  total_activities: z.string().min(1),
  total_cost: z.string().min(1),
  highlight: z.string().min(1),
  altText: z.string().min(1).optional(),
});

export type AgricultureDiagnosisRichMessageData = z.infer<typeof agricultureDiagnosisRichMessageSchema>;
