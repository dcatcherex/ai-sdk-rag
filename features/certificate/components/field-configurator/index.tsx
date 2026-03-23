'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ImageUp, Plus, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { nanoid } from 'nanoid';
import {
  getCertificateFontAvailableWeights,
  resolveCertificateFontWeight,
} from '@/lib/certificate-fonts';
import {
  getDefaultPrintSheetSettings,
  getDefaultPrintSheetSettingsForTemplateType,
  getEstimatedTemplateItemSizeMm,
} from '@/lib/certificate-print';
import { useReplaceTemplateImage, useUpdateTemplate } from '../../hooks/use-templates';
import type { CertificateTemplate, CertificateTemplateType, PrintSheetSettings, TextFieldConfig } from '../../types';
import { DEFAULT_FIELD } from '../../types';
import { TemplateFieldEditor } from '../template-field-editor';
import { ImageDropzone } from './image-dropzone';
import { PrintSettingsPanel } from './print-settings-panel';
import { FieldRowEditor } from './field-row-editor';

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
    setPrintSettings((prev: PrintSheetSettings) => ({
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

      <ImageDropzone
        activeSide={activeSide}
        isReplaceDragActive={isReplaceDragActive}
        isPending={replaceImageMutation.isPending}
        inputRef={replaceImageInputRef}
        onDragOver={handleReplaceDragOver}
        onDragLeave={handleReplaceDragLeave}
        onDrop={handleReplaceDrop}
        onFileChange={(file) => void handleReplaceImage(file)}
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

      <PrintSettingsPanel
        templateType={templateType}
        printSettings={printSettings}
        estimatedFrontItemSize={estimatedFrontItemSize}
        isOpen={isPrintSettingsOpen}
        onOpenChange={setIsPrintSettingsOpen}
        onTemplateTypeChange={handleTemplateTypeChange}
        onPresetChange={handlePresetChange}
        onUpdatePrintSetting={updatePrintSetting}
        onUpdatePhysicalSize={updatePhysicalSize}
        onUpdateNoGap={updateNoGapSetting}
        formatMm={(value) => String(value ?? '')}
      />

      <div className="space-y-3">
        {rows.map((row) => {
          const isExpanded = selectedKey === row._key;

          return (
            <FieldRowEditor
              key={row._key}
              row={row}
              rows={rows}
              isExpanded={isExpanded}
              onSelect={setSelectedKey}
              onUpdateField={updateField}
              onUpdateFontFamily={updateFontFamily}
              onRemove={removeField}
            />
          );
        })}
      </div>

      {updateMutation.isSuccess && (
        <p className="text-xs text-green-600">Fields saved successfully.</p>
      )}
    </div>
  );
}
