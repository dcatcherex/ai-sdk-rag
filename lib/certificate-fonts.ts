export type CertificateFontWeight = 'normal' | 'bold';

export type CertificateFontOption = {
  key: string;
  label: string;
  value: string;
  regularFile?: string;
  boldFile?: string;
};

export const CERTIFICATE_FONT_OPTIONS: CertificateFontOption[] = [
  {
    key: 'arial',
    label: 'Arial',
    value: 'Arial',
  },
  {
    key: 'inter',
    label: 'Inter',
    value: 'Inter',
    regularFile: 'Inter_18pt-Regular.ttf',
    boldFile: 'Inter_18pt-Bold.ttf',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    value: 'Roboto',
    regularFile: 'Roboto-Regular.ttf',
    boldFile: 'Roboto-Bold.ttf',
  },
  {
    key: 'montserrat',
    label: 'Montserrat',
    value: 'Montserrat',
    regularFile: 'Montserrat-Regular.ttf',
    boldFile: 'Montserrat-Bold.ttf',
  },
  {
    key: 'sarabun',
    label: 'Sarabun',
    value: 'Sarabun',
    regularFile: 'Sarabun-Regular.ttf',
    boldFile: 'Sarabun-Bold.ttf',
  },
  {
    key: 'ibm-plex-sans-thai',
    label: 'IBM Plex Sans Thai',
    value: 'IBM Plex Sans Thai',
    regularFile: 'IBMPlexSansThai-Regular.ttf',
    boldFile: 'IBMPlexSansThai-Bold.ttf',
  },
  {
    key: 'noto-sans-thai',
    label: 'Noto Sans Thai',
    value: 'Noto Sans Thai',
    regularFile: 'NotoSansThai-Regular.ttf',
    boldFile: 'NotoSansThai-Bold.ttf',
  },
];

function normalizeFontFamily(value: string) {
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
}

export function findCertificateFontOption(fontFamily: string) {
  const normalized = normalizeFontFamily(fontFamily);

  if (!normalized) {
    return null;
  }

  if (normalized === 'arial' || normalized === 'sans-serif') {
    return CERTIFICATE_FONT_OPTIONS[0] ?? null;
  }

  return CERTIFICATE_FONT_OPTIONS.find((option) => option.key === normalized || normalizeFontFamily(option.value) === normalized) ?? null;
}

export function isSupportedCertificateFont(fontFamily: string) {
  return findCertificateFontOption(fontFamily) !== null;
}

export function getSupportedCertificateFontValue(fontFamily: string) {
  return findCertificateFontOption(fontFamily)?.value ?? fontFamily;
}
