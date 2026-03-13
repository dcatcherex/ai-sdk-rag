export type CertificateTemplateType = 'certificate' | 'card' | 'tag';

export type PrintSheetPresetKey = 'a4_maximize' | 'a4_3x3' | 'a4_2x4' | 'a4_2x5';

export type PrintSheetDuplexMode = 'single_sided' | 'front_back';

export type PrintSheetBackPageOrder = 'same' | 'reverse';

export type PrintSheetSettings = {
  preset: PrintSheetPresetKey;
  pageSize: 'A4';
  columns: number;
  rows: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
  cropMarks: boolean;
  cropMarkLengthMm: number;
  cropMarkOffsetMm: number;
  duplexMode: PrintSheetDuplexMode;
  backPageOrder: PrintSheetBackPageOrder;
  backOffsetXMm: number;
  backOffsetYMm: number;
  backFlipX: boolean;
  backFlipY: boolean;
  noGap: boolean;
  itemWidthMm?: number;
  itemHeightMm?: number;
};

export type PartialPrintSheetSettings = Partial<PrintSheetSettings>;

export type PrintSheetPreset = {
  key: PrintSheetPresetKey;
  label: string;
  settings: Omit<PrintSheetSettings, 'preset'>;
};

export const TEMPLATE_TYPE_OPTIONS: Array<{ value: CertificateTemplateType; label: string }> = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'card', label: 'Card' },
  { value: 'tag', label: 'Tag' },
];

export const PRINT_SHEET_PRESETS: PrintSheetPreset[] = [
  {
    key: 'a4_maximize',
    label: 'A4 Maximize',
    settings: {
      pageSize: 'A4',
      columns: 1,
      rows: 1,
      marginTopMm: 4,
      marginRightMm: 4,
      marginBottomMm: 4,
      marginLeftMm: 4,
      gapXMm: 4,
      gapYMm: 4,
      cropMarks: true,
      cropMarkLengthMm: 2,
      cropMarkOffsetMm: 1,
      duplexMode: 'single_sided',
      backPageOrder: 'same',
      backOffsetXMm: 0,
      backOffsetYMm: 0,
      backFlipX: false,
      backFlipY: false,
      noGap: false,
    },
  },
  {
    key: 'a4_3x3',
    label: 'A4 3×3',
    settings: {
      pageSize: 'A4',
      columns: 3,
      rows: 3,
      marginTopMm: 12,
      marginRightMm: 12,
      marginBottomMm: 12,
      marginLeftMm: 12,
      gapXMm: 4,
      gapYMm: 4,
      cropMarks: false,
      cropMarkLengthMm: 4,
      cropMarkOffsetMm: 2,
      duplexMode: 'single_sided',
      backPageOrder: 'same',
      backOffsetXMm: 0,
      backOffsetYMm: 0,
      backFlipX: false,
      backFlipY: false,
      noGap: false,
    },
  },
  {
    key: 'a4_2x4',
    label: 'A4 2×4',
    settings: {
      pageSize: 'A4',
      columns: 2,
      rows: 4,
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      gapXMm: 5,
      gapYMm: 5,
      cropMarks: false,
      cropMarkLengthMm: 4,
      cropMarkOffsetMm: 2,
      duplexMode: 'single_sided',
      backPageOrder: 'same',
      backOffsetXMm: 0,
      backOffsetYMm: 0,
      backFlipX: false,
      backFlipY: false,
      noGap: false,
    },
  },
  {
    key: 'a4_2x5',
    label: 'A4 2×5',
    settings: {
      pageSize: 'A4',
      columns: 2,
      rows: 5,
      marginTopMm: 8,
      marginRightMm: 10,
      marginBottomMm: 8,
      marginLeftMm: 10,
      gapXMm: 4,
      gapYMm: 4,
      cropMarks: false,
      cropMarkLengthMm: 4,
      cropMarkOffsetMm: 2,
      duplexMode: 'single_sided',
      backPageOrder: 'same',
      backOffsetXMm: 0,
      backOffsetYMm: 0,
      backFlipX: false,
      backFlipY: false,
      noGap: false,
    },
  },
];

export function getPrintSheetPreset(preset: PrintSheetPresetKey): PrintSheetPreset {
  return PRINT_SHEET_PRESETS.find((option) => option.key === preset) ?? PRINT_SHEET_PRESETS[0]!;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const DEFAULT_ESTIMATED_DPI = 300;
const AUTO_LAYOUT_MARGIN_MM = 4;
const AUTO_LAYOUT_GAP_MM = 4;
const AUTO_CROP_MARK_LENGTH_MM = 2;
const AUTO_CROP_MARK_OFFSET_MM = 1;

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeOptionalItemSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? roundToTenth(value)
    : null;
}

export function estimatePhysicalSizeMmFromPixels(widthPx: number, heightPx: number, densityDpi = DEFAULT_ESTIMATED_DPI): {
  widthMm: number;
  heightMm: number;
} {
  const safeDensity = Number.isFinite(densityDpi) && densityDpi > 0 ? densityDpi : DEFAULT_ESTIMATED_DPI;

  return {
    widthMm: roundToTenth((widthPx / safeDensity) * 25.4),
    heightMm: roundToTenth((heightPx / safeDensity) * 25.4),
  };
}

