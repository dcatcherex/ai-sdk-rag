import { z } from 'zod';

export const listTemplatesInputSchema = z.object({});

export const previewCertificateInputSchema = z.object({
  templateId: z.string().describe('The ID of the certificate template to use'),
  recipients: z
    .array(z.object({ values: z.record(z.string(), z.string()) }))
    .min(1)
    .describe('Recipient field values keyed by field ID'),
  format: z.enum(['png', 'jpg', 'pdf']).optional().default('png'),
  outputMode: z
    .enum(['zip', 'single_pdf', 'sheet_pdf'])
    .optional()
    .describe('Batch output mode. Omit for single-recipient generation.'),
});

export const generateCertificateOutputInputSchema = z.object({
  templateId: z.string().describe('The ID of the certificate template to use'),
  recipients: z
    .array(z.object({ values: z.record(z.string(), z.string()) }))
    .min(1)
    .describe('Recipient field values keyed by field ID'),
  format: z.enum(['png', 'jpg', 'pdf']).optional().default('png'),
  outputMode: z
    .enum(['zip', 'single_pdf', 'sheet_pdf'])
    .optional()
    .describe('Batch output mode. Omit for single-recipient generation.'),
});

export const generateSingleCertificateInputSchema = z.object({
  templateId: z.string().describe('The ID of the certificate template to use'),
  values: z
    .array(z.object({ fieldId: z.string(), value: z.string() }))
    .describe('Values for each template field'),
  format: z.enum(['png', 'jpg', 'pdf']).optional().default('png'),
});

export type PreviewCertificateInput = z.infer<typeof previewCertificateInputSchema>;
export type GenerateCertificateOutputInput = z.infer<typeof generateCertificateOutputInputSchema>;
export type GenerateSingleCertificateInput = z.infer<typeof generateSingleCertificateInputSchema>;
