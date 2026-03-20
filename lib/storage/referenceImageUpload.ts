import 'server-only';

import { getStorageService, STORAGE_BUCKETS } from './index';
import type { PromptImageSettings, PromptVideoSettings } from '@/types/prompt';

/**
 * Upload base64 reference images in PromptImageSettings to storage,
 * replacing base64 data with public URLs to avoid storing large blobs in the DB.
 *
 * Returns a new imageSettings object with URLs instead of base64 strings.
 * Already-URL images are left untouched.
 */
export async function uploadReferenceImages(
    imageSettings: PromptImageSettings
): Promise<PromptImageSettings> {
    const result = { ...imageSettings };
    const storage = getStorageService();

    const uploadBase64Image = async (imgData: string, index: number): Promise<string> => {
        // Already a URL — keep as-is
        if (imgData.startsWith('http')) return imgData;

        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);

        let contentType = 'image/png';
        if (imgData.startsWith('data:')) {
            const match = imgData.match(/^data:(image\/[a-z]+);base64,/);
            if (match) contentType = match[1];
        }

        const ext = contentType.split('/')[1] || 'png';
        const filename = `references/${timestamp}-${random}-${index}.${ext}`;

        const { publicUrl } = await storage.uploadBase64(
            STORAGE_BUCKETS.GENERATED_IMAGES.name,
            imgData,
            { contentType, filename }
        );

        return publicUrl;
    };

    // Upload styleReferenceImage
    if (result.styleReferenceImage && !result.styleReferenceImage.startsWith('http')) {
        try {
            result.styleReferenceImage = await uploadBase64Image(result.styleReferenceImage, 0);
        } catch (e) {
            console.error('[referenceImageUpload] Failed to upload styleReferenceImage:', e);
            // Keep original base64 as fallback — generation route will re-upload anyway
        }
    }

    // Upload referenceImages array
    if (result.referenceImages && result.referenceImages.length > 0) {
        const uploaded: string[] = [];
        for (let i = 0; i < result.referenceImages.length; i++) {
            try {
                uploaded.push(await uploadBase64Image(result.referenceImages[i], i + 1));
            } catch (e) {
                console.error(`[referenceImageUpload] Failed to upload referenceImage[${i}]:`, e);
                uploaded.push(result.referenceImages[i]); // Keep original as fallback
            }
        }
        result.referenceImages = uploaded;
    }

    return result;
}

/**
 * Upload base64 video reference images in PromptVideoSettings to storage,
 * replacing base64 data with public URLs to avoid storing large blobs in the DB.
 *
 * Returns a new videoSettings object with URLs instead of base64 strings.
 * Already-URL images are left untouched.
 */
export async function uploadVideoReferenceImages(
    videoSettings: PromptVideoSettings
): Promise<PromptVideoSettings> {
    const result = { ...videoSettings };

    if (!result.imageUrls || result.imageUrls.length === 0) return result;

    const storage = getStorageService();
    const uploaded: string[] = [];

    for (let i = 0; i < result.imageUrls.length; i++) {
        const imgData = result.imageUrls[i];

        if (imgData.startsWith('http')) {
            uploaded.push(imgData);
            continue;
        }

        try {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(7);

            let contentType = 'image/png';
            if (imgData.startsWith('data:')) {
                const match = imgData.match(/^data:(image\/[a-z]+);base64,/);
                if (match) contentType = match[1];
            }

            const ext = contentType.split('/')[1] || 'png';
            const filename = `video-refs/${timestamp}-${random}-${i}.${ext}`;

            const { publicUrl } = await storage.uploadBase64(
                STORAGE_BUCKETS.CUSTOM_REFERENCES.name,
                imgData,
                { contentType, filename }
            );

            uploaded.push(publicUrl);
        } catch (e) {
            console.error(`[uploadVideoReferenceImages] Failed to upload imageUrl[${i}]:`, e);
            uploaded.push(imgData); // Keep original as fallback
        }
    }

    result.imageUrls = uploaded;
    return result;
}
