import { tool } from 'ai';
import { z } from 'zod';
import {
  generateCertificateOutput,
  listUserCertificateTemplates,
  previewCertificateGeneration,
  type CertificateJobSource,
} from '@/lib/certificate-service';
import type { CertificateField } from '@/lib/certificate-generator';

/**
 * Create certificate tools scoped to a specific user.
 * Returned tools can be passed directly to streamText().
 */
export function createCertificateTools(
  userId: string,
  options?: {
    maxRecipients?: number;
    source?: CertificateJobSource;
  },
) {
  return {
    list_certificate_templates: tool({
      description:
        'List available certificate templates with their configurable fields. Call this first to know which templates exist and what field values are needed.',
      inputSchema: z.object({}),
      async execute() {
        return {
          templates: await listUserCertificateTemplates(userId),
        };
      },
    }),

    preview_certificate_generation: tool({
      description:
        'Validate certificate generation inputs before creating files. Returns missing required fields, unknown fields, and the resolved output mode.',
      inputSchema: z.object({
        templateId: z.string().describe('The ID of the certificate template to use'),
        recipients: z
          .array(z.object({ values: z.record(z.string(), z.string()) }))
          .min(1)
          .describe('Recipient field values keyed by field ID. Use list_certificate_templates first.'),
        format: z
          .enum(['png', 'jpg', 'pdf'])
          .optional()
          .default('png')
          .describe('Output format'),
        outputMode: z
          .enum(['zip', 'single_pdf', 'sheet_pdf'])
          .optional()
          .describe('Batch output mode. Omit for single-recipient generation.'),
      }),
      async execute({ templateId, recipients, format, outputMode }) {
        const preview = await previewCertificateGeneration({
          userId,
          templateId,
          recipients,
          format,
          outputMode,
        });

        return {
          success: true,
          ...preview,
        };
      },
    }),

    generate_certificate_output: tool({
      description:
        'Generate one or more certificate outputs from a template. Supports single-file generation and batch export modes. Returns a persisted job ID and download URL.',
      inputSchema: z.object({
        templateId: z.string().describe('The ID of the certificate template to use'),
        recipients: z
          .array(z.object({ values: z.record(z.string(), z.string()) }))
          .min(1)
          .describe('Recipient field values keyed by field ID. Use list_certificate_templates first.'),
        format: z
          .enum(['png', 'jpg', 'pdf'])
          .optional()
          .default('png')
          .describe('Output format'),
        outputMode: z
          .enum(['zip', 'single_pdf', 'sheet_pdf'])
          .optional()
          .describe('Batch output mode. Omit for single-recipient generation.'),
      }),
      async execute({ templateId, recipients, format, outputMode }) {
        const result = await generateCertificateOutput({
          userId,
          templateId,
          recipients,
          format,
          outputMode,
          source: options?.source ?? 'manual',
          maxRecipients: options?.maxRecipients,
        });

        return {
          success: true,
          ...result,
          url: result.fileUrl,
        };
      },
    }),

    generate_certificate: tool({
      description:
        'Generate a single certificate file by filling in the template fields with the provided values. Returns a persisted job ID and download URL.',
      inputSchema: z.object({
        templateId: z.string().describe('The ID of the certificate template to use'),
        values: z
          .array(z.object({ fieldId: z.string(), value: z.string() }))
          .describe('Values for each template field (use fieldId from list_certificate_templates)'),
        format: z
          .enum(['png', 'jpg', 'pdf'])
          .optional()
          .default('png')
          .describe('Output format'),
      }),
      async execute({ templateId, values, format }) {
        const result = await generateCertificateOutput({
          userId,
          templateId,
          recipients: [{ values: values as CertificateField[] }],
          format,
          source: options?.source ?? 'manual',
          maxRecipients: options?.maxRecipients,
        });

        return {
          success: true,
          ...result,
          url: result.fileUrl,
        };
      },
    }),
  };
}
