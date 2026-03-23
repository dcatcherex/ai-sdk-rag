'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PRINT_SHEET_PRESETS,
  TEMPLATE_TYPE_OPTIONS,
} from '@/lib/certificate-print';
import type { CertificateTemplateType, PrintSheetSettings } from '../../types';

function formatOptionalMillimetersAsCentimeters(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }

  const centimeters = value / 10;
  return Number.isInteger(centimeters) ? String(centimeters) : String(Math.round(centimeters * 10) / 10);
}

type Props = {
  templateType: CertificateTemplateType;
  printSettings: PrintSheetSettings;
  estimatedFrontItemSize: { itemWidthMm: number; itemHeightMm: number };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateTypeChange: (value: string) => void;
  onPresetChange: (value: string) => void;
  onUpdatePrintSetting: <K extends keyof PrintSheetSettings>(key: K, value: PrintSheetSettings[K]) => void;
  onUpdatePhysicalSize: (dimension: 'width' | 'height', value: string) => void;
  onUpdateNoGap: (enabled: boolean) => void;
  formatMm: (value: number | undefined) => string;
};

export function PrintSettingsPanel({
  templateType,
  printSettings,
  estimatedFrontItemSize,
  isOpen,
  onOpenChange,
  onTemplateTypeChange,
  onPresetChange,
  onUpdatePrintSetting,
  onUpdatePhysicalSize,
  onUpdateNoGap,
}: Props) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="rounded-xl border border-zinc-200 p-4 dark:border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Print settings</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Save reusable layout settings for card/tag sheet exports.
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {templateType} • {PRINT_SHEET_PRESETS.find((preset) => preset.key === printSettings.preset)?.label ?? printSettings.preset} • {printSettings.duplexMode === 'front_back' ? 'Front / back' : 'Single-sided'}
          </p>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-mr-2 h-8 gap-1.5 px-2 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
            {isOpen ? 'Hide' : 'Show'}
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="pt-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">Template type</Label>
            <Select value={templateType} onValueChange={onTemplateTypeChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Back X offset (mm)</Label>
            <Input
              type="number"
              min={-20}
              max={20}
              step={0.5}
              value={String(printSettings.backOffsetXMm)}
              onChange={(event) => onUpdatePrintSetting('backOffsetXMm', Number(event.target.value))}
              className="h-8 text-xs"
              disabled={printSettings.duplexMode !== 'front_back'}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Back Y offset (mm)</Label>
            <Input
              type="number"
              min={-20}
              max={20}
              step={0.5}
              value={String(printSettings.backOffsetYMm)}
              onChange={(event) => onUpdatePrintSetting('backOffsetYMm', Number(event.target.value))}
              className="h-8 text-xs"
              disabled={printSettings.duplexMode !== 'front_back'}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Sheet preset</Label>
            <Select value={printSettings.preset} onValueChange={onPresetChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRINT_SHEET_PRESETS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Sheet mode</Label>
            <Select
              value={printSettings.duplexMode}
              onValueChange={(value) => onUpdatePrintSetting('duplexMode', value as PrintSheetSettings['duplexMode'])}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single_sided">Single-sided</SelectItem>
                <SelectItem value="front_back">Front / back</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Back page order</Label>
            <Select
              value={printSettings.backPageOrder}
              onValueChange={(value) => onUpdatePrintSetting('backPageOrder', value as PrintSheetSettings['backPageOrder'])}
              disabled={printSettings.duplexMode !== 'front_back'}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Same order</SelectItem>
                <SelectItem value="reverse">Reverse order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {templateType !== 'certificate' && (
            <>
              <div className="space-y-1">
                <Label className="text-[11px]">Physical width (cm)</Label>
                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={formatOptionalMillimetersAsCentimeters(printSettings.itemWidthMm)}
                  onChange={(event) => onUpdatePhysicalSize('width', event.target.value)}
                  placeholder={formatOptionalMillimetersAsCentimeters(estimatedFrontItemSize.itemWidthMm)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Physical height (cm)</Label>
                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={formatOptionalMillimetersAsCentimeters(printSettings.itemHeightMm)}
                  onChange={(event) => onUpdatePhysicalSize('height', event.target.value)}
                  placeholder={formatOptionalMillimetersAsCentimeters(estimatedFrontItemSize.itemHeightMm)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {(templateType === 'card' || templateType === 'tag') && (
            <div className="space-y-1">
              <Label className="text-[11px]">Cut-board layout</Label>
              <label className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs dark:border-border">
                <Checkbox
                  checked={printSettings.noGap}
                  onCheckedChange={(checked) => onUpdateNoGap(checked === true)}
                />
                <span>No gap between items</span>
              </label>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[11px]">Columns</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={1}
              value={String(printSettings.columns)}
              onChange={(event) => onUpdatePrintSetting('columns', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Rows</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={1}
              value={String(printSettings.rows)}
              onChange={(event) => onUpdatePrintSetting('rows', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Top margin (mm)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={String(printSettings.marginTopMm)}
              onChange={(event) => onUpdatePrintSetting('marginTopMm', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Right margin (mm)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={String(printSettings.marginRightMm)}
              onChange={(event) => onUpdatePrintSetting('marginRightMm', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Bottom margin (mm)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={String(printSettings.marginBottomMm)}
              onChange={(event) => onUpdatePrintSetting('marginBottomMm', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Left margin (mm)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={String(printSettings.marginLeftMm)}
              onChange={(event) => onUpdatePrintSetting('marginLeftMm', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Horizontal gap (mm)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={String(printSettings.gapXMm)}
              onChange={(event) => onUpdatePrintSetting('gapXMm', Number(event.target.value))}
              className="h-8 text-xs"
              disabled={printSettings.noGap}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Vertical gap (mm)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={String(printSettings.gapYMm)}
              onChange={(event) => onUpdatePrintSetting('gapYMm', Number(event.target.value))}
              className="h-8 text-xs"
              disabled={printSettings.noGap}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Crop mark length (mm)</Label>
            <Input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={String(printSettings.cropMarkLengthMm)}
              onChange={(event) => onUpdatePrintSetting('cropMarkLengthMm', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Crop mark offset (mm)</Label>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={String(printSettings.cropMarkOffsetMm)}
              onChange={(event) => onUpdatePrintSetting('cropMarkOffsetMm', Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <Checkbox
            checked={printSettings.cropMarks}
            onCheckedChange={(checked) => onUpdatePrintSetting('cropMarks', checked === true)}
          />
          <span>Show crop marks on sheet PDFs</span>
        </label>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={printSettings.backFlipX}
              onCheckedChange={(checked) => onUpdatePrintSetting('backFlipX', checked === true)}
              disabled={printSettings.duplexMode !== 'front_back'}
            />
            <span>Flip back side horizontally</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={printSettings.backFlipY}
              onCheckedChange={(checked) => onUpdatePrintSetting('backFlipY', checked === true)}
              disabled={printSettings.duplexMode !== 'front_back'}
            />
            <span>Flip back side vertically</span>
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
