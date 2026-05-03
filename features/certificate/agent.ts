/**
 * Thin AI SDK adapter for certificate tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import type { CertificateField } from '@/lib/certificate-generator';
import {
  listTemplatesInputSchema,
  previewCertificateInputSchema,
  generateCertificateOutputInputSchema,
  generateSingleCertificateInputSchema,
} from './schema';
import {
  generateCertificateOutput,
  listUserCertificateTemplates,
  previewCertificateGeneration,
} from './service';

export function createCertificateAgentTools(
  ctx: Pick<AgentToolContext, 'userId' | 'source'> & { maxRecipients?: number },
) {
  const { userId, source = 'agent', maxRecipients } = ctx;

  return {
    list_certificate_templates: tool({
      description:
        'List available certificate templates with their configurable fields. Call this first when the user wants to create, preview, or inspect certificates — before asking the user for any input. Never describe templates, fields, or certificate outputs as plain text. Always use the certificate tools: list_certificate_templates → preview_certificate_generation → generate_certificate_output (or generate_certificate for a single recipient).',
      inputSchema: listTemplatesInputSchema,
      async execute() {
        return { templates: await listUserCertificateTemplates(userId) };
      },
    }),

    preview_certificate_generation: tool({
      description:
        'Validate certificate generation inputs before creating files. Returns missing required fields, unknown fields, and the resolved output mode. Call this after list_certificate_templates and before generate_certificate_output — do not skip validation.',
      inputSchema: previewCertificateInputSchema,
      async execute({ templateId, recipients, format, outputMode }) {
        const preview = await previewCertificateGeneration({
          userId,
          templateId,
          recipients,
          format,
          outputMode,
        });
        return { success: true, ...preview };
      },
    }),

    generate_certificate_output: tool({
      description:
        'Generate one or more certificate outputs from a template. Supports single-file generation and batch export modes. Returns a persisted job ID and download URL. If this tool call fails, explain the actual error briefly and ask only for the missing or incorrect input — do not fabricate a generic error message.',
      inputSchema: generateCertificateOutputInputSchema,
      async execute({ templateId, recipients, format, outputMode }) {
        const result = await generateCertificateOutput({
          userId,
          templateId,
          recipients,
          format,
          outputMode,
          source,
          maxRecipients,
        });
        return { success: true, ...result, url: result.fileUrl };
      },
    }),

    generate_certificate: tool({
      description:
        'Generate a single certificate file by filling in the template fields with the provided values. Returns a persisted job ID and download URL.',
      inputSchema: generateSingleCertificateInputSchema,
      async execute({ templateId, values, format }) {
        const result = await generateCertificateOutput({
          userId,
          templateId,
          recipients: [{ values: values as CertificateField[] }],
          format,
          source,
          maxRecipients,
        });
        return { success: true, ...result, url: result.fileUrl };
      },
    }),
  };
}
