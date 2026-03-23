'use client';

import { ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CERTIFICATE_FONT_OPTIONS,
  CERTIFICATE_FONT_WEIGHT_OPTIONS,
  getCertificateFontAvailableWeights,
  getCertificateFontCssWeight,
  getSupportedCertificateFontValue,
  isSupportedCertificateFont,
  resolveCertificateFontWeight,
} from '@/lib/certificate-fonts';
import type { TextFieldConfig } from '../../types';

type FieldRow = TextFieldConfig & { _key: string };

type Props = {
  row: FieldRow;
  rows: FieldRow[];
  isExpanded: boolean;
  onSelect: (key: string) => void;
  onUpdateField: <K extends keyof FieldRow>(key: string, prop: K, value: FieldRow[K]) => void;
  onUpdateFontFamily: (key: string, fontFamily: string) => void;
  onRemove: (key: string) => void;
};

function renderFieldSummary(row: FieldRow) {
  const displayLabel = row.label.trim() || row.id.trim() || 'Untitled field';

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{displayLabel}</span>
        {row.required === true && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            Required
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="font-mono">{row.id || 'no-id'}</span>
        <span>•</span>
        <span>{Math.round(row.xPercent * 10) / 10}%, {Math.round(row.yPercent * 10) / 10}%</span>
        <span>•</span>
        <span>{row.fontSize}px</span>
        <span>•</span>
        <span>{row.align}</span>
      </div>
    </div>
  );
}

export function FieldRowEditor({
  row,
  rows,
  isExpanded,
  onSelect,
  onUpdateField,
  onUpdateFontFamily,
  onRemove,
}: Props) {
  const availableWeights = getCertificateFontAvailableWeights(row.fontFamily);
  const selectedFontWeight = availableWeights.includes(row.fontWeight)
    ? row.fontWeight
    : (availableWeights[0] ?? 'normal');

  const numInput = (
    key: string,
    prop: keyof FieldRow,
    label: string,
    min = 0,
    max = 100,
    step = 1,
  ) => (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(rows.find((r) => r._key === key)?.[prop] ?? 0)}
        onChange={(e) => onUpdateField(key, prop as keyof FieldRow, Number(e.target.value) as FieldRow[typeof prop])}
        className="h-8 text-xs"
      />
    </div>
  );

  return (
    <div
      className={`overflow-hidden rounded-xl border dark:border-border ${isExpanded ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-500/60 dark:bg-indigo-950/20' : 'border-zinc-200 bg-white dark:bg-transparent'}`}
    >
      <button
        type="button"
        onClick={() => onSelect(row._key)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className="min-w-[92px] max-w-[140px] truncate text-lg"
          style={{
            fontFamily: row.fontFamily,
            fontWeight: getCertificateFontCssWeight(selectedFontWeight),
            color: row.color,
          }}
        >
          {row.label || row.id || 'Aa'}
        </div>
        {renderFieldSummary(row)}
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <span className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {row.fontFamily}
          </span>
          <span className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] uppercase text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {selectedFontWeight}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-200/80 p-4 dark:border-zinc-800/80">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Field ID</Label>
              <Input
                value={row.id}
                onChange={(e) => onUpdateField(row._key, 'id', e.target.value)}
                onFocus={() => onSelect(row._key)}
                placeholder="name"
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Label (shown to user)</Label>
              <Input
                value={row.label}
                onChange={(e) => onUpdateField(row._key, 'label', e.target.value)}
                onFocus={() => onSelect(row._key)}
                placeholder="Recipient Name"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <label className="mb-3 flex items-center gap-2 text-xs">
            <Checkbox
              checked={row.required === true}
              onCheckedChange={(checked) => onUpdateField(row._key, 'required', checked === true)}
            />
            <span>Required field</span>
          </label>

          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numInput(row._key, 'xPercent', 'X (%)', 0, 100, 0.5)}
            {numInput(row._key, 'yPercent', 'Y (%)', 0, 100, 0.5)}
            {numInput(row._key, 'maxWidthPercent', 'Max width (%)', 10, 100)}
            {numInput(row._key, 'fontSize', 'Font size (px)', 8, 300)}
            {numInput(row._key, 'minFontSize', 'Min size (px)', 6, 200)}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px]">Align</Label>
              <Select value={row.align} onValueChange={(v) => onUpdateField(row._key, 'align', v as TextFieldConfig['align'])}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Weight</Label>
              <Select value={selectedFontWeight} onValueChange={(v) => onUpdateField(row._key, 'fontWeight', v as TextFieldConfig['fontWeight'])}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CERTIFICATE_FONT_WEIGHT_OPTIONS.filter((option) => availableWeights.includes(option.value)).map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Color</Label>
              <div className="flex gap-1">
                <input
                  type="color"
                  value={row.color}
                  onChange={(e) => onUpdateField(row._key, 'color', e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border"
                />
                <Input
                  value={row.color}
                  onChange={(e) => onUpdateField(row._key, 'color', e.target.value)}
                  className="h-8 flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Font family</Label>
              <Select
                value={getSupportedCertificateFontValue(row.fontFamily)}
                onValueChange={(value) => onUpdateFontFamily(row._key, value)}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  style={{
                    fontFamily: row.fontFamily,
                    fontWeight: getCertificateFontCssWeight(selectedFontWeight),
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {!isSupportedCertificateFont(row.fontFamily) && (
                    <SelectItem value={row.fontFamily}>{row.fontFamily}</SelectItem>
                  )}
                  {CERTIFICATE_FONT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.key}
                      value={option.value}
                      style={{
                        fontFamily: option.value,
                        fontWeight: getCertificateFontCssWeight(resolveCertificateFontWeight(option.value, selectedFontWeight)),
                      }}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onRemove(row._key)}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove field
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
