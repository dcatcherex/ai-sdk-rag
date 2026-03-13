'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ImageUp, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { nanoid } from 'nanoid';
import {
  CERTIFICATE_FONT_OPTIONS,
  CERTIFICATE_FONT_WEIGHT_OPTIONS,
  getCertificateFontAvailableWeights,
  getCertificateFontCssWeight,
  getSupportedCertificateFontValue,
  isSupportedCertificateFont,
  resolveCertificateFontWeight,
} from '@/lib/certificate-fonts';
import {
  getDefaultPrintSheetSettings,
  getDefaultPrintSheetSettingsForTemplateType,
  getEstimatedTemplateItemSizeMm,
  PRINT_SHEET_PRESETS,
  TEMPLATE_TYPE_OPTIONS,
} from '@/lib/certificate-print';
import { useReplaceTemplateImage, useUpdateTemplate } from '../hooks/use-templates';
import type { CertificateTemplate, CertificateTemplateType, PrintSheetSettings, TextFieldConfig } from '../types';
import { DEFAULT_FIELD } from '../types';
import { TemplateFieldEditor } from './template-field-editor';

type Props = {
  template: CertificateTemplate;
  onSaved: (template: CertificateTemplate) => void;
  onTemplateUpdated: (template: CertificateTemplate) => void;
  onCancel: () => void;
};

type FieldRow = TextFieldConfig & { _key: string };
type TemplateSide = 'front' | 'back';

function parseOptionalCentimeters(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 10 : undefined;
}

function formatOptionalMillimetersAsCentimeters(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }

  const centimeters = value / 10;
  return Number.isInteger(centimeters) ? String(centimeters) : String(Math.round(centimeters * 10) / 10);
}

function toRows(fields: TextFieldConfig[]): FieldRow[] {
  return fields.map((field) => ({
    ...field,
    fontWeight: resolveCertificateFontWeight(field.fontFamily, field.fontWeight),
    _key: field.id,
  }));
}

