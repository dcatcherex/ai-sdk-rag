export type CertificateTemplateType = 'certificate' | 'card' | 'tag';

export type PrintSheetPresetKey = 'a4_3x3' | 'a4_2x4' | 'a4_2x5';

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
    },
  },
];

export function getPrintSheetPreset(preset: PrintSheetPresetKey): PrintSheetPreset {
  return PRINT_SHEET_PRESETS.find((option) => option.key === preset) ?? PRINT_SHEET_PRESETS[0]!;
}

export function getDefaultPrintSheetSettings(preset: PrintSheetPresetKey = 'a4_3x3'): PrintSheetSettings {
  const presetOption = getPrintSheetPreset(preset);
  return {
    preset: presetOption.key,
    ...presetOption.settings,
  };
}

export function getDefaultPrintSheetSettingsForTemplateType(templateType: CertificateTemplateType): PrintSheetSettings {
  if (templateType === 'tag') {
    return {
      ...getDefaultPrintSheetSettings('a4_2x5'),
      duplexMode: 'front_back',
      backPageOrder: 'reverse',
    };
  }

  if (templateType === 'card') {
    return {
      ...getDefaultPrintSheetSettings('a4_3x3'),
      duplexMode: 'front_back',
      backPageOrder: 'reverse',
    };
  }

  return getDefaultPrintSheetSettings('a4_3x3');
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

export function normalizePrintSheetSettings(input?: PartialPrintSheetSettings | null): PrintSheetSettings {
  const preset = input?.preset && PRINT_SHEET_PRESETS.some((option) => option.key === input.preset)
    ? input.preset
    : 'a4_3x3';
  const defaults = getDefaultPrintSheetSettings(preset);
  const duplexMode = input?.duplexMode === 'front_back' ? 'front_back' : defaults.duplexMode;
  const backPageOrder = input?.backPageOrder === 'reverse' ? 'reverse' : 'same';

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
  };
}

export function getPrintPresetLabel(preset: PrintSheetPresetKey): string {
  return getPrintSheetPreset(preset).label;
}
