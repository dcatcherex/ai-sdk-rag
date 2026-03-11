"use client";

import { useState } from "react";

const FONTS = [
  { label: "Geist", cssVar: "--font-geist-sans" },
  { label: "Inter", cssVar: "--font-inter" },
  { label: "Playfair", cssVar: "--font-playfair" },
  { label: "Noto Thai", cssVar: "--font-noto-sans-thai" },
  { label: "Sarabun", cssVar: "--font-sarabun" },
  { label: "IBM Plex", cssVar: "--font-ibm-plex-sans-thai" },
  { label: "Anuphan", cssVar: "--font-anuphan" },
] as const;

type FontKey = (typeof FONTS)[number]["label"];

function getFontValue(cssVar: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}

function FontPicker({
  label,
  current,
  onSelect,
}: {
  label: string;
  current: FontKey;
  onSelect: (font: (typeof FONTS)[number]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      {open && (
        <div className="flex flex-col gap-1 rounded-xl border bg-white/95 dark:bg-card/95 backdrop-blur shadow-lg p-1 min-w-32">
          {FONTS.map((font) => (
            <button
              key={font.label}
              onClick={() => {
                onSelect(font);
                setOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm text-left transition-colors ${
                font.label === current
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-muted text-zinc-700 dark:text-foreground/80"
              }`}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border bg-white/90 dark:bg-card/90 backdrop-blur shadow px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <span className="text-zinc-400 dark:text-muted-foreground">{label}</span>
        <span className="text-zinc-800 dark:text-foreground">{current}</span>
      </button>
    </div>
  );
}

export default function FontSwitcher() {
  const [bodyFont, setBodyFont] = useState<FontKey>("Geist");
  const [headingFont, setHeadingFont] = useState<FontKey>("Geist");

  function applyBody(font: (typeof FONTS)[number]) {
    const value = getFontValue(font.cssVar);
    document.documentElement.style.setProperty("--font-geist-sans", value);
    setBodyFont(font.label);
  }

  function applyHeading(font: (typeof FONTS)[number]) {
    const value = getFontValue(font.cssVar);
    document.documentElement.style.setProperty("--font-heading", value);
    setHeadingFont(font.label);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5">
      <FontPicker label="H" current={headingFont} onSelect={applyHeading} />
      <FontPicker label="B" current={bodyFont} onSelect={applyBody} />
    </div>
  );
}
