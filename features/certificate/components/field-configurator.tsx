'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageUp, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import { CERTIFICATE_FONT_OPTIONS, getSupportedCertificateFontValue, isSupportedCertificateFont } from '@/lib/certificate-fonts';
import { useReplaceTemplateImage, useUpdateTemplate } from '../hooks/use-templates';
import type { CertificateTemplate, TextFieldConfig } from '../types';
import { DEFAULT_FIELD } from '../types';
import { TemplateFieldEditor } from './template-field-editor';

type Props = {
  template: CertificateTemplate;
  onSaved: (template: CertificateTemplate) => void;
  onTemplateUpdated: (template: CertificateTemplate) => void;
};

type FieldRow = TextFieldConfig & { _key: string };

function toRows(fields: TextFieldConfig[]): FieldRow[] {
  return fields.map((f) => ({ ...f, _key: f.id }));
}

export function FieldConfigurator({ template, onSaved, onTemplateUpdated }: Props) {
  const [rows, setRows] = useState<FieldRow[]>(() => toRows(template.fields));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => template.fields[0]?.id ?? null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateTemplate();
  const replaceImageMutation = useReplaceTemplateImage();

  useEffect(() => {
    const nextRows = toRows(template.fields);
    const nextSerialized = JSON.stringify(template.fields);

    setRows((prev) => {
      const currentSerialized = JSON.stringify(prev.map(({ _key: _ignored, ...rest }) => rest));
      return currentSerialized === nextSerialized ? prev : nextRows;
    });

    setSelectedKey((prevSelected) => {
      if (nextRows.length === 0) return null;
      if (prevSelected && nextRows.some((row) => row._key === prevSelected)) return prevSelected;
      return nextRows[0]?._key ?? null;
    });
  }, [template.fields]);

  useEffect(() => {
    if (rows.length === 0) {
      if (selectedKey !== null) {
        setSelectedKey(null);
      }
      return;
    }

    if (!selectedKey || !rows.some((row) => row._key === selectedKey)) {
      setSelectedKey(rows[0]._key);
    }
  }, [rows, selectedKey]);

  function addField() {
    const id = nanoid(8);
    setRows((prev) => [
      ...prev,
      { ...DEFAULT_FIELD, id, label: 'New Field', _key: id },
    ]);
    setSelectedKey(id);
  }

  function removeField(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
    if (selectedKey === key) {
      setSelectedKey((prevSelected) => {
        if (prevSelected !== key) return prevSelected;
        const nextRow = rows.find((row) => row._key !== key);
        return nextRow?._key ?? null;
      });
    }
  }

  function updateField<K extends keyof FieldRow>(key: string, prop: K, value: FieldRow[K]) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [prop]: value } : r)));
  }

  async function handleSave() {
    const fields: TextFieldConfig[] = rows.map(({ _key: _, ...rest }) => rest);
    const updated = await updateMutation.mutateAsync({ id: template.id, fields });
    onSaved(updated);
  }

  async function handleReplaceImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const updated = await replaceImageMutation.mutateAsync({ id: template.id, formData });
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
            Positions are % of template dimensions. Template: {template.width}×{template.height}px
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => replaceImageInputRef.current?.click()} disabled={replaceImageMutation.isPending}>
            <ImageUp className="mr-1 h-3.5 w-3.5" />
            {replaceImageMutation.isPending ? 'Replacing…' : 'Replace image'}
          </Button>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add field
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
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

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-400">
          No fields yet. Add a field (e.g. "name", "date").
        </p>
      )}

      {rows.length > 0 && (
        <TemplateFieldEditor
          template={template}
          rows={rows}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onUpdateField={updateField}
        />
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row._key}
            className={`rounded-xl border p-4 dark:border-border ${selectedKey === row._key ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-500/60 dark:bg-indigo-950/20' : 'border-zinc-200'}`}
          >
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
                <Select value={row.fontWeight} onValueChange={(v) => updateField(row._key, 'fontWeight', v as TextFieldConfig['fontWeight'])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
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
                  onValueChange={(value) => updateField(row._key, 'fontFamily', value)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!isSupportedCertificateFont(row.fontFamily) && (
                      <SelectItem value={row.fontFamily}>{row.fontFamily}</SelectItem>
                    )}
                    {CERTIFICATE_FONT_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.value}>{option.label}</SelectItem>
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
        ))}
      </div>

      {updateMutation.isSuccess && (
        <p className="text-xs text-green-600">Fields saved successfully.</p>
      )}
    </div>
  );
}
