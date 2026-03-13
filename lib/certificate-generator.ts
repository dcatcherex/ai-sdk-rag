import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';
import { getCertificateFontCssWeight, type CertificateFontWeight } from '@/lib/certificate-fonts';
import { getCertificateFontRenderConfig } from '@/lib/certificate-fonts.server';
import type { PrintSheetSettings } from '@/lib/certificate-print';

type SharpTextAlign = 'left' | 'center' | 'right';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right';

export type TextFieldConfig = {
  id: string;
  label: string;
  required?: boolean;
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
  fontWeight: CertificateFontWeight;
  align: TextAlign;
};

export type CertificateField = {
  fieldId: string;
  value: string;
};

export type CertificatePdfQuality = 'standard' | 'high';

export type GenerateOptions = {
  templateBuffer: Buffer;
  templateWidth: number;
  templateHeight: number;
  fields: TextFieldConfig[];
  values: CertificateField[];
  format: 'png' | 'jpg' | 'pdf';
  pdfQuality?: CertificatePdfQuality;
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

const svgFontFaceCache = new Map<string, Promise<{ css: string; familyName: string }>>();

async function getSvgEmbeddedFontFace(fontFilePath: string) {
  if (!svgFontFaceCache.has(fontFilePath)) {
    svgFontFaceCache.set(
      fontFilePath,
      (async () => {
        const fontBuffer = await readFile(fontFilePath);
        const fontData = fontBuffer.toString('base64');
        const familyName = `CertificateFont_${Buffer.from(fontFilePath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(-24)}`;

        return {
          familyName,
          css: `@font-face { font-family: '${familyName}'; src: url(data:font/ttf;base64,${fontData}) format('truetype'); font-style: normal; }`,
        };
      })(),
    );
  }

  return svgFontFaceCache.get(fontFilePath)!;
}

/**
 * Build SVG overlay with all text fields rendered at correct positions.
 */
async function buildSvgOverlay(
  width: number,
  height: number,
  fields: TextFieldConfig[],
  values: CertificateField[],
  renderScale = 1,
) {
  const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));
  const textElements = await Promise.all(fields.map(async (field) => {
    const text = valueMap.get(field.id) ?? '';
    if (!text) return null;

    const xPx = Math.round((field.xPercent / 100) * width);
    const yPx = Math.round((field.yPercent / 100) * height);
    const maxWidthPx = Math.round((field.maxWidthPercent / 100) * width);
    const { resolvedFontFamily, resolvedWeight, fontFilePath } = await getCertificateFontRenderConfig(field.fontFamily, field.fontWeight);
    const anchor = textAnchor(field.align);
    const fontWeight = getCertificateFontCssWeight(resolvedWeight);

    const baseFontSize = Math.max(1, Math.round(field.fontSize * renderScale));
    const minFontSize = Math.max(1, Math.round(field.minFontSize * renderScale));
    const currentFontSize = calcFontSize(text, maxWidthPx, baseFontSize, minFontSize);
    const textLength = text.length * currentFontSize * 0.55;
    const svgFont = fontFilePath
      ? await getSvgEmbeddedFontFace(fontFilePath)
      : null;
    const fontFamily = svgFont?.familyName ?? resolvedFontFamily;
    const textAnchorValue = anchor === 'center'
      ? 'middle'
      : anchor === 'right'
        ? 'end'
        : 'start';

    return {
      css: svgFont?.css ?? null,
      markup: `<text x="${xPx}" y="${yPx}" fill="${field.color}" font-family="${escapeXml(fontFamily)}" font-size="${currentFontSize}" font-weight="${fontWeight}" text-anchor="${textAnchorValue}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs"${textLength > maxWidthPx ? ` textLength="${maxWidthPx}"` : ''}>${escapeXml(text)}</text>`,
    };
  }));

  const overlays = textElements.filter((overlay): overlay is { css: string | null; markup: string } => overlay !== null);

  if (overlays.length === 0) {
    return [];
  }

  const fontCss = Array.from(new Set(overlays.map((overlay) => overlay.css).filter((css): css is string => Boolean(css))));
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    fontCss.length > 0
      ? `<defs><style>${fontCss.join(' ')}</style></defs>`
      : '',
    overlays.map((overlay) => overlay.markup).join(''),
    '</svg>',
  ].join('');

  return [
    {
      input: Buffer.from(svg),
      left: 0,
      top: 0,
    }
  ];
}