export function getEstimatedTemplateItemSizeMm(widthPx: number, heightPx: number): {
  itemWidthMm: number;
  itemHeightMm: number;
} {
  const { widthMm, heightMm } = estimatePhysicalSizeMmFromPixels(widthPx, heightPx);

  return {
    itemWidthMm: widthMm,
    itemHeightMm: heightMm,
  };
}

function getMaximizePrintSheetSettings(options?: {
  itemWidthMm?: number | null;
  itemHeightMm?: number | null;
  duplexMode?: PrintSheetDuplexMode;
  backPageOrder?: PrintSheetBackPageOrder;
  noGap?: boolean;
}): PrintSheetSettings {
  const itemWidthMm = normalizeOptionalItemSize(options?.itemWidthMm);
  const itemHeightMm = normalizeOptionalItemSize(options?.itemHeightMm);
  const duplexMode = options?.duplexMode ?? 'single_sided';
  const backPageOrder = options?.backPageOrder ?? 'same';
  const noGap = options?.noGap === true;
  const layoutGapMm = noGap ? 0 : AUTO_LAYOUT_GAP_MM;

  if (!itemWidthMm || !itemHeightMm) {
    return {
      preset: 'a4_maximize',
      pageSize: 'A4',
      columns: 3,
      rows: 3,
      marginTopMm: 12,
      marginRightMm: 12,
      marginBottomMm: 12,
      marginLeftMm: 12,
      gapXMm: layoutGapMm,
      gapYMm: layoutGapMm,
      cropMarks: true,
      cropMarkLengthMm: AUTO_CROP_MARK_LENGTH_MM,
      cropMarkOffsetMm: AUTO_CROP_MARK_OFFSET_MM,
      duplexMode,
      backPageOrder,
      backOffsetXMm: 0,
      backOffsetYMm: 0,
      backFlipX: false,
      backFlipY: false,
      noGap,
    };
  }

  const columns = Math.max(1, Math.floor((A4_WIDTH_MM - (AUTO_LAYOUT_MARGIN_MM * 2) + layoutGapMm) / (itemWidthMm + layoutGapMm)));
  const rows = Math.max(1, Math.floor((A4_HEIGHT_MM - (AUTO_LAYOUT_MARGIN_MM * 2) + layoutGapMm) / (itemHeightMm + layoutGapMm)));
  const usedWidth = (columns * itemWidthMm) + ((columns - 1) * layoutGapMm);
  const usedHeight = (rows * itemHeightMm) + ((rows - 1) * layoutGapMm);
  const horizontalSlack = Math.max(0, A4_WIDTH_MM - usedWidth);
  const verticalSlack = Math.max(0, A4_HEIGHT_MM - usedHeight);
  const marginLeftMm = roundToTenth(horizontalSlack / 2);
  const marginRightMm = roundToTenth(horizontalSlack - marginLeftMm);
  const marginTopMm = roundToTenth(verticalSlack / 2);
  const marginBottomMm = roundToTenth(verticalSlack - marginTopMm);

  return {
    preset: 'a4_maximize',
    pageSize: 'A4',
    columns,
    rows,
    marginTopMm,
    marginRightMm,
    marginBottomMm,
    marginLeftMm,
    gapXMm: layoutGapMm,
    gapYMm: layoutGapMm,
    cropMarks: true,
    cropMarkLengthMm: AUTO_CROP_MARK_LENGTH_MM,
    cropMarkOffsetMm: AUTO_CROP_MARK_OFFSET_MM,
    duplexMode,
    backPageOrder,
    backOffsetXMm: 0,
    backOffsetYMm: 0,
    backFlipX: false,
    backFlipY: false,
    noGap,
    itemWidthMm,
    itemHeightMm,
  };
}

export function getDefaultPrintSheetSettings(
  preset: PrintSheetPresetKey = 'a4_3x3',
  options?: {
    itemWidthMm?: number | null;
    itemHeightMm?: number | null;
    duplexMode?: PrintSheetDuplexMode;
    backPageOrder?: PrintSheetBackPageOrder;
    noGap?: boolean;
  },
): PrintSheetSettings {
  if (preset === 'a4_maximize') {
    return getMaximizePrintSheetSettings(options);
  }

  const presetOption = getPrintSheetPreset(preset);
  const noGap = options?.noGap === true;
  return {
    preset: presetOption.key,
    ...presetOption.settings,
    gapXMm: noGap ? 0 : presetOption.settings.gapXMm,
    gapYMm: noGap ? 0 : presetOption.settings.gapYMm,
    noGap,
    itemWidthMm: normalizeOptionalItemSize(options?.itemWidthMm) ?? undefined,
    itemHeightMm: normalizeOptionalItemSize(options?.itemHeightMm) ?? undefined,
  };
}

