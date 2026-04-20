import { z } from 'zod';

export const getBrandPhotosInputSchema = z.object({
  tags: z.array(z.string()).optional().describe(
    'Filter by tags (e.g. ["summer-camp", "math-course"]). Omit to get from all photos.',
  ),
  limit: z.number().int().min(1).max(10).optional().default(3).describe(
    'How many photos to return. Default 3.',
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
});
export type GetBrandPhotosOutput = z.infer<typeof getBrandPhotosOutputSchema>;
