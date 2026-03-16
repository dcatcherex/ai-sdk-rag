import { z } from 'zod';

export const generateWebsiteInputSchema = z.object({
  businessDescription: z.string().min(10).max(2000).describe('Detailed description of the business, services, and goals'),
  templateSlug: z.enum(['portfolio', 'service-landing', 'consulting', 'personal']).describe('Template style to use'),
  siteName: z.string().min(1).max(100).describe('Name of the website / business'),
});

export const editWebsiteInputSchema = z.object({
  websiteId: z.string().min(1).describe('ID of the website to edit'),
  editRequest: z.string().min(5).max(1000).describe('Natural language description of the desired changes'),
});

export const publishWebsiteInputSchema = z.object({
  websiteId: z.string().min(1).describe('ID of the website to publish to Cloudflare Pages'),
});

export const getWebsiteStatusInputSchema = z.object({
  websiteId: z.string().min(1).describe('ID of the website to fetch'),
});

// Zod schema for AI-generated SiteDataJson
export const siteSectionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('hero'),
    visible: z.boolean(),
    data: z.object({
      headline: z.string(),
      subtext: z.string(),
      ctaText: z.string(),
      ctaUrl: z.string(),
      imageUrl: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('features'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      features: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string().optional() })),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('about'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      body: z.string(),
      imageUrl: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('testimonials'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      testimonials: z.array(z.object({ quote: z.string(), author: z.string(), role: z.string().optional() })),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('pricing'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      plans: z.array(z.object({ name: z.string(), price: z.string(), features: z.array(z.string()), highlighted: z.boolean().optional() })),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('faq'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      items: z.array(z.object({ question: z.string(), answer: z.string() })),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('contact'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      formEnabled: z.boolean(),
    }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('cta'),
    visible: z.boolean(),
    data: z.object({
      heading: z.string(),
      subtext: z.string(),
      ctaText: z.string(),
      ctaUrl: z.string(),
    }),
  }),
]);

export const siteDataJsonSchema = z.object({
  templateSlug: z.enum(['portfolio', 'service-landing', 'consulting', 'personal']),
  siteName: z.string(),
  tagline: z.string(),
  heroHeadline: z.string(),
  heroSubtext: z.string(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontHeading: z.string(),
  fontBody: z.string(),
  ctaText: z.string(),
  ctaUrl: z.string(),
  sections: z.array(siteSectionSchema),
  meta: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()).optional(),
  }),
  businessDescription: z.string(),
  generatedAt: z.string(),
});

export type GenerateWebsiteInput = z.infer<typeof generateWebsiteInputSchema>;
export type EditWebsiteInput = z.infer<typeof editWebsiteInputSchema>;
export type PublishWebsiteInput = z.infer<typeof publishWebsiteInputSchema>;
export type GetWebsiteStatusInput = z.infer<typeof getWebsiteStatusInputSchema>;
export type SiteDataJsonInput = z.infer<typeof siteDataJsonSchema>;
