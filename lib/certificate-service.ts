import { and, desc, eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { certificateJob, certificateTemplate } from '@/db/schema';
import {
  createDuplexSheetPdf,
  createSheetPdf,
  generateCertificate,
  mergePdfBuffers,
  type CertificateField,
  type TextFieldConfig,
} from '@/lib/certificate-generator';
import { getDefaultPrintSheetSettingsForTemplateType, normalizePrintSheetSettings } from '@/lib/certificate-print';
import { uploadPublicObject } from '@/lib/r2';

export type CertificateOutputFormat = 'png' | 'jpg' | 'pdf';
export type CertificateOutputMode = 'single_file' | 'zip' | 'single_pdf' | 'sheet_pdf';
export type CertificateJobSource = 'manual' | 'agent';
export type CertificateRecipientInput = {
  values: Record<string, string> | CertificateField[];
};

export type CertificateJobRequestPayload = {
  fieldIds: string[];
  hasBackSide: boolean;
  recipientCount: number;
  recipientPreview: string[];
  requiredFieldIds: string[];
  templateName: string;
};

export type CertificateJobResultPayload = {
  downloadLabel: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  isDuplexSheet: boolean;
};

export type CertificateGenerationResult = {
  count: number;
  downloadLabel: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  format: CertificateOutputFormat;
  jobId: string;
  outputMode: CertificateOutputMode;
};

export type CertificateGenerationPreview = {
  canGenerate: boolean;
  missingRequiredByRecipient: Array<{
    recipientIndex: number;
    missingFieldIds: string[];
  }>;
  outputMode: CertificateOutputMode;
  requiredFieldIds: string[];
  template: {
    hasBackSide: boolean;
    id: string;
    name: string;
    templateType: TemplateRecord['templateType'];
  };
  unknownFieldIdsByRecipient: Array<{
    recipientIndex: number;
    unknownFieldIds: string[];
  }>;
};

type TemplateRecord = typeof certificateTemplate.$inferSelect;

const MIME_BY_FORMAT: Record<CertificateOutputFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
};

function normalizeRecipientValues(input: Record<string, string> | CertificateField[]): CertificateField[] {
  if (Array.isArray(input)) {
    return input.map((entry) => ({
      fieldId: entry.fieldId,
      value: entry.value,
    }));
  }

  return Object.entries(input).map(([fieldId, value]) => ({
    fieldId,
    value,
  }));
}

function sanitizeFileStem(value: string): string {
  const safe = value.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);
  return safe || 'certificate';
}

function getRecipientDisplayName(values: CertificateField[], fallback: string): string {
  const nameValue = values.find((entry) => entry.fieldId === 'name' && entry.value.trim().length > 0)?.value;
  const firstValue = values.find((entry) => entry.value.trim().length > 0)?.value;
  return sanitizeFileStem(nameValue ?? firstValue ?? fallback);
}

function resolveOutputMode(
  recipientCount: number,
  format: CertificateOutputFormat,
  requestedOutputMode?: Exclude<CertificateOutputMode, 'single_file'>,
): CertificateOutputMode {
  if (recipientCount === 1 && !requestedOutputMode) {
    return 'single_file';
  }

  if (!requestedOutputMode) {
    return 'zip';
  }

  if ((requestedOutputMode === 'single_pdf' || requestedOutputMode === 'sheet_pdf') && format !== 'pdf') {
    throw new Error(`${requestedOutputMode} is only available when format is pdf`);
  }

  return requestedOutputMode;
}

