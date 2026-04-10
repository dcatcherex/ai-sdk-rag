'use client';

import { TypeIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_BODY_FONT,
  DEFAULT_HEADING_FONT,
  FONTS,
  useFontPreferences,
  type FontLabel,
} from '@/features/settings/hooks/use-font-preferences';

function FontSelect({
  value,
  defaultFont,
  onChange,
}: {
  value: FontLabel;
  defaultFont: FontLabel;
  onChange: (v: FontLabel) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as FontLabel)}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FONTS.map((font) => (
          <SelectItem key={font.label} value={font.label}>
            {font.label}
            {font.label === defaultFont ? (
              <span className="ml-1.5 text-[10px] text-muted-foreground">(default)</span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AppearanceSection() {
  const { headingFont, bodyFont, updateHeadingFont, updateBodyFont } = useFontPreferences();

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <TypeIcon className="size-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">Typography</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Choose fonts for headings and body text. Changes apply immediately across the app.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Heading font</p>
            <p className="text-xs text-muted-foreground">Used for h1–h6 elements</p>
          </div>
          <FontSelect value={headingFont} defaultFont={DEFAULT_HEADING_FONT} onChange={updateHeadingFont} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Body font</p>
            <p className="text-xs text-muted-foreground">Used for paragraphs and UI text</p>
          </div>
          <FontSelect value={bodyFont} defaultFont={DEFAULT_BODY_FONT} onChange={updateBodyFont} />
        </div>
      </div>
    </section>
  );
}