// ─── Core generation ──────────────────────────────────────────────────────────

/** Generate a single certificate image as a Buffer */
export async function generateCertificate(options: GenerateOptions): Promise<Buffer> {
  const { templateBuffer, templateWidth, templateHeight, fields, values, format, pdfQuality = 'standard' } = options;
  const renderScale = format === 'pdf' && pdfQuality === 'high' ? 2 : 1;
  const renderWidth = templateWidth * renderScale;
  const renderHeight = templateHeight * renderScale;

  const textOverlays = await buildSvgOverlay(renderWidth, renderHeight, fields, values, renderScale);

  const pngBuffer = await sharp(templateBuffer)
    .resize(renderWidth, renderHeight, { fit: 'fill' })
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

function mmToPoints(value: number): number {
  return (value / 25.4) * 72;
}

function drawCropMarks(
  page: import('pdf-lib').PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  settings: PrintSheetSettings,
) {
  if (!settings.cropMarks) {
    return;
  }

  const markLength = mmToPoints(settings.cropMarkLengthMm);
  const offset = mmToPoints(settings.cropMarkOffsetMm);
  const left = x;
  const right = x + width;
  const bottom = y;
  const top = y + height;
  const color = rgb(0.35, 0.35, 0.35);
  const thickness = 0.5;

  page.drawLine({ start: { x: left, y: top + offset }, end: { x: left, y: top + offset + markLength }, thickness, color });
  page.drawLine({ start: { x: left - offset - markLength, y: top }, end: { x: left - offset, y: top }, thickness, color });
  page.drawLine({ start: { x: right, y: top + offset }, end: { x: right, y: top + offset + markLength }, thickness, color });
  page.drawLine({ start: { x: right + offset, y: top }, end: { x: right + offset + markLength, y: top }, thickness, color });
  page.drawLine({ start: { x: left, y: bottom - offset }, end: { x: left, y: bottom - offset - markLength }, thickness, color });
  page.drawLine({ start: { x: left - offset - markLength, y: bottom }, end: { x: left - offset, y: bottom }, thickness, color });
  page.drawLine({ start: { x: right, y: bottom - offset }, end: { x: right, y: bottom - offset - markLength }, thickness, color });
  page.drawLine({ start: { x: right + offset, y: bottom }, end: { x: right + offset + markLength, y: bottom }, thickness, color });
}

function reorderSheetPageImages(
  pageImages: Buffer[],
  backPageOrder: PrintSheetSettings['backPageOrder'],
): Buffer[] {
  if (backPageOrder !== 'reverse') {
    return pageImages;
  }

  return [...pageImages].reverse();
}

async function transformSheetImage(
  imageBuffer: Buffer,
  options?: {
    flipX?: boolean;
    flipY?: boolean;
  },
): Promise<Buffer> {
  if (!options?.flipX && !options?.flipY) {
    return imageBuffer;
  }

  let pipeline = sharp(imageBuffer);

  if (options.flipX) {
    pipeline = pipeline.flop();
  }

  if (options.flipY) {
    pipeline = pipeline.flip();
  }

  return pipeline.toBuffer();
}

async function appendSheetPages(
  pdfDoc: PDFDocument,
  imageBuffers: Buffer[],
  cardWidth: number,
  cardHeight: number,
  settings: PrintSheetSettings,
  options?: {
    backPageOrder?: PrintSheetSettings['backPageOrder'];
    offsetXMm?: number;
    offsetYMm?: number;
    flipX?: boolean;
    flipY?: boolean;
    pdfQuality?: CertificatePdfQuality;
  },
): Promise<void> {
  const pageWidth = mmToPoints(210);
  const pageHeight = mmToPoints(297);
  const columns = settings.columns;
  const rows = settings.rows;
  const marginTop = mmToPoints(settings.marginTopMm);
  const marginRight = mmToPoints(settings.marginRightMm);
  const marginBottom = mmToPoints(settings.marginBottomMm);
  const marginLeft = mmToPoints(settings.marginLeftMm);
  const horizontalGap = mmToPoints(settings.gapXMm);
  const verticalGap = mmToPoints(settings.gapYMm);
  const cellWidth = (pageWidth - marginLeft - marginRight - (horizontalGap * (columns - 1))) / columns;
  const cellHeight = (pageHeight - marginTop - marginBottom - (verticalGap * (rows - 1))) / rows;
  const aspectRatio = cardWidth / cardHeight;
  const cardsPerPage = columns * rows;
  const targetDpi = options?.pdfQuality === 'high' ? 300 : 200;

  for (let pageStart = 0; pageStart < imageBuffers.length; pageStart += cardsPerPage) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const pageImages = reorderSheetPageImages(
      imageBuffers.slice(pageStart, pageStart + cardsPerPage),
      options?.backPageOrder ?? 'same',
    );

    for (let index = 0; index < pageImages.length; index += 1) {
      const imageBuffer = pageImages[index];

      if (!imageBuffer) {
        continue;
      }

      const calibratedImageBuffer = await transformSheetImage(imageBuffer, {
        flipX: options?.flipX,
        flipY: options?.flipY,
      });

      const column = index % columns;
      const row = Math.floor(index / columns);
      const fittedWidth = cellWidth / cellHeight > aspectRatio ? cellHeight * aspectRatio : cellWidth;
      const fittedHeight = fittedWidth / aspectRatio;
      const targetWidthPx = Math.max(1, Math.round((fittedWidth / 72) * targetDpi));
      const targetHeightPx = Math.max(1, Math.round((fittedHeight / 72) * targetDpi));
      const resizedImageBuffer = await sharp(calibratedImageBuffer)
        .resize(targetWidthPx, targetHeightPx, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
      const embeddedImage = await pdfDoc.embedPng(resizedImageBuffer);
      const x = marginLeft
        + (column * (cellWidth + horizontalGap))
        + ((cellWidth - fittedWidth) / 2)
        + mmToPoints(options?.offsetXMm ?? 0);
      const y = pageHeight
        - marginTop
        - ((row + 1) * cellHeight)
        - (row * verticalGap)
        + ((cellHeight - fittedHeight) / 2)
        + mmToPoints(options?.offsetYMm ?? 0);

      page.drawImage(embeddedImage, {
        x,
        y,
        width: fittedWidth,
        height: fittedHeight,
      });

      drawCropMarks(page, x, y, fittedWidth, fittedHeight, settings);
    }
  }
}

export async function createSheetPdf(
  imageBuffers: Buffer[],
  cardWidth: number,
  cardHeight: number,
  settings: PrintSheetSettings,
  pdfQuality: CertificatePdfQuality = 'standard',
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  await appendSheetPages(pdfDoc, imageBuffers, cardWidth, cardHeight, settings, { pdfQuality });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function createDuplexSheetPdf(
  frontImageBuffers: Buffer[],
  backImageBuffers: Buffer[],
  frontCardWidth: number,
  frontCardHeight: number,
  backCardWidth: number,
  backCardHeight: number,
  settings: PrintSheetSettings,
  pdfQuality: CertificatePdfQuality = 'standard',
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  await appendSheetPages(pdfDoc, frontImageBuffers, frontCardWidth, frontCardHeight, settings, { pdfQuality });

  if (backImageBuffers.length > 0) {
    await appendSheetPages(pdfDoc, backImageBuffers, backCardWidth, backCardHeight, settings, {
      backPageOrder: settings.backPageOrder,
      offsetXMm: settings.backOffsetXMm,
      offsetYMm: settings.backOffsetYMm,
      flipX: settings.backFlipX,
      flipY: settings.backFlipY,
      pdfQuality,
    });
  }

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
