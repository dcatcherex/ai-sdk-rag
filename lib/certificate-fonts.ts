export type CertificateFontWeight = 'normal' | 'medium' | 'bold';

export type CertificateFontOption = {
  key: string;
  label: string;
  value: string;
  regularFile?: string;
  mediumFile?: string;
  boldFile?: string;
};

export const CERTIFICATE_FONT_WEIGHT_OPTIONS: Array<{
  value: CertificateFontWeight;
  label: string;
}> = [
  { value: 'normal', label: 'Regular' },
  { value: 'medium', label: 'Medium' },
  { value: 'bold', label: 'Bold' },
];

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
    mediumFile: 'Inter_18pt-Medium.ttf',
    boldFile: 'Inter_18pt-Bold.ttf',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    value: 'Roboto',
    regularFile: 'Roboto-Regular.ttf',
    mediumFile: 'Roboto-Medium.ttf',
    boldFile: 'Roboto-Bold.ttf',
  },
  {
    key: 'montserrat',
    label: 'Montserrat',
    value: 'Montserrat',
    regularFile: 'Montserrat-Regular.ttf',
    mediumFile: 'Montserrat-Medium.ttf',
    boldFile: 'Montserrat-Bold.ttf',
  },
  {
    key: 'sarabun',
    label: 'Sarabun',
    value: 'Sarabun',
    regularFile: 'Sarabun-Regular.ttf',
    mediumFile: 'Sarabun-Medium.ttf',
    boldFile: 'Sarabun-Bold.ttf',
  },
  {
    key: 'ibm-plex-sans-thai',
    label: 'IBM Plex Sans Thai',
    value: 'IBM Plex Sans Thai',
    regularFile: 'IBMPlexSansThai-Regular.ttf',
    mediumFile: 'IBMPlexSansThai-Medium.ttf',
    boldFile: 'IBMPlexSansThai-Bold.ttf',
  },
  {
    key: 'noto-sans-thai',
    label: 'Noto Sans Thai',
    value: 'Noto Sans Thai',
    regularFile: 'NotoSansThai-Regular.ttf',
    mediumFile: 'NotoSansThai-Medium.ttf',
    boldFile: 'NotoSansThai-Bold.ttf',
  },
  {
    key: 'athiti',
    label: 'Athiti',
    value: 'Athiti',
    regularFile: 'Athiti-Regular.ttf',
    mediumFile: 'Athiti-Medium.ttf',
    boldFile: 'Athiti-Bold.ttf',
  },
  {
    key: 'caladea',
    label: 'Caladea',
    value: 'Caladea',
    regularFile: 'Caladea-Regular.ttf',
    boldFile: 'Caladea-Bold.ttf',
  },
  {
    key: 'charmonman',
    label: 'Charmonman',
    value: 'Charmonman',
    regularFile: 'Charmonman-Regular.ttf',
    boldFile: 'Charmonman-Bold.ttf',
  },
  {
    key: 'eb-garamond',
    label: 'EB Garamond',
    value: 'EB Garamond',
    regularFile: 'EBGaramond-Regular.ttf',
    mediumFile: 'EBGaramond-Medium.ttf',
    boldFile: 'EBGaramond-Bold.ttf',
  },
  {
    key: 'google-sans',
    label: 'Google Sans',
    value: 'Google Sans',
    regularFile: 'GoogleSans-Regular.ttf',
    mediumFile: 'GoogleSans-Medium.ttf',
    boldFile: 'GoogleSans-Bold.ttf',
  },
  {
    key: 'kanit',
    label: 'Kanit',
    value: 'Kanit',
    regularFile: 'Kanit-Regular.ttf',
    mediumFile: 'Kanit-Medium.ttf',
    boldFile: 'Kanit-Bold.ttf',
  },
  {
    key: 'krub',
    label: 'Krub',
    value: 'Krub',
    regularFile: 'Krub-Regular.ttf',
    mediumFile: 'Krub-Medium.ttf',
    boldFile: 'Krub-Bold.ttf',
  },
  {
    key: 'mali',
    label: 'Mali',
    value: 'Mali',
    regularFile: 'Mali-Regular.ttf',
    mediumFile: 'Mali-Medium.ttf',
    boldFile: 'Mali-Bold.ttf',
  },
  {
    key: 'mitr',
    label: 'Mitr',
    value: 'Mitr',
    regularFile: 'Mitr-Regular.ttf',
    mediumFile: 'Mitr-Medium.ttf',
    boldFile: 'Mitr-Bold.ttf',
  },
  {
    key: 'niramit',
    label: 'Niramit',
    value: 'Niramit',
    regularFile: 'Niramit-Regular.ttf',
    mediumFile: 'Niramit-Medium.ttf',
    boldFile: 'Niramit-Bold.ttf',
  },
  {
    key: 'noto-serif-thai',
    label: 'Noto Serif Thai',
    value: 'Noto Serif Thai',
    regularFile: 'NotoSerifThai-Regular.ttf',
    mediumFile: 'NotoSerifThai-Medium.ttf',
    boldFile: 'NotoSerifThai-Bold.ttf',
  },
  {
    key: 'nunito',
    label: 'Nunito',
    value: 'Nunito',
    regularFile: 'Nunito-Regular.ttf',
    mediumFile: 'Nunito-Medium.ttf',
    boldFile: 'Nunito-Bold.ttf',
  },
  {
    key: 'oswald',
    label: 'Oswald',
    value: 'Oswald',
    regularFile: 'Oswald-Regular.ttf',
    mediumFile: 'Oswald-Medium.ttf',
    boldFile: 'Oswald-Bold.ttf',
  },
  {
    key: 'pattaya',
    label: 'Pattaya',
    value: 'Pattaya',
    regularFile: 'Pattaya-Regular.ttf',
  },
  {
    key: 'playfair-display',
    label: 'Playfair Display',
    value: 'Playfair Display',
    regularFile: 'PlayfairDisplay-Regular.ttf',
    mediumFile: 'PlayfairDisplay-Medium.ttf',
    boldFile: 'PlayfairDisplay-Bold.ttf',
  },
  {
    key: 'playpen-sans-thai',
    label: 'Playpen Sans Thai',
    value: 'Playpen Sans Thai',
    regularFile: 'PlaypenSansThai-Regular.ttf',
    mediumFile: 'PlaypenSansThai-Medium.ttf',
    boldFile: 'PlaypenSansThai-Bold.ttf',
  },
  {
    key: 'prompt',
    label: 'Prompt',
    value: 'Prompt',
    regularFile: 'Prompt-Regular.ttf',
    mediumFile: 'Prompt-Medium.ttf',
    boldFile: 'Prompt-Bold.ttf',
  },
  {
    key: 'srisakdi',
    label: 'Srisakdi',
    value: 'Srisakdi',
    regularFile: 'Srisakdi-Regular.ttf',
    boldFile: 'Srisakdi-Bold.ttf',
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

export function getCertificateFontAvailableWeights(fontFamily: string): CertificateFontWeight[] {
  const option = findCertificateFontOption(fontFamily);

  if (!option) {
    return CERTIFICATE_FONT_WEIGHT_OPTIONS.map(({ value }) => value);
  }

  if (!option.regularFile && !option.mediumFile && !option.boldFile) {
    return CERTIFICATE_FONT_WEIGHT_OPTIONS.map(({ value }) => value);
  }

  const availableWeights: CertificateFontWeight[] = [];

  if (option.regularFile) {
    availableWeights.push('normal');
  }

  if (option.mediumFile) {
    availableWeights.push('medium');
  }

  if (option.boldFile) {
    availableWeights.push('bold');
  }

  return availableWeights.length > 0 ? availableWeights : ['normal'];
}

export function resolveCertificateFontWeight(fontFamily: string, fontWeight: CertificateFontWeight): CertificateFontWeight {
  const availableWeights = getCertificateFontAvailableWeights(fontFamily);

  if (availableWeights.includes(fontWeight)) {
    return fontWeight;
  }

  const fallbackOrder: Record<CertificateFontWeight, CertificateFontWeight[]> = {
    normal: ['medium', 'bold'],
    medium: ['normal', 'bold'],
    bold: ['medium', 'normal'],
  };

  for (const fallbackWeight of fallbackOrder[fontWeight]) {
    if (availableWeights.includes(fallbackWeight)) {
      return fallbackWeight;
    }
  }

  return availableWeights[0] ?? 'normal';
}

export function getCertificateFontCssWeight(fontWeight: CertificateFontWeight) {
  if (fontWeight === 'medium') {
    return 500;
  }

  if (fontWeight === 'bold') {
    return 700;
  }

  return 400;
}
