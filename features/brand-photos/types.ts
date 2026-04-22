export type { GetBrandPhotosInput, GetBrandPhotosOutput, BrandPhotoItem } from './schema';

export type BrandPhotoContext = {
  userId?: string;
  brandId?: string;
  lineUserId?: string;
  channelId?: string;
};
