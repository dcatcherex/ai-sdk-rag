'use client';

import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import { useUpdateTemplate } from '../hooks/use-templates';
import type { CertificateTemplate, TextFieldConfig } from '../types';
import { DEFAULT_FIELD } from '../types';

type Props = {
  template: CertificateTemplate;
  onSaved: (template: CertificateTemplate) => void;
};

type FieldRow = TextFieldConfig & { _key: string };

function toRows(fields: TextFieldConfig[]): FieldRow[] {
  return fields.map((f) => ({ ...f, _key: f.id }));
}

export function FieldConfigurator({ template, onSaved }: Props) {
  const [rows, setRows] = useState<FieldRow[]>(() => toRows(template.fields));
  const updateMutation = useUpdateTemplate();

  function addField() {
    const id = nanoid(8);
    setRows((prev) => [
      ...prev,
      { ...DEFAULT_FIELD, id, label: 'New Field', _key: id },
    ]);
  }

  function removeField(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  function updateField<K extends keyof FieldRow>(key: string, prop: K, value: FieldRow[K]) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [prop]: value } : r)));
  }

  async function handleSave() {
    const fields: TextFieldConfig[] = rows.map(({ _key: _, ...rest }) => rest);
    const updated = await updateMutation.mutateAsync({ id: template.id, fields });
    onSaved(updated);
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
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add field
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-400">
          No fields yet. Add a field (e.g. "name", "date").
        </p>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row._key} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Field ID</Label>
                <Input
                  value={row.id}
                  onChange={(e) => updateField(row._key, 'id', e.target.value)}
                  placeholder="name"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Label (shown to user)</Label>
                <Input
                  value={row.label}
                  onChange={(e) => updateField(row._key, 'label', e.target.value)}
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
                <Input
                  value={row.fontFamily}
                  onChange={(e) => updateField(row._key, 'fontFamily', e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Arial, sans-serif"
                />
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