function validateRecipients(
  recipients: CertificateField[][],
  fields: TextFieldConfig[],
  backFields: TextFieldConfig[],
): void {
  const allFields = [...fields, ...backFields];
  const knownFieldIds = new Set(allFields.map((field) => field.id));
  const requiredFields = allFields.filter((field) => field.required === true);

  const errors = recipients.flatMap((recipientValues, index) => {
    const valuesByFieldId = new Map<string, string>();

    for (const entry of recipientValues) {
      valuesByFieldId.set(entry.fieldId, entry.value);
    }

    const unknownFieldIds = recipientValues
      .filter((entry) => !knownFieldIds.has(entry.fieldId))
      .map((entry) => entry.fieldId);
    const missingRequiredIds = requiredFields
      .filter((field) => !valuesByFieldId.get(field.id)?.trim())
      .map((field) => field.id);

    const recipientErrors: string[] = [];

    if (unknownFieldIds.length > 0) {
      recipientErrors.push(`recipient ${index + 1}: unknown fields ${unknownFieldIds.join(', ')}`);
    }

    if (missingRequiredIds.length > 0) {
      recipientErrors.push(`recipient ${index + 1}: missing required fields ${missingRequiredIds.join(', ')}`);
    }

    return recipientErrors;
  });

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
}

function inspectRecipients(
  recipients: CertificateField[][],
  fields: TextFieldConfig[],
  backFields: TextFieldConfig[],
) {
  const allFields = [...fields, ...backFields];
  const knownFieldIds = new Set(allFields.map((field) => field.id));
  const requiredFields = allFields.filter((field) => field.required === true);

  const missingRequiredByRecipient = recipients.flatMap((recipientValues, index) => {
    const valuesByFieldId = new Map<string, string>();

    for (const entry of recipientValues) {
      valuesByFieldId.set(entry.fieldId, entry.value);
    }

    const missingFieldIds = requiredFields
      .filter((field) => !valuesByFieldId.get(field.id)?.trim())
      .map((field) => field.id);

    return missingFieldIds.length > 0
      ? [{ recipientIndex: index, missingFieldIds }]
      : [];
  });

  const unknownFieldIdsByRecipient = recipients.flatMap((recipientValues, index) => {
    const unknownFieldIds = recipientValues
      .filter((entry) => !knownFieldIds.has(entry.fieldId))
      .map((entry) => entry.fieldId);

    return unknownFieldIds.length > 0
      ? [{ recipientIndex: index, unknownFieldIds }]
      : [];
  });

  return {
    missingRequiredByRecipient,
    requiredFieldIds: requiredFields.map((field) => field.id),
    unknownFieldIdsByRecipient,
  };
}

async function loadTemplateForUser(userId: string, templateId: string): Promise<TemplateRecord> {
  const [template] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, templateId), eq(certificateTemplate.userId, userId)));

  if (!template) {
    throw new Error('Template not found');
  }

  return template;
}

async function finalizeJob(
  jobId: string,
  result: CertificateGenerationResult,
  isDuplexSheet: boolean,
): Promise<void> {
  const resultPayload: CertificateJobResultPayload = {
    downloadLabel: result.downloadLabel,
    fileKey: result.fileKey,
    fileName: result.fileName,
    fileUrl: result.fileUrl,
    isDuplexSheet,
  };

  await db
    .update(certificateJob)
    .set({
      completedAt: new Date(),
      downloadLabel: result.downloadLabel,
      fileName: result.fileName,
      processedCount: result.count,
      resultKey: result.fileKey,
      resultPayload,
      resultUrl: result.fileUrl,
      status: 'completed',
      zipKey: result.fileKey,
      zipUrl: result.fileUrl,
    })
    .where(eq(certificateJob.id, jobId));
}

