import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

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

function textAnchor(align: TextAlign): string {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
}

/**
 * Build SVG overlay with all text fields rendered at correct positions.
 */
function buildSvgOverlay(
  width: number,
  height: number,
  fields: TextFieldConfig[],
  values: CertificateField[],
): string {
  const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));

  const textElements = fields.map((field) => {
    const text = valueMap.get(field.id) ?? '';
    if (!text) return '';

    const xPx = Math.round((field.xPercent / 100) * width);
    const yPx = Math.round((field.yPercent / 100) * height);
    const maxWidthPx = Math.round((field.maxWidthPercent / 100) * width);
    const fontSize = calcFontSize(text, maxWidthPx, field.fontSize, field.minFontSize);
    const anchor = textAnchor(field.align);

    return `<text
      x="${xPx}"
      y="${yPx}"
      font-size="${fontSize}"
      font-family="${escapeXml(field.fontFamily)}"
      font-weight="${field.fontWeight}"
      fill="${escapeXml(field.color)}"
      text-anchor="${anchor}"
      dominant-baseline="middle"
    >${escapeXml(text)}</text>`;
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
${textElements.join('\n')}
</svg>`;
}

// ─── Core generation ──────────────────────────────────────────────────────────

/** Generate a single certificate image as a Buffer */
export async function generateCertificate(options: GenerateOptions): Promise<Buffer> {
  const { templateBuffer, templateWidth, templateHeight, fields, values, format } = options;

  const svg = buildSvgOverlay(templateWidth, templateHeight, fields, values);
  const svgBuffer = Buffer.from(svg);

  const pngBuffer = await sharp(templateBuffer)
    .resize(templateWidth, templateHeight, { fit: 'fill' })
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
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

/** Generate thumbnail (320px wide) from template buffer */
export async function generateThumbnail(templateBuffer: Buffer): Promise<Buffer> {
  return sharp(templateBuffer).resize(320, undefined, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
}

/** Get image dimensions from buffer */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? 800, height: meta.height ?? 600 };
}
