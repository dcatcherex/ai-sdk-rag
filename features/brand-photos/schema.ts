import { z } from 'zod';

export const getBrandPhotosInputSchema = z.object({
  tags: z.array(z.string()).optional().describe(
    'Filter by tags (e.g. ["summer-camp", "math-course"]). Omit to get from all photos.',
  ),
  limit: z.number().int().min(1).max(10).optional().default(1).describe(
    'How many activity photos to return. Default 1.',
  ),
  includeLogo: z.boolean().optional().default(true).describe(
    'When true and a brand is active, append the brand logo URL as the last reference image.',
  ),
});
export type GetBrandPhotosInput = z.infer<typeof getBrandPhotosInputSchema>;

export const brandPhotoItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  filename: z.string().nullable(),
  tags: z.array(z.string()),
  usageCount: z.number(),
});
export type BrandPhotoItem = z.infer<typeof brandPhotoItemSchema>;

export const getBrandPhotosOutputSchema = z.object({
  photos: z.array(brandPhotoItemSchema),
  totalAvailable: z.number(),
  tags: z.array(z.string()).describe('All distinct tags in the photo bank'),
  logoUrl: z.string().nullable().optional(),
  imageUrls: z.array(z.string()).optional(),
});
export type GetBrandPhotosOutput = z.infer<typeof getBrandPhotosOutputSchema>;
