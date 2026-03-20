/**
 * Image Optimization Utilities
 *
 * Provides reusable image optimization functionality using Sharp library.
 * Supports WebP conversion, quality adjustment, and buffer extraction from various sources.
 *
 * ⚠️ SERVER-ONLY: This module uses Sharp which requires Node.js APIs.
 * Only import this module in server-side code (API routes).
 * Use dynamic imports to prevent client-side bundling.
 */

export interface ImageOptimizationOptions {
    /**
     * Output image format
     * @default 'webp'
     */
    format?: 'webp' | 'jpeg' | 'png' | 'avif';

    /**
     * Image quality (1-100)
     * @default 90
     */
    quality?: number;

    /**
     * Compression effort level (1-6 for WebP, 4-9 for AVIF)
     * Higher values = better compression but slower
     * @default 4
     */
    effort?: number;

    /**
     * Maximum width in pixels (maintains aspect ratio)
     */
    maxWidth?: number;

    /**
     * Maximum height in pixels (maintains aspect ratio)
     */
    maxHeight?: number;

    /**
     * Enable logging of optimization results
     * @default true
     */
    enableLogging?: boolean;
}

export interface OptimizationResult {
    /**
     * Optimized image buffer
     */
    buffer: Buffer;

    /**
     * Output content type
     */
    contentType: string;

    /**
     * File extension for the optimized format
     */
    extension: string;

    /**
     * Original size in bytes
     */
    originalSize: number;

    /**
     * Optimized size in bytes
     */
    optimizedSize: number;

    /**
     * Percentage saved
     */
    percentSaved: number;
}

/**
 * Default optimization settings
 */
export const DEFAULT_OPTIMIZATION_OPTIONS: Required<Omit<ImageOptimizationOptions, 'maxWidth' | 'maxHeight'>> = {
    format: 'webp',
    quality: 90,
    effort: 4,
    enableLogging: true
};

/**
 * Extract image buffer from various source types
 *
 * @param source - Image source (URL, base64 string, File, Blob, Buffer, or ArrayBuffer)
 * @returns Image buffer
 */
export async function getImageBuffer(
    source: string | File | Blob | Buffer | ArrayBuffer
): Promise<Buffer> {
    // Already a Buffer
    if (Buffer.isBuffer(source)) {
        return source;
    }

    // ArrayBuffer
    if (source instanceof ArrayBuffer) {
        return Buffer.from(source);
    }

    // Blob or File
    if (source instanceof Blob) {
        const arrayBuffer = await source.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    // String (URL or base64)
    if (typeof source === 'string') {
        // Check if it's a URL
        if (source.startsWith('http://') || source.startsWith('https://')) {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }

        // Assume it's base64
        const base64Data = source.includes(',')
            ? source.split(',')[1]  // Remove data:image/...;base64, prefix
            : source;

        return Buffer.from(base64Data, 'base64');
    }

    throw new Error(`Unsupported source type: ${typeof source}`);
}

/**
 * Optimize image to specified format with compression
 *
 * @param source - Image source (URL, base64, File, Blob, Buffer, or ArrayBuffer)
 * @param options - Optimization options
 * @returns Optimization result with buffer and metadata
 */
export async function optimizeImage(
    source: string | File | Blob | Buffer | ArrayBuffer,
    options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> {
    // Merge with defaults
    const opts = { ...DEFAULT_OPTIMIZATION_OPTIONS, ...options };

    // Dynamic import of Sharp (only load when needed)
    const sharp = (await import('sharp')).default;

    // Extract buffer from source
    const originalBuffer = await getImageBuffer(source);
    const originalSize = originalBuffer.length;

    // Create Sharp instance
    let pipeline = sharp(originalBuffer);

    // Apply resizing if specified
    if (opts.maxWidth || opts.maxHeight) {
        pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    // Apply format-specific optimization
    let optimizedBuffer: Buffer;
    let contentType: string;
    let extension: string;

    switch (opts.format) {
        case 'webp':
            optimizedBuffer = await pipeline
                .webp({ quality: opts.quality, effort: opts.effort })
                .toBuffer();
            contentType = 'image/webp';
            extension = '.webp';
            break;

        case 'jpeg':
            optimizedBuffer = await pipeline
                .jpeg({ quality: opts.quality, progressive: true })
                .toBuffer();
            contentType = 'image/jpeg';
            extension = '.jpg';
            break;

        case 'png':
            optimizedBuffer = await pipeline
                .png({ quality: opts.quality, compressionLevel: Math.min(9, opts.effort) })
                .toBuffer();
            contentType = 'image/png';
            extension = '.png';
            break;

        case 'avif':
            optimizedBuffer = await pipeline
                .avif({ quality: opts.quality, effort: Math.min(9, opts.effort) })
                .toBuffer();
            contentType = 'image/avif';
            extension = '.avif';
            break;

        default:
            throw new Error(`Unsupported format: ${opts.format}`);
    }

    const optimizedSize = optimizedBuffer.length;
    const percentSaved = ((originalSize - optimizedSize) / originalSize) * 100;

    // Log optimization results
    if (opts.enableLogging) {
        const originalKB = (originalSize / 1024).toFixed(2);
        const optimizedKB = (optimizedSize / 1024).toFixed(2);
        console.log(
            `📉 [IMAGE OPT] ${opts.format.toUpperCase()}: ${originalKB}KB → ${optimizedKB}KB (${percentSaved.toFixed(0)}% saved)`
        );
    }

    return {
        buffer: optimizedBuffer,
        contentType,
        extension,
        originalSize,
        optimizedSize,
        percentSaved
    };
}

/**
 * Optimize image to WebP format (convenience function)
 *
 * @param source - Image source
 * @param quality - Image quality (1-100)
 * @param effort - Compression effort (1-6)
 * @returns Optimization result
 */
export async function optimizeToWebP(
    source: string | File | Blob | Buffer | ArrayBuffer,
    quality: number = 90,
    effort: number = 4
): Promise<OptimizationResult> {
    return optimizeImage(source, { format: 'webp', quality, effort });
}

/**
 * Check if a file is an image based on content type
 */
export function isImageFile(contentType: string): boolean {
    return contentType.startsWith('image/') && !contentType.includes('svg');
}

/**
 * Get recommended optimization options based on bucket configuration
 */
export function getRecommendedOptimization(bucketName: string): ImageOptimizationOptions {
    switch (bucketName) {
        case 'generated-images':
            return { format: 'webp', quality: 90, effort: 4 };

        case 'prompt-covers':
            return { format: 'webp', quality: 85, effort: 5, maxWidth: 1200 };

        case 'custom-references':
            return { format: 'webp', quality: 90, effort: 4, maxWidth: 2048 };

        default:
            return DEFAULT_OPTIMIZATION_OPTIONS;
    }
}
