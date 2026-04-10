'use client';

import { useCallback, useEffect, useState } from 'react';

const HEADING_KEY = 'vaja_heading_font';
const BODY_KEY = 'vaja_body_font';

export const FONTS = [
  { label: 'Geist', cssVar: '--font-geist-sans' },
  { label: 'Inter', cssVar: '--font-inter' },
  { label: 'Playfair', cssVar: '--font-playfair' },
  { label: 'Noto Thai', cssVar: '--font-noto-sans-thai' },
  { label: 'Sarabun', cssVar: '--font-sarabun' },
  { label: 'IBM Plex', cssVar: '--font-ibm-plex-sans-thai' },
  { label: 'Anuphan', cssVar: '--font-anuphan' },
] as const;

export type FontLabel = (typeof FONTS)[number]['label'];

export const DEFAULT_HEADING_FONT: FontLabel = 'Noto Thai';
export const DEFAULT_BODY_FONT: FontLabel = 'Sarabun';

function getFontValue(cssVar: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}

function applyHeadingFont(label: FontLabel) {
  const font = FONTS.find((f) => f.label === label);
  if (!font) return;
  document.documentElement.style.setProperty('--font-heading', getFontValue(font.cssVar));
}

function applyBodyFont(label: FontLabel) {
  const font = FONTS.find((f) => f.label === label);
  if (!font) return;
  document.documentElement.style.setProperty('--font-geist-sans', getFontValue(font.cssVar));
}

export function useFontPreferences() {
  const [headingFont, setHeadingFont] = useState<FontLabel>(DEFAULT_HEADING_FONT);
  const [bodyFont, setBodyFont] = useState<FontLabel>(DEFAULT_BODY_FONT);

  useEffect(() => {
    const savedHeading = (localStorage.getItem(HEADING_KEY) as FontLabel | null) ?? DEFAULT_HEADING_FONT;
    const savedBody = (localStorage.getItem(BODY_KEY) as FontLabel | null) ?? DEFAULT_BODY_FONT;
    setHeadingFont(savedHeading);
    setBodyFont(savedBody);
    applyHeadingFont(savedHeading);
    applyBodyFont(savedBody);
  }, []);

  const updateHeadingFont = useCallback((label: FontLabel) => {
    setHeadingFont(label);
    localStorage.setItem(HEADING_KEY, label);
    applyHeadingFont(label);
  }, []);

  const updateBodyFont = useCallback((label: FontLabel) => {
    setBodyFont(label);
    localStorage.setItem(BODY_KEY, label);
    applyBodyFont(label);
  }, []);

  return { headingFont, bodyFont, updateHeadingFont, updateBodyFont };
}
