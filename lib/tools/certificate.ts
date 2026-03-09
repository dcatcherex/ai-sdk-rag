import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { certificateTemplate } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateCertificate } from '@/lib/certificate-generator';
import { uploadPublicObject } from '@/lib/r2';
import { nanoid } from 'nanoid';
import type { TextFieldConfig, CertificateField } from '@/lib/certificate-generator';

/**
 * Create certificate tools scoped to a specific user.
 * Returned tools can be passed directly to streamText().
 */
export function createCertificateTools(userId: string) {
  return {
    list_certificate_templates: tool({
      description:
        'List available certificate templates with their configurable fields. Call this first to know which templates exist and what field values are needed.',
      inputSchema: z.object({}),
      async execute() {
        const templates = await db
          .select({
            id: certificateTemplate.id,
            name: certificateTemplate.name,
            description: certificateTemplate.description,
            fields: certificateTemplate.fields,
            width: certificateTemplate.width,
            height: certificateTemplate.height,
          })
          .from(certificateTemplate)
          .where(eq(certificateTemplate.userId, userId));

        return {
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            fields: (t.fields as TextFieldConfig[]).map((f) => ({
              id: f.id,
              label: f.label,
            })),
          })),
        };
      },
    }),

    generate_certificate: tool({
      description:
        'Generate a single certificate image by filling in the template fields with the provided values. Returns a download URL.',
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
        const [template] = await db
          .select()
          .from(certificateTemplate)
          .where(eq(certificateTemplate.id, templateId));

        if (!template || template.userId !== userId) {
          return { success: false, error: 'Template not found' };
        }

        try {
          const imageRes = await fetch(template.url);
          if (!imageRes.ok) return { success: false, error: 'Could not load template image' };
          const templateBuffer = Buffer.from(await imageRes.arrayBuffer());

          const MIME: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            pdf: 'application/pdf',
          };

          const certBuffer = await generateCertificate({
            templateBuffer,
            templateWidth: template.width,
            templateHeight: template.height,
            fields: template.fields as TextFieldConfig[],
            values: values as CertificateField[],
            format,
          });

          const nameValue = values.find((v) => v.fieldId === 'name')?.value ?? nanoid(6);
          const safeName = nameValue.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);
          const jobId = nanoid();
          const r2Key = `certificates/output/${userId}/${jobId}/${safeName}.${format}`;

          const { url } = await uploadPublicObject({
            key: r2Key,
            body: certBuffer,
            contentType: MIME[format],
            cacheControl: 'public, max-age=86400',
          });

          return { success: true, url, filename: `${safeName}.${format}` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),
  };
}