export function FieldConfigurator({ template, onSaved, onTemplateUpdated, onCancel }: Props) {
  const [activeSide, setActiveSide] = useState<TemplateSide>('front');
  const [frontRows, setFrontRows] = useState<FieldRow[]>(() => toRows(template.fields));
  const [backRows, setBackRows] = useState<FieldRow[]>(() => toRows(template.backFields));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => template.fields[0]?.id ?? null);
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState(false);
  const [isReplaceDragActive, setIsReplaceDragActive] = useState(false);
  const [templateType, setTemplateType] = useState<CertificateTemplateType>(template.templateType);
  const [printSettings, setPrintSettings] = useState<PrintSheetSettings>(template.printSettings);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateTemplate();
  const replaceImageMutation = useReplaceTemplateImage();

  useEffect(() => {
    const nextFrontRows = toRows(template.fields);
    const nextBackRows = toRows(template.backFields);
    const nextFrontSerialized = JSON.stringify(template.fields);
    const nextBackSerialized = JSON.stringify(template.backFields);

    setFrontRows((prev) => {
      const currentSerialized = JSON.stringify(prev.map(({ _key: _ignored, ...rest }) => rest));
      return currentSerialized === nextFrontSerialized ? prev : nextFrontRows;
    });

    setBackRows((prev) => {
      const currentSerialized = JSON.stringify(prev.map(({ _key: _ignored, ...rest }) => rest));
      return currentSerialized === nextBackSerialized ? prev : nextBackRows;
    });
  }, [template.backFields, template.fields]);

  useEffect(() => {
    setTemplateType(template.templateType);
    setPrintSettings(template.printSettings);
  }, [template.printSettings, template.templateType]);

  useEffect(() => {
    const rows = activeSide === 'front' ? frontRows : backRows;

    if (rows.length === 0) {
      if (selectedKey !== null) {
        setSelectedKey(null);
      }
      return;
    }

    if (!selectedKey || !rows.some((row) => row._key === selectedKey)) {
      setSelectedKey(rows[0]._key);
    }
  }, [activeSide, backRows, frontRows, selectedKey]);

  useEffect(() => {
    if (activeSide === 'back' && !template.backR2Key && templateType === 'certificate') {
      setActiveSide('front');
    }
  }, [activeSide, template.backR2Key, templateType]);

  useEffect(() => {
    function preventWindowDrop(event: DragEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const dropZone = document.querySelector('[data-certificate-image-dropzone="true"]');
      if (dropZone instanceof Node && dropZone.contains(target)) {
        event.preventDefault();
      }
    }

    window.addEventListener('dragover', preventWindowDrop);
    window.addEventListener('drop', preventWindowDrop);

    return () => {
      window.removeEventListener('dragover', preventWindowDrop);
      window.removeEventListener('drop', preventWindowDrop);
    };
  }, []);

  const rows = activeSide === 'front' ? frontRows : backRows;
  const estimatedFrontItemSize = getEstimatedTemplateItemSizeMm(template.width, template.height);
  const canEditBackSide = templateType === 'card' || templateType === 'tag' || template.backR2Key !== null;
  const activeTemplate = activeSide === 'back' && template.backWidth && template.backHeight
    ? {
        ...template,
        width: template.backWidth,
        height: template.backHeight,
      }
    : template;
  const serializedTemplateState = JSON.stringify({
    fields: template.fields,
    backFields: template.backFields,
    templateType: template.templateType,
    printSettings: template.printSettings,
  });
  const serializedDraftState = JSON.stringify({
    fields: frontRows.map(({ _key: _ignored, ...rest }) => rest),
    backFields: backRows.map(({ _key: _ignored, ...rest }) => rest),
    templateType,
    printSettings,
  });
  const isDirty = serializedDraftState !== serializedTemplateState;

  function resetDraftState() {
    setFrontRows(toRows(template.fields));
    setBackRows(toRows(template.backFields));
    setTemplateType(template.templateType);
    setPrintSettings(template.printSettings);
    setSelectedKey(template.fields[0]?.id ?? template.backFields[0]?.id ?? null);
    setActiveSide('front');
    setIsPrintSettingsOpen(false);
  }

  function handleCancel() {
    if (isDirty) {
      const shouldDiscard = window.confirm('Discard your unsaved certificate editor changes?');
      if (!shouldDiscard) {
        return;
      }
    }

    resetDraftState();
    onCancel();
  }

  function getDraggedImageFile(dataTransfer: DataTransfer) {
    const file = Array.from(dataTransfer.files).find((candidate) => candidate.type.startsWith('image/'));
    return file ?? null;
  }

  function handleReplaceDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!replaceImageMutation.isPending) {
      setIsReplaceDragActive(true);
    }
  }

  function handleReplaceDragLeave(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();

    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsReplaceDragActive(false);
  }

  function handleReplaceDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsReplaceDragActive(false);

    if (replaceImageMutation.isPending) {
      return;
    }

    const file = getDraggedImageFile(event.dataTransfer);
    if (file) {
      void handleReplaceImage(file);
    }
  }

  function renderFieldSummary(row: FieldRow) {
    const fontWeight = resolveCertificateFontWeight(row.fontFamily, row.fontWeight);
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

  function addField() {
    const id = nanoid(8);
    const nextRow = { ...DEFAULT_FIELD, id, label: 'New Field', _key: id };
    if (activeSide === 'front') {
      setFrontRows((prev) => [...prev, nextRow]);
    } else {
      setBackRows((prev) => [...prev, nextRow]);
    }
    setSelectedKey(id);
  }

  function removeField(key: string) {
    if (activeSide === 'front') {
      setFrontRows((prev) => prev.filter((r) => r._key !== key));
    } else {
      setBackRows((prev) => prev.filter((r) => r._key !== key));
    }
    if (selectedKey === key) {
      setSelectedKey((prevSelected) => {
        if (prevSelected !== key) return prevSelected;
        const nextRow = rows.find((row) => row._key !== key);
        return nextRow?._key ?? null;
      });
    }
  }

  function updateField<K extends keyof FieldRow>(key: string, prop: K, value: FieldRow[K]) {
    if (activeSide === 'front') {
      setFrontRows((prev) => prev.map((r) => (r._key === key ? { ...r, [prop]: value } : r)));
      return;
    }

    setBackRows((prev) => prev.map((r) => (r._key === key ? { ...r, [prop]: value } : r)));
  }

  function updateFontFamily(key: string, fontFamily: string) {
    const availableWeights = getCertificateFontAvailableWeights(fontFamily);

    const syncRowFont = (row: FieldRow) => {
      if (row._key !== key) {
        return row;
      }

      const nextFontWeight = availableWeights.includes(row.fontWeight)
        ? row.fontWeight
        : (availableWeights[0] ?? 'normal');

      return {
        ...row,
        fontFamily,
        fontWeight: nextFontWeight,
      };
    };

    if (activeSide === 'front') {
      setFrontRows((prev) => prev.map(syncRowFont));
      return;
    }

    setBackRows((prev) => prev.map(syncRowFont));
  }

  function updatePrintSetting<K extends keyof PrintSheetSettings>(key: K, value: PrintSheetSettings[K]) {
    setPrintSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleTemplateTypeChange(value: string) {
    const nextType = value as CertificateTemplateType;
    const explicitItemWidthMm = printSettings.itemWidthMm;
    const explicitItemHeightMm = printSettings.itemHeightMm;
    const noGap = printSettings.noGap;
    setTemplateType(nextType);
    setPrintSettings({
      ...getDefaultPrintSheetSettingsForTemplateType(nextType, {
        itemWidthMm: explicitItemWidthMm ?? estimatedFrontItemSize.itemWidthMm,
        itemHeightMm: explicitItemHeightMm ?? estimatedFrontItemSize.itemHeightMm,
        noGap,
      }),
      itemWidthMm: explicitItemWidthMm,
      itemHeightMm: explicitItemHeightMm,
    });
  }

  function handlePresetChange(value: string) {
    const preset = value as PrintSheetSettings['preset'];
    setPrintSettings((prev) => ({
      ...getDefaultPrintSheetSettings(preset, {
        itemWidthMm: prev.itemWidthMm ?? estimatedFrontItemSize.itemWidthMm,
        itemHeightMm: prev.itemHeightMm ?? estimatedFrontItemSize.itemHeightMm,
        duplexMode: prev.duplexMode,
        backPageOrder: prev.backPageOrder,
        noGap: prev.noGap,
      }),
      cropMarks: prev.cropMarks,
      cropMarkLengthMm: prev.cropMarkLengthMm,
      cropMarkOffsetMm: prev.cropMarkOffsetMm,
      duplexMode: prev.duplexMode,
      backPageOrder: prev.backPageOrder,
      backOffsetXMm: prev.backOffsetXMm,
      backOffsetYMm: prev.backOffsetYMm,
      backFlipX: prev.backFlipX,
      backFlipY: prev.backFlipY,
    }));
  }

  function updatePhysicalSize(dimension: 'width' | 'height', value: string) {
    const nextValueMm = parseOptionalCentimeters(value);

    setPrintSettings((prev) => {
      const explicitItemWidthMm = dimension === 'width' ? nextValueMm : prev.itemWidthMm;
      const explicitItemHeightMm = dimension === 'height' ? nextValueMm : prev.itemHeightMm;

      if (prev.preset !== 'a4_maximize') {
        return {
          ...prev,
          itemWidthMm: explicitItemWidthMm,
          itemHeightMm: explicitItemHeightMm,
        };
      }

      return {
        ...getDefaultPrintSheetSettings(prev.preset, {
          itemWidthMm: explicitItemWidthMm ?? estimatedFrontItemSize.itemWidthMm,
          itemHeightMm: explicitItemHeightMm ?? estimatedFrontItemSize.itemHeightMm,
          duplexMode: prev.duplexMode,
          backPageOrder: prev.backPageOrder,
          noGap: prev.noGap,
        }),
        cropMarks: prev.cropMarks,
        cropMarkLengthMm: prev.cropMarkLengthMm,
        cropMarkOffsetMm: prev.cropMarkOffsetMm,
        duplexMode: prev.duplexMode,
        backPageOrder: prev.backPageOrder,
        backOffsetXMm: prev.backOffsetXMm,
        backOffsetYMm: prev.backOffsetYMm,
        backFlipX: prev.backFlipX,
        backFlipY: prev.backFlipY,
        itemWidthMm: explicitItemWidthMm,
        itemHeightMm: explicitItemHeightMm,
      };
    });
  }

  function updateNoGapSetting(enabled: boolean) {
    setPrintSettings((prev) => {
      if (prev.preset === 'a4_maximize') {
        return {
          ...getDefaultPrintSheetSettings(prev.preset, {
            itemWidthMm: prev.itemWidthMm ?? estimatedFrontItemSize.itemWidthMm,
            itemHeightMm: prev.itemHeightMm ?? estimatedFrontItemSize.itemHeightMm,
            duplexMode: prev.duplexMode,
            backPageOrder: prev.backPageOrder,
            noGap: enabled,
          }),
          cropMarks: prev.cropMarks,
          cropMarkLengthMm: prev.cropMarkLengthMm,
          cropMarkOffsetMm: prev.cropMarkOffsetMm,
          duplexMode: prev.duplexMode,
          backPageOrder: prev.backPageOrder,
          backOffsetXMm: prev.backOffsetXMm,
          backOffsetYMm: prev.backOffsetYMm,
          backFlipX: prev.backFlipX,
          backFlipY: prev.backFlipY,
          itemWidthMm: prev.itemWidthMm,
          itemHeightMm: prev.itemHeightMm,
        };
      }

      if (enabled) {
        return {
          ...prev,
          noGap: true,
          gapXMm: 0,
          gapYMm: 0,
        };
      }

      const presetDefaults = getDefaultPrintSheetSettings(prev.preset, {
        itemWidthMm: prev.itemWidthMm ?? estimatedFrontItemSize.itemWidthMm,
        itemHeightMm: prev.itemHeightMm ?? estimatedFrontItemSize.itemHeightMm,
        duplexMode: prev.duplexMode,
        backPageOrder: prev.backPageOrder,
        noGap: false,
      });

      return {
        ...prev,
        noGap: false,
        gapXMm: presetDefaults.gapXMm,
        gapYMm: presetDefaults.gapYMm,
      };
    });
  }

  async function handleSave() {
    const fields: TextFieldConfig[] = frontRows.map(({ _key: _, ...rest }) => rest);
    const backFields: TextFieldConfig[] = backRows.map(({ _key: _, ...rest }) => rest);
    const updated = await updateMutation.mutateAsync({
      id: template.id,
      fields,
      backFields,
      templateType,
      printSettings,
    });
    onSaved(updated);
  }

  async function handleReplaceImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const updated = await replaceImageMutation.mutateAsync({ id: template.id, formData, side: activeSide });
    onTemplateUpdated(updated);
  }

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
        onChange={(e) => updateField(key, prop as keyof FieldRow, Number(e.target.value) as FieldRow[typeof prop])}
        className="h-8 text-xs"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Configure Fields</h3>
          <p className="text-xs text-zinc-400">
            Positions are % of template dimensions. Template: {activeTemplate.width}×{activeTemplate.height}px
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            {isDirty ? 'Cancel' : 'Back'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => replaceImageInputRef.current?.click()}
            disabled={replaceImageMutation.isPending}
            className={isReplaceDragActive ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300' : ''}
          >
            {isReplaceDragActive ? <Upload className="mr-1 h-3.5 w-3.5" /> : <ImageUp className="mr-1 h-3.5 w-3.5" />}
            {replaceImageMutation.isPending ? 'Replacing…' : isReplaceDragActive ? `Drop ${activeSide} image` : `Replace ${activeSide} image`}
          </Button>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add field
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || !isDirty}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div
        data-certificate-image-dropzone="true"
        onDragOver={handleReplaceDragOver}
        onDragLeave={handleReplaceDragLeave}
        onDrop={handleReplaceDrop}
        onClick={() => replaceImageInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border border-dashed px-4 py-3 text-xs transition-colors ${isReplaceDragActive ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-zinc-200 text-zinc-500 dark:border-border dark:text-zinc-400'}`}
      >
        <div className="flex items-center gap-2">
          {isReplaceDragActive ? <Upload className="h-4 w-4" /> : <ImageUp className="h-4 w-4" />}
          <span>
            {isReplaceDragActive
              ? `Drop a PNG, JPG, or WebP to replace the ${activeSide} image`
              : <>Drag and drop a PNG, JPG, or WebP here to replace the <span className="font-medium text-zinc-700 dark:text-zinc-200">{activeSide}</span> image, or click to browse.</>}
          </span>
        </div>
      </div>

      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleReplaceImage(file);
          }
          event.currentTarget.value = '';
        }}
      />

      {canEditBackSide && (
        <Tabs value={activeSide} onValueChange={(value) => setActiveSide(value as TemplateSide)}>
          <TabsList>
            <TabsTrigger value="front">Front</TabsTrigger>
            <TabsTrigger value="back">Back</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-400">
          No fields yet. Add a field (e.g. "name", "date").
        </p>
      )}

      {activeSide === 'back' && !template.backR2Key ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-zinc-500 dark:border-border dark:text-zinc-400">
          Upload a back image first, then place back-side fields on it.
        </div>
      ) : rows.length > 0 && (
        <TemplateFieldEditor
          template={activeTemplate}
          rows={rows}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onUpdateField={updateField}
          imageVariant={activeSide === 'back' ? 'back_thumbnail' : 'thumbnail'}
        />
      )}

      <Collapsible open={isPrintSettingsOpen} onOpenChange={setIsPrintSettingsOpen} className="rounded-xl border border-zinc-200 p-4 dark:border-border">
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
              {isPrintSettingsOpen ? 'Hide' : 'Show'}
              <ChevronDown className={`h-4 w-4 transition-transform ${isPrintSettingsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px]">Template type</Label>
              <Select value={templateType} onValueChange={handleTemplateTypeChange}>
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
                onChange={(event) => updatePrintSetting('backOffsetXMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('backOffsetYMm', Number(event.target.value))}
                className="h-8 text-xs"
                disabled={printSettings.duplexMode !== 'front_back'}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Sheet preset</Label>
              <Select value={printSettings.preset} onValueChange={handlePresetChange}>
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
                onValueChange={(value) => updatePrintSetting('duplexMode', value as PrintSheetSettings['duplexMode'])}
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
                onValueChange={(value) => updatePrintSetting('backPageOrder', value as PrintSheetSettings['backPageOrder'])}
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
                    onChange={(event) => updatePhysicalSize('width', event.target.value)}
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
                    onChange={(event) => updatePhysicalSize('height', event.target.value)}
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
                    onCheckedChange={(checked) => updateNoGapSetting(checked === true)}
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
                onChange={(event) => updatePrintSetting('columns', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('rows', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('marginTopMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('marginRightMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('marginBottomMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('marginLeftMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('gapXMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('gapYMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('cropMarkLengthMm', Number(event.target.value))}
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
                onChange={(event) => updatePrintSetting('cropMarkOffsetMm', Number(event.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <Checkbox
              checked={printSettings.cropMarks}
              onCheckedChange={(checked) => updatePrintSetting('cropMarks', checked === true)}
            />
            <span>Show crop marks on sheet PDFs</span>
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={printSettings.backFlipX}
                onCheckedChange={(checked) => updatePrintSetting('backFlipX', checked === true)}
                disabled={printSettings.duplexMode !== 'front_back'}
              />
              <span>Flip back side horizontally</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={printSettings.backFlipY}
                onCheckedChange={(checked) => updatePrintSetting('backFlipY', checked === true)}
                disabled={printSettings.duplexMode !== 'front_back'}
              />
              <span>Flip back side vertically</span>
            </label>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-3">
        {rows.map((row) => {
          const availableWeights = getCertificateFontAvailableWeights(row.fontFamily);
          const selectedFontWeight = availableWeights.includes(row.fontWeight)
            ? row.fontWeight
            : (availableWeights[0] ?? 'normal');
          const isExpanded = selectedKey === row._key;

          return (
            <div
              key={row._key}
              className={`overflow-hidden rounded-xl border dark:border-border ${isExpanded ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-500/60 dark:bg-indigo-950/20' : 'border-zinc-200 bg-white dark:bg-transparent'}`}
            >
              <button
                type="button"
                onClick={() => setSelectedKey(row._key)}
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
                        onChange={(e) => updateField(row._key, 'id', e.target.value)}
                        onFocus={() => setSelectedKey(row._key)}
                        placeholder="name"
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Label (shown to user)</Label>
                      <Input
                        value={row.label}
                        onChange={(e) => updateField(row._key, 'label', e.target.value)}
                        onFocus={() => setSelectedKey(row._key)}
                        placeholder="Recipient Name"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <label className="mb-3 flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={row.required === true}
                      onCheckedChange={(checked) => updateField(row._key, 'required', checked === true)}
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
                      <Select value={row.align} onValueChange={(v) => updateField(row._key, 'align', v as TextFieldConfig['align'])}>
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
                      <Select value={selectedFontWeight} onValueChange={(v) => updateField(row._key, 'fontWeight', v as TextFieldConfig['fontWeight'])}>
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
                          onChange={(e) => updateField(row._key, 'color', e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border"
                        />
                        <Input
                          value={row.color}
                          onChange={(e) => updateField(row._key, 'color', e.target.value)}
                          className="h-8 flex-1 font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Font family</Label>
                      <Select
                        value={getSupportedCertificateFontValue(row.fontFamily)}
                        onValueChange={(value) => updateFontFamily(row._key, value)}
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
                      onClick={() => removeField(row._key)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove field
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {updateMutation.isSuccess && (
        <p className="text-xs text-green-600">Fields saved successfully.</p>
      )}
    </div>
  );
}