export function getDefaultPrintSheetSettingsForTemplateType(
  templateType: CertificateTemplateType,
  options?: {
    itemWidthMm?: number | null;
    itemHeightMm?: number | null;
    noGap?: boolean;
  },
): PrintSheetSettings {
  if (templateType === 'tag') {
    return {
      ...getDefaultPrintSheetSettings('a4_maximize', {
        itemWidthMm: options?.itemWidthMm,
        itemHeightMm: options?.itemHeightMm,
        noGap: options?.noGap,
      }),
      duplexMode: 'front_back',
      backPageOrder: 'reverse',
    };
  }

  if (templateType === 'card') {
    return {
      ...getDefaultPrintSheetSettings('a4_maximize', {
        itemWidthMm: options?.itemWidthMm,
        itemHeightMm: options?.itemHeightMm,
        noGap: options?.noGap,
      }),
      duplexMode: 'front_back',
      backPageOrder: 'reverse',
    };
  }

  return getDefaultPrintSheetSettings('a4_3x3', {
    itemWidthMm: options?.itemWidthMm,
    itemHeightMm: options?.itemHeightMm,
    noGap: options?.noGap,
  });
}

function clampNumber(value: number, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeTemplateType(value: string | null | undefined): CertificateTemplateType {
  if (value === 'card' || value === 'tag') {
    return value;
  }

  return 'certificate';
}

export function normalizePrintSheetSettings(
  input?: PartialPrintSheetSettings | null,
  options?: {
    fallbackItemWidthMm?: number | null;
    fallbackItemHeightMm?: number | null;
  },
): PrintSheetSettings {
  const preset = input?.preset && PRINT_SHEET_PRESETS.some((option) => option.key === input.preset)
    ? input.preset
    : 'a4_3x3';
  const backPageOrder = input?.backPageOrder === 'reverse' ? 'reverse' : 'same';
  const noGap = input?.noGap === true;
  const explicitItemWidthMm = normalizeOptionalItemSize(input?.itemWidthMm);
  const explicitItemHeightMm = normalizeOptionalItemSize(input?.itemHeightMm);
  const itemWidthMm = explicitItemWidthMm ?? normalizeOptionalItemSize(options?.fallbackItemWidthMm);
  const itemHeightMm = explicitItemHeightMm ?? normalizeOptionalItemSize(options?.fallbackItemHeightMm);
  const defaults = getDefaultPrintSheetSettings(preset, {
    itemWidthMm,
    itemHeightMm,
    duplexMode: input?.duplexMode === 'front_back' ? 'front_back' : undefined,
    backPageOrder,
    noGap,
  });
  const duplexMode = input?.duplexMode === 'front_back' ? 'front_back' : defaults.duplexMode;

  return {
    preset,
    pageSize: 'A4',
    columns: clampNumber(input?.columns ?? defaults.columns, defaults.columns, 1, 10),
    rows: clampNumber(input?.rows ?? defaults.rows, defaults.rows, 1, 10),
    marginTopMm: clampNumber(input?.marginTopMm ?? defaults.marginTopMm, defaults.marginTopMm, 0, 50),
    marginRightMm: clampNumber(input?.marginRightMm ?? defaults.marginRightMm, defaults.marginRightMm, 0, 50),
    marginBottomMm: clampNumber(input?.marginBottomMm ?? defaults.marginBottomMm, defaults.marginBottomMm, 0, 50),
    marginLeftMm: clampNumber(input?.marginLeftMm ?? defaults.marginLeftMm, defaults.marginLeftMm, 0, 50),
    gapXMm: clampNumber(input?.gapXMm ?? defaults.gapXMm, defaults.gapXMm, 0, 30),
    gapYMm: clampNumber(input?.gapYMm ?? defaults.gapYMm, defaults.gapYMm, 0, 30),
    cropMarks: input?.cropMarks ?? defaults.cropMarks,
    cropMarkLengthMm: clampNumber(input?.cropMarkLengthMm ?? defaults.cropMarkLengthMm, defaults.cropMarkLengthMm, 1, 20),
    cropMarkOffsetMm: clampNumber(input?.cropMarkOffsetMm ?? defaults.cropMarkOffsetMm, defaults.cropMarkOffsetMm, 0, 10),
    duplexMode,
    backPageOrder,
    backOffsetXMm: clampNumber(input?.backOffsetXMm ?? defaults.backOffsetXMm, defaults.backOffsetXMm, -20, 20),
    backOffsetYMm: clampNumber(input?.backOffsetYMm ?? defaults.backOffsetYMm, defaults.backOffsetYMm, -20, 20),
    backFlipX: input?.backFlipX ?? defaults.backFlipX,
    backFlipY: input?.backFlipY ?? defaults.backFlipY,
    noGap,
    itemWidthMm: explicitItemWidthMm ?? undefined,
    itemHeightMm: explicitItemHeightMm ?? undefined,
  };
}

export function getPrintPresetLabel(preset: PrintSheetPresetKey): string {
  return getPrintSheetPreset(preset).label;
}
