import 'server-only';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { findCertificateFontOption, type CertificateFontWeight } from '@/lib/certificate-fonts';

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

  if (!option) {
    return {
      resolvedFontFamily: fontFamily,
      fontFilePath: null,
    };
  }

  const fileName = fontWeight === 'bold' ? (option.boldFile ?? option.regularFile) : option.regularFile;

  if (!fileName) {
    return {
      resolvedFontFamily: option.value,
      fontFilePath: null,
    };
  }

  const fontFilePath = await resolveFontFilePath(fileName);

  return {
    resolvedFontFamily: option.value,
    fontFilePath,
  };
}
