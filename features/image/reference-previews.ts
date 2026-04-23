export type ReferencePreviewItem = {
  url: string;
  label: string;
};

function looksLikeLogoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('/brand-assets/') ||
    lower.includes('logo') ||
    lower.endsWith('.svg')
  );
}

export function buildReferencePreviewItems(
  imageUrls: string[] | undefined,
  options?: { lastIsLogo?: boolean },
): ReferencePreviewItem[] {
  if (!imageUrls?.length) return [];

  return imageUrls.map((url, index) => {
    const isLast = index === imageUrls.length - 1;
    const treatAsLogo = Boolean(options?.lastIsLogo && isLast) || looksLikeLogoUrl(url);

    if (treatAsLogo) {
      return { url, label: 'Logo reference' };
    }

    if (imageUrls.length === 1) {
      return { url, label: 'Activity photo' };
    }

    if (index === 0) {
      return { url, label: 'Hero activity photo' };
    }

    if (index === 1 && imageUrls.length === 2) {
      return { url, label: 'Supporting photo' };
    }

    if (index === 1 && imageUrls.length >= 3) {
      return { url, label: 'Secondary activity photo' };
    }

    return { url, label: `Reference image ${index + 1}` };
  });
}