export async function listUserCertificateTemplates(userId: string) {
  const templates = await db
    .select()
    .from(certificateTemplate)
    .where(eq(certificateTemplate.userId, userId))
    .orderBy(certificateTemplate.createdAt);

  return templates.map((template) => {
    const fields = template.fields as TextFieldConfig[];
    const backFields = template.backFields as TextFieldConfig[];
    const printSettings = template.printSettings
      ? normalizePrintSheetSettings(template.printSettings as Record<string, unknown>)
      : getDefaultPrintSheetSettingsForTemplateType(template.templateType);
    const hasBackSide = Boolean(template.backR2Key && template.backWidth && template.backHeight);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      templateType: template.templateType,
      hasBackSide,
      fields: fields.map((field) => ({
        id: field.id,
        label: field.label,
        required: field.required === true,
        side: 'front' as const,
      })),
      backFields: backFields.map((field) => ({
        id: field.id,
        label: field.label,
        required: field.required === true,
        side: 'back' as const,
      })),
      allFieldIds: [...fields, ...backFields].map((field) => field.id),
      requiredFieldIds: [...fields, ...backFields].filter((field) => field.required === true).map((field) => field.id),
      printSettings: {
        preset: printSettings.preset,
        duplexMode: printSettings.duplexMode,
        backPageOrder: printSettings.backPageOrder,
        backOffsetXMm: printSettings.backOffsetXMm,
        backOffsetYMm: printSettings.backOffsetYMm,
        backFlipX: printSettings.backFlipX,
        backFlipY: printSettings.backFlipY,
      },
      supportedExportModes: [
        'single_file',
        'zip',
        'single_pdf',
        'sheet_pdf',
      ] as CertificateOutputMode[],
    };
  });
}

export async function listCertificateJobs(userId: string, options?: {
  limit?: number;
  source?: CertificateJobSource;
  status?: TemplateRecord extends never ? never : 'pending' | 'processing' | 'completed' | 'failed';
  templateId?: string;
}) {
  const filters = [eq(certificateJob.userId, userId)];

  if (options?.templateId) {
    filters.push(eq(certificateJob.templateId, options.templateId));
  }

  if (options?.source) {
    filters.push(eq(certificateJob.source, options.source));
  }

  if (options?.status) {
    filters.push(eq(certificateJob.status, options.status));
  }

  const rows = await db
    .select()
    .from(certificateJob)
    .where(and(...filters))
    .orderBy(desc(certificateJob.createdAt))
    .limit(options?.limit ?? 20);

  return rows;
}

export async function previewCertificateGeneration(options: {
  format?: CertificateOutputFormat;
  outputMode?: Exclude<CertificateOutputMode, 'single_file'>;
  recipients: CertificateRecipientInput[];
  templateId: string;
  userId: string;
}): Promise<CertificateGenerationPreview> {
  const recipients = options.recipients.map((recipient) => normalizeRecipientValues(recipient.values));

  if (recipients.length === 0) {
    throw new Error('Missing recipients');
  }

  const template = await loadTemplateForUser(options.userId, options.templateId);
  const fields = template.fields as TextFieldConfig[];
  const backFields = template.backFields as TextFieldConfig[];
  const outputMode = resolveOutputMode(recipients.length, options.format ?? 'png', options.outputMode);
  const inspection = inspectRecipients(recipients, fields, backFields);

  return {
    canGenerate: inspection.missingRequiredByRecipient.length === 0 && inspection.unknownFieldIdsByRecipient.length === 0,
    missingRequiredByRecipient: inspection.missingRequiredByRecipient,
    outputMode,
    requiredFieldIds: inspection.requiredFieldIds,
    template: {
      hasBackSide: Boolean(template.backR2Key && template.backWidth && template.backHeight),
      id: template.id,
      name: template.name,
      templateType: template.templateType,
    },
    unknownFieldIdsByRecipient: inspection.unknownFieldIdsByRecipient,
  };
}

