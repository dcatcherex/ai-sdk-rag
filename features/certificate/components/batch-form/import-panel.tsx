'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { CertificateTemplate } from '../../types';

type Props = {
  pasteValue: string;
  onPasteChange: (value: string) => void;
  onReviewMapping: () => void;
  onClear: () => void;
  rowFields: CertificateTemplate['fields'];
};

export function ImportPanel({ pasteValue, onPasteChange, onReviewMapping, onClear, rowFields }: Props) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Paste from Google Sheets</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Copy rows from Sheets, then paste here. Only non-global fields are imported into the row table.
        </p>
      </div>
      <Textarea
        value={pasteValue}
        onChange={(e) => onPasteChange(e.target.value)}
        placeholder={rowFields.map((field) => field.label || field.id).join('\t')}
        className="min-h-32 text-xs"
        disabled={rowFields.length === 0}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onReviewMapping} disabled={rowFields.length === 0}>
          Review mapping
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Clear pasted text
        </Button>
      </div>
    </div>
  );
}
