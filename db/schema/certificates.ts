import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { CertificateTemplateType, PrintSheetSettings } from "@/lib/certificate-print";

import { user } from "./auth";

type CertificateJobExportMode = "single_file" | "zip" | "single_pdf" | "sheet_pdf";
type CertificateJobSource = "manual" | "agent";
type CertificateJobRequestPayload = {
  fieldIds: string[];
  hasBackSide: boolean;
  recipientCount: number;
  recipientPreview: string[];
  requiredFieldIds: string[];
  templateName: string;
};
type CertificateJobResultPayload = {
  downloadLabel: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  isDuplexSheet: boolean;
};

// Certificate templates and batch jobs
export const certificateTemplate = pgTable("certificate_template", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  templateType: text("template_type").$type<CertificateTemplateType>().notNull().default("certificate"),
  r2Key: text("r2_key").notNull(),
  url: text("url").notNull(),
  thumbnailKey: text("thumbnail_key"),
  thumbnailUrl: text("thumbnail_url"),
  backR2Key: text("back_r2_key"),
  backUrl: text("back_url"),
  backThumbnailKey: text("back_thumbnail_key"),
  backThumbnailUrl: text("back_thumbnail_url"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  backWidth: integer("back_width"),
  backHeight: integer("back_height"),
  fields: jsonb("fields").notNull().default(sql`'[]'::jsonb`),
  backFields: jsonb("back_fields").notNull().default(sql`'[]'::jsonb`),
  printSettings: jsonb("print_settings").$type<PrintSheetSettings>().notNull().default(sql`'{"preset":"a4_3x3","pageSize":"A4","columns":3,"rows":3,"marginTopMm":12,"marginRightMm":12,"marginBottomMm":12,"marginLeftMm":12,"gapXMm":4,"gapYMm":4,"cropMarks":false,"cropMarkLengthMm":4,"cropMarkOffsetMm":2,"duplexMode":"single_sided","backPageOrder":"same","backOffsetXMm":0,"backOffsetYMm":0,"backFlipX":false,"backFlipY":false}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("certificate_template_userId_idx").on(table.userId)]);

export const certificateJob = pgTable("certificate_job", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull().references(() => certificateTemplate.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  format: text("format").notNull().default("png"),
  exportMode: text("export_mode").$type<CertificateJobExportMode>().notNull().default("zip"),
  source: text("source").$type<CertificateJobSource>().notNull().default("manual"),
  totalCount: integer("total_count").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  fileName: text("file_name"),
  downloadLabel: text("download_label"),
  resultKey: text("result_key"),
  resultUrl: text("result_url"),
  zipKey: text("zip_key"),
  zipUrl: text("zip_url"),
  requestPayload: jsonb("request_payload").$type<CertificateJobRequestPayload>(),
  resultPayload: jsonb("result_payload").$type<CertificateJobResultPayload>(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [index("certificate_job_userId_idx").on(table.userId)]);

export const certificateTemplateRelations = relations(certificateTemplate, ({ one, many }) => ({
  user: one(user, { fields: [certificateTemplate.userId], references: [user.id] }),
  jobs: many(certificateJob),
}));

export const certificateJobRelations = relations(certificateJob, ({ one }) => ({
  user: one(user, { fields: [certificateJob.userId], references: [user.id] }),
  template: one(certificateTemplate, { fields: [certificateJob.templateId], references: [certificateTemplate.id] }),
}));

// Recipient groups for certificate batch generation
export const recipientGroup = pgTable("recipient_group", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  recipients: jsonb("recipients")
    .$type<Array<{ id: string; values: Record<string, string> }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("recipient_group_userId_idx").on(table.userId)]);
