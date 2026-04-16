import type { FileUIPart } from 'ai';

export function shouldConvertAttachmentUrl(
  url: string | undefined,
  mediaType: string | undefined,
): boolean {
  if (!url || !mediaType) {
    return false;
  }

  if (url.startsWith('blob:')) {
    return true;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith('oaiusercontent.com') || hostname.endsWith('oausercontent.com');
  } catch {
    return false;
  }
}

export async function prepareAttachmentFilesForSubmit(
  files: FileUIPart[],
  convertUrlToDataUrl: (url: string) => Promise<string | null>,
): Promise<FileUIPart[]> {
  return Promise.all(
    files.map(async (item) => {
      if (!shouldConvertAttachmentUrl(item.url, item.mediaType)) {
        return item;
      }

      const dataUrl = await convertUrlToDataUrl(item.url);
      return {
        ...item,
        url: dataUrl ?? item.url,
      };
    }),
  );
}
