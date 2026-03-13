import 'server-only';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { findCertificateFontOption, resolveCertificateFontWeight, type CertificateFontWeight } from '@/lib/certificate-fonts';

const fontPathCache = new Map<string, Promise<string | null>>();

async function resolveFontFilePath(fileName: string) {
  if (!fontPathCache.has(fileName)) {
    fontPathCache.set(
      fileName,
      (async () => {
        const filePath = path.join(process.cwd(), 'public', 'fonts', 'certificates', fileName);

        try {
          await access(filePath);
          return filePath;
        } catch {
          return null;
        }
      })(),
    );
  }

  return fontPathCache.get(fileName) ?? Promise.resolve(null);
}

export async function getCertificateFontRenderConfig(fontFamily: string, fontWeight: CertificateFontWeight) {
  const option = findCertificateFontOption(fontFamily);
  const resolvedWeight = resolveCertificateFontWeight(fontFamily, fontWeight);

  if (!option) {
    return {
      resolvedFontFamily: fontFamily,
      resolvedWeight,
      fontFilePath: null,
    };
  }

  const fileName = resolvedWeight === 'bold'
    ? (option.boldFile ?? option.mediumFile ?? option.regularFile)
    : resolvedWeight === 'medium'
      ? (option.mediumFile ?? option.regularFile ?? option.boldFile)
      : (option.regularFile ?? option.mediumFile ?? option.boldFile);

  if (!fileName) {
    return {
      resolvedFontFamily: option.value,
      resolvedWeight,
      fontFilePath: null,
    };
  }

  const fontFilePath = await resolveFontFilePath(fileName);

  return {
    resolvedFontFamily: fontFilePath ? option.value : 'Arial',
    resolvedWeight,
    fontFilePath,
  };
}
