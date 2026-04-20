import { tool } from 'ai';
import { getBrandPhotosInputSchema } from './schema';
import { runGetBrandPhotos } from './service';
import type { BrandPhotoContext } from './types';

export function createBrandPhotosAgentTools(ctx: BrandPhotoContext) {
  return {
    get_brand_photos: tool({
      description:
        'Retrieve photos from the user\'s brand photo bank to use as reference images when creating social posts or visual content. Photos are picked automatically with balanced rotation so no single photo is overused. Filter by tags to get photos for a specific course or product category.',
      inputSchema: getBrandPhotosInputSchema,
      async execute(input) {
        const result = await runGetBrandPhotos(input, ctx);
        return {
          success: true,
          ...result,
          imageUrls: result.photos.map((p) => p.url),
        };
      },
    }),
  };
}
