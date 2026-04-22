import 'server-only';

import { nanoid } from 'nanoid';
import { uploadPublicObject } from '@/lib/r2';
import { optimizeImage } from './imageOptimization';
import type { ImageOptimizationOptions } from './imageOptimization';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export type UploadImageResult = {
  url: string;
  key: string;
  originalSize: number;
  optimizedSize: number;
  contentType: string;
};

export type UploadImageOptions = {
  /** R2 key prefix, e.g. "agent-covers", "brand-assets/abc123" */
  prefix: string;
  /** Sharp optimization settings. Defaults: WebP, quality 85, maxWidth 1200 */
  optimization?: ImageOptimizationOptions;
  /** Max file size in bytes. Defaults to 2 MB */
  maxSizeBytes?: number;
};

/**
 * Standard image upload pipeline for user-uploaded images.
 * Validates → optimizes via Sharp → stores to R2.
 * Use this in all API routes that accept image uploads.
 */
const isSvg = (file: File) =>
  file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

export async function uploadImage(
  file: File,
  options: UploadImageOptions,
): Promise<UploadImageResult> {
  const maxSize = options.maxSizeBytes ?? MAX_SIZE_BYTES;

  if (!ALLOWED_IMAGE_TYPES.has(file.type) && !isSvg(file)) {
    throw new UploadError('Invalid file type. Use JPEG, PNG, WebP, GIF, or SVG.', 400);
  }

  if (file.size > maxSize) {
    const mb = (maxSize / 1024 / 1024).toFixed(0);
    throw new UploadError(`File too large. Maximum ${mb} MB.`, 400);
  }

  // SVGs are vector XML — skip Sharp, upload as-is
  if (isSvg(file)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `${options.prefix}/${nanoid()}.svg`;
    const { url } = await uploadPublicObject({ key, body: buffer, contentType: 'image/svg+xml' });
    return { url, key, originalSize: buffer.length, optimizedSize: buffer.length, contentType: 'image/svg+xml' };
  }

  const opts: ImageOptimizationOptions = {
    format: 'webp',
    quality: 85,
    maxWidth: 1200,
    enableLogging: true,
    ...options.optimization,
  };

  const result = await optimizeImage(file, opts);

  const key = `${options.prefix}/${nanoid()}.webp`;
  const { url } = await uploadPublicObject({
    key,
    body: result.buffer,
    contentType: result.contentType,
  });

  return {
    url,
    key,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    contentType: result.contentType,
  };
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}
