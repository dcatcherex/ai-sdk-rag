import { BucketConfig } from './types';
import { ImageOptimizationOptions } from './imageOptimization';

/**
 * Centralized Supabase Storage Bucket Configuration
 * 
 * Add new buckets here with type-safe configuration
 */
export const STORAGE_BUCKETS = {
    GENERATED_IMAGES: {
        name: 'generated-images',
        public: true,
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    },
    PROMPT_COVERS: {
        name: 'prompt-covers',
        public: true,
        maxSize: 2 * 1024 * 1024, // 2MB
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp']
    },
    GENERATED_VIDEOS: {
        name: 'generated-videos',
        public: true,
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
        allowedExtensions: ['.mp4', '.webm', '.mov']
    },
    CUSTOM_REFERENCES: {
        name: 'custom-references',
        public: true,
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    },
    GENERATED_AUDIO: {
        name: 'generated-audio',
        public: true,
        maxSize: 30 * 1024 * 1024, // 30MB for audio files
        allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm'],
        allowedExtensions: ['.mp3', '.wav', '.ogg', '.webm']
    },
    BATCH_RESULTS: {
        name: 'batch-results',
        public: true,
        maxSize: 100 * 1024 * 1024, // 100MB for ZIP files
        allowedTypes: ['application/zip', 'text/csv', 'application/octet-stream'],
        allowedExtensions: ['.zip', '.csv']
    }
} as const satisfies Record<string, BucketConfig>;

/**
 * Get bucket config by name
 */
export function getBucketConfig(bucketName: string): BucketConfig | undefined {
    return Object.values(STORAGE_BUCKETS).find(config => config.name === bucketName);
}

/**
 * Validate file against bucket configuration
 */
export function validateFile(
    file: File | { size: number; type: string; name: string },
    config: BucketConfig
): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > config.maxSize) {
        return {
            valid: false,
            error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(config.maxSize / 1024 / 1024).toFixed(2)}MB)`
        };
    }

    // Check file type
    const fileType = file.type;
    const isTypeAllowed = config.allowedTypes.some((allowedType: string) => {
        if (allowedType.endsWith('/*')) {
            const category = allowedType.split('/')[0];
            return fileType.startsWith(category + '/');
        }
        return fileType === allowedType;
    });

    if (!isTypeAllowed) {
        return {
            valid: false,
            error: `File type ${fileType} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}`
        };
    }

    // Check file extension
    if (config.allowedExtensions) {
        const fileName = file.name;
        const hasValidExtension = config.allowedExtensions.some((ext: string) =>
            fileName.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            return {
                valid: false,
                error: `File extension is not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}`
            };
        }
    }

    return { valid: true };
}

/**
 * Image Optimization Configuration
 *
 * Recommended optimization settings for each bucket
 */
export const IMAGE_OPTIMIZATION_CONFIG: Record<string, ImageOptimizationOptions> = {
    'generated-images': {
        format: 'webp',
        quality: 90,
        effort: 4,
        enableLogging: true
    },
    'prompt-covers': {
        format: 'webp',
        quality: 85,
        effort: 5,
        maxWidth: 1200,
        enableLogging: true
    },
    'custom-references': {
        format: 'webp',
        quality: 90,
        effort: 4,
        maxWidth: 2048,
        enableLogging: true
    }
};

/**
 * Get recommended optimization settings for a bucket
 */
export function getOptimizationConfig(bucketName: string): ImageOptimizationOptions {
    return IMAGE_OPTIMIZATION_CONFIG[bucketName] || {
        format: 'webp',
        quality: 90,
        effort: 4,
        enableLogging: true
    };
}
