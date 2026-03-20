import 'server-only';
import { nanoid } from 'nanoid';
import { uploadPublicObject } from '@/lib/r2';
import { safeFetch } from '@/lib/security/ssrfProtection';

export { STORAGE_BUCKETS } from './config';

class StorageService {
    /**
     * Download a file from a URL and upload it to R2.
     * Used for persisting temporary KIE-generated URLs to permanent storage.
     */
    async uploadFromUrl(
        bucketName: string,
        sourceUrl: string,
        options: { fetchTimeout?: number } = {},
    ): Promise<{ publicUrl: string }> {
        const response = await safeFetch(sourceUrl);
        if (!response.ok) throw new Error(`Failed to fetch from URL: ${response.status}`);

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
        const key = `${bucketName}/gen-${Date.now()}-${nanoid(7)}.${ext}`;

        const { url } = await uploadPublicObject({ key, body: buffer, contentType });
        return { publicUrl: url };
    }

    /**
     * Upload a Buffer directly to R2.
     */
    async uploadBuffer(
        bucketName: string,
        buffer: Buffer,
        options: { filename: string; contentType: string },
    ): Promise<{ publicUrl: string }> {
        const key = `${bucketName}/${options.filename}`;
        const { url } = await uploadPublicObject({ key, body: buffer, contentType: options.contentType });
        return { publicUrl: url };
    }

    /**
     * Upload a base64-encoded string to R2.
     * Strips the data URL prefix if present.
     */
    async uploadBase64(
        bucketName: string,
        base64Data: string,
        options: { contentType: string; filename: string },
    ): Promise<{ publicUrl: string }> {
        const data = base64Data.startsWith('data:')
            ? base64Data.split(',')[1] ?? base64Data
            : base64Data;

        const buffer = Buffer.from(data, 'base64');
        const key = `${bucketName}/${options.filename}`;
        const { url } = await uploadPublicObject({ key, body: buffer, contentType: options.contentType });
        return { publicUrl: url };
    }
}

let instance: StorageService | null = null;

export function getStorageService(): StorageService {
    if (!instance) {
        instance = new StorageService();
    }
    return instance;
}
