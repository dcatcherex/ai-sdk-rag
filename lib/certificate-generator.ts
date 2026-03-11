import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getCertificateFontRenderConfig } from '@/lib/certificate-fonts.server';

type SharpTextAlign = 'left' | 'center' | 'right';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right';

export type TextFieldConfig = {
  id: string;
  label: string;
  /** X position as percentage of template width (0–100) */
  xPercent: number;
  /** Y position as percentage of template height (0–100) */
  yPercent: number;
  /** Base (maximum) font size in px */
  fontSize: number;
  /** Minimum font size before text is still forced to fit */
  minFontSize: number;
  /** Max width as percentage of template width (0–100) */
  maxWidthPercent: number;
  fontFamily: string;
  color: string;
  fontWeight: 'normal' | 'bold';
  align: TextAlign;
};

export type CertificateField = {
  fieldId: string;
  value: string;
};

export type GenerateOptions = {
  templateBuffer: Buffer;
  templateWidth: number;
  templateHeight: number;
  fields: TextFieldConfig[];
  values: CertificateField[];
  format: 'png' | 'jpg' | 'pdf';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculate font size that fits text within maxWidth.
 * Uses approximate char width = fontSize * 0.55 for proportional fonts.
 */
function calcFontSize(text: string, maxWidthPx: number, baseFontSize: number, minFontSize: number): number {
  const charWidthRatio = 0.55;
  const textWidthAtBase = text.length * baseFontSize * charWidthRatio;
  if (textWidthAtBase <= maxWidthPx) return baseFontSize;
  const scaled = Math.floor((maxWidthPx / textWidthAtBase) * baseFontSize);
  return Math.max(scaled, minFontSize);
}

function textAnchor(align: TextAlign): SharpTextAlign {
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  return 'left';
}

/**
 * Build SVG overlay with all text fields rendered at correct positions.
 */
async function buildSvgOverlay(
  width: number,
  height: number,
  fields: TextFieldConfig[],
  values: CertificateField[],
) {
  const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));
  const textElements = await Promise.all(fields.map(async (field) => {
    const text = valueMap.get(field.id) ?? '';
    if (!text) return null;

    const xPx = Math.round((field.xPercent / 100) * width);
    const yPx = Math.round((field.yPercent / 100) * height);
    const maxWidthPx = Math.round((field.maxWidthPercent / 100) * width);
    const { resolvedFontFamily, fontFilePath } = await getCertificateFontRenderConfig(field.fontFamily, field.fontWeight);
    const anchor = textAnchor(field.align);

    let currentFontSize = calcFontSize(text, maxWidthPx, field.fontSize, field.minFontSize);
    let overlayBuffer: Buffer | null = null;
    let overlayWidth = 0;
    let overlayHeight = 0;

    while (currentFontSize >= field.minFontSize) {
      const candidateBuffer = await sharp({
        text: {
          text: `<span foreground="${field.color}">${escapeXml(text)}</span>`,
          font: `${resolvedFontFamily} ${currentFontSize}`,
          fontfile: fontFilePath ?? undefined,
          rgba: true,
          dpi: 72,
          align: anchor,
        },
      })
        .png()
        .toBuffer();

      const metadata = await sharp(candidateBuffer).metadata();
      overlayWidth = metadata.width ?? 0;
      overlayHeight = metadata.height ?? 0;
      overlayBuffer = candidateBuffer;

      if (overlayWidth <= maxWidthPx || currentFontSize === field.minFontSize) {
        break;
      }

      currentFontSize -= 1;
    }

    if (!overlayBuffer) {
      return null;
    }

    const left = field.align === 'center'
      ? Math.round(xPx - overlayWidth / 2)
      : field.align === 'right'
        ? Math.round(xPx - overlayWidth)
        : xPx;
    const top = Math.round(yPx - overlayHeight / 2);

    return {
      input: overlayBuffer,
      left: Math.max(0, left),
      top: Math.max(0, top),
    };
  }));

  return textElements.filter((overlay): overlay is { input: Buffer; left: number; top: number } => overlay !== null);
}

// ─── Core generation ──────────────────────────────────────────────────────────

/** Generate a single certificate image as a Buffer */
export async function generateCertificate(options: GenerateOptions): Promise<Buffer> {
  const { templateBuffer, templateWidth, templateHeight, fields, values, format } = options;

  const textOverlays = await buildSvgOverlay(templateWidth, templateHeight, fields, values);

  const pngBuffer = await sharp(templateBuffer)
    .resize(templateWidth, templateHeight, { fit: 'fill' })
    .composite(textOverlays)
    .png()
    .toBuffer();

  if (format === 'pdf') {
    return imageToPdf(pngBuffer, templateWidth, templateHeight);
  }

  if (format === 'jpg') {
    return sharp(pngBuffer).jpeg({ quality: 92 }).toBuffer();
  }

  return pngBuffer;
}

/** Embed a PNG buffer into a PDF page sized to the image */
async function imageToPdf(pngBuffer: Buffer, width: number, height: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);

  // Use pixel dimensions as PDF points (72 dpi default — scale to reasonable size)
  const scale = Math.min(1, 800 / Math.max(width, height));
  const pdfWidth = width * scale;
  const pdfHeight = height * scale;

  const page = pdfDoc.addPage([pdfWidth, pdfHeight]);
  page.drawImage(pngImage, { x: 0, y: 0, width: pdfWidth, height: pdfHeight });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function mergePdfBuffers(pdfBuffers: Buffer[]): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();

  for (const pdfBuffer of pdfBuffers) {
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const bytes = await mergedPdf.save();
  return Buffer.from(bytes);
}

/** Generate thumbnail (320px wide) from template buffer */
export async function generateThumbnail(templateBuffer: Buffer): Promise<Buffer> {
  return sharp(templateBuffer).resize(320, undefined, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
}

/** Get image dimensions from buffer */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? 800, height: meta.height ?? 600 };
}