export async function generateCertificateOutput(options: {
  format?: CertificateOutputFormat;
  maxRecipients?: number;
  outputMode?: Exclude<CertificateOutputMode, 'single_file'>;
  recipients: CertificateRecipientInput[];
  source?: CertificateJobSource;
  templateId: string;
  userId: string;
}): Promise<CertificateGenerationResult> {
  const format = options.format ?? 'png';
  const maxRecipients = options.maxRecipients ?? 500;
  const recipients = options.recipients.map((recipient) => ({
    values: normalizeRecipientValues(recipient.values),
  }));

  if (recipients.length === 0) {
    throw new Error('Missing recipients');
  }

  if (recipients.length > maxRecipients) {
    throw new Error(`Maximum ${maxRecipients} recipients per request`);
  }

  const template = await loadTemplateForUser(options.userId, options.templateId);
  const fields = template.fields as TextFieldConfig[];
  const backFields = template.backFields as TextFieldConfig[];
  const normalizedRecipientValues = recipients.map((recipient) => recipient.values);

  validateRecipients(normalizedRecipientValues, fields, backFields);

  const outputMode = resolveOutputMode(recipients.length, format, options.outputMode);
  const requestPayload: CertificateJobRequestPayload = {
    fieldIds: [...fields, ...backFields].map((field) => field.id),
    hasBackSide: Boolean(template.backR2Key),
    recipientCount: recipients.length,
    recipientPreview: normalizedRecipientValues.slice(0, 5).map((values, index) => getRecipientDisplayName(values, `certificate_${index + 1}`)),
    requiredFieldIds: [...fields, ...backFields].filter((field) => field.required === true).map((field) => field.id),
    templateName: template.name,
  };

  const jobId = nanoid();
  await db.insert(certificateJob).values({
    id: jobId,
    userId: options.userId,
    templateId: options.templateId,
    status: 'processing',
    format,
    exportMode: outputMode,
    source: options.source ?? 'manual',
    totalCount: recipients.length,
    processedCount: 0,
    requestPayload,
  });

  try {
    const imageRes = await fetch(template.url);

    if (!imageRes.ok) {
      throw new Error('Failed to fetch template image');
    }

    const templateBuffer = Buffer.from(await imageRes.arrayBuffer());
    const printSettings = template.printSettings
      ? normalizePrintSheetSettings(template.printSettings as Record<string, unknown>)
      : getDefaultPrintSheetSettingsForTemplateType(template.templateType);
    const canGenerateDuplexSheet = Boolean(
      format === 'pdf'
      && outputMode === 'sheet_pdf'
      && printSettings.duplexMode === 'front_back'
      && template.backUrl
      && template.backWidth
      && template.backHeight,
    );
    const backTemplateBuffer = canGenerateDuplexSheet
      ? Buffer.from(await (async () => {
        const response = await fetch(template.backUrl!);

        if (!response.ok) {
          throw new Error('Failed to fetch back template image');
        }

        return response.arrayBuffer();
      })())
      : null;

    if (outputMode === 'single_file') {
      const recipientValues = normalizedRecipientValues[0];
      const fileStem = getRecipientDisplayName(recipientValues, 'certificate_1');
      const fileName = `${fileStem}.${format}`;
      const fileKey = `certificates/output/${options.userId}/${jobId}/${fileName}`;
      const certBuffer = await generateCertificate({
        templateBuffer,
        templateWidth: template.width,
        templateHeight: template.height,
        fields,
        values: recipientValues,
        format,
      });
      const upload = await uploadPublicObject({
        key: fileKey,
        body: certBuffer,
        contentType: MIME_BY_FORMAT[format],
        cacheControl: 'public, max-age=86400',
      });
      const result: CertificateGenerationResult = {
        count: 1,
        downloadLabel: 'Download file',
        fileKey,
        fileName,
        fileUrl: upload.url,
        format,
        jobId,
        outputMode,
      };

      await finalizeJob(jobId, result, false);
      return result;
    }

    const usedNames = new Map<string, number>();
    const zip = new JSZip();
    const pdfBuffers: Buffer[] = [];
    const sheetImageBuffers: Buffer[] = [];
    const backSheetImageBuffers: Buffer[] = [];

    for (let index = 0; index < normalizedRecipientValues.length; index += 1) {
      const values = normalizedRecipientValues[index];
      const certBuffer = await generateCertificate({
        templateBuffer,
        templateWidth: template.width,
        templateHeight: template.height,
        fields,
        values,
        format: outputMode === 'sheet_pdf' ? 'png' : format,
      });
      const baseName = getRecipientDisplayName(values, `certificate_${index + 1}`);
      const duplicateCount = usedNames.get(baseName) ?? 0;
      usedNames.set(baseName, duplicateCount + 1);
      const fileName = duplicateCount === 0 ? `${baseName}.${format}` : `${baseName}_${duplicateCount}.${format}`;

      if (outputMode === 'sheet_pdf') {
        sheetImageBuffers.push(certBuffer);

        if (canGenerateDuplexSheet && backTemplateBuffer && template.backWidth && template.backHeight) {
          const backBuffer = await generateCertificate({
            templateBuffer: backTemplateBuffer,
            templateWidth: template.backWidth,
            templateHeight: template.backHeight,
            fields: backFields,
            values,
            format: 'png',
          });

          backSheetImageBuffers.push(backBuffer);
        }
      } else if (outputMode === 'single_pdf') {
        pdfBuffers.push(certBuffer);
      } else {
        zip.file(fileName, certBuffer);
      }
    }

    if (outputMode === 'sheet_pdf') {
      const sheetPdfBuffer = canGenerateDuplexSheet && template.backWidth && template.backHeight
        ? await createDuplexSheetPdf(
            sheetImageBuffers,
            backSheetImageBuffers,
            template.width,
            template.height,
            template.backWidth,
            template.backHeight,
            printSettings,
          )
        : await createSheetPdf(sheetImageBuffers, template.width, template.height, printSettings);
      const fileName = `${sanitizeFileStem(template.name)}_${printSettings.preset}_sheet.pdf`;
      const fileKey = `certificates/output/${options.userId}/${jobId}/${fileName}`;
      const upload = await uploadPublicObject({
        key: fileKey,
        body: sheetPdfBuffer,
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=86400',
      });
      const result: CertificateGenerationResult = {
        count: normalizedRecipientValues.length,
        downloadLabel: canGenerateDuplexSheet ? 'Download print PDF (front/back)' : 'Download print PDF',
        fileKey,
        fileName,
        fileUrl: upload.url,
        format,
        jobId,
        outputMode,
      };

      await finalizeJob(jobId, result, canGenerateDuplexSheet);
      return result;
    }

    if (outputMode === 'single_pdf') {
      const mergedPdfBuffer = await mergePdfBuffers(pdfBuffers);
      const fileName = `${sanitizeFileStem(template.name)}_batch.pdf`;
      const fileKey = `certificates/output/${options.userId}/${jobId}/${fileName}`;
      const upload = await uploadPublicObject({
        key: fileKey,
        body: mergedPdfBuffer,
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=86400',
      });
      const result: CertificateGenerationResult = {
        count: normalizedRecipientValues.length,
        downloadLabel: 'Download PDF',
        fileKey,
        fileName,
        fileUrl: upload.url,
        format,
        jobId,
        outputMode,
      };

      await finalizeJob(jobId, result, false);
      return result;
    }

    const zipBuffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    const fileName = `${sanitizeFileStem(template.name)}.zip`;
    const fileKey = `certificates/zips/${options.userId}/${jobId}.zip`;
    const upload = await uploadPublicObject({
      key: fileKey,
      body: zipBuffer,
      contentType: 'application/zip',
      cacheControl: 'public, max-age=86400',
    });
    const result: CertificateGenerationResult = {
      count: normalizedRecipientValues.length,
      downloadLabel: 'Download ZIP',
      fileKey,
      fileName,
      fileUrl: upload.url,
      format,
      jobId,
      outputMode,
    };

    await finalizeJob(jobId, result, false);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';

    await db
      .update(certificateJob)
      .set({ error: message, status: 'failed' })
      .where(eq(certificateJob.id, jobId));

    throw new Error(message);
  }
}
