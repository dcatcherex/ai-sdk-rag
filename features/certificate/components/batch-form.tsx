'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CertificateTemplate, ExportFormat, Recipient } from '../types';
import { FORMAT_OPTIONS } from '../types';

type Props = { template: CertificateTemplate };

type BatchPdfExportMode = 'zip' | 'single_pdf';

const PDF_EXPORT_LABELS: Record<BatchPdfExportMode, string> = {
  zip: 'ZIP of PDFs',
  single_pdf: 'One PDF file',
};

function emptyRecipient(fields: CertificateTemplate['fields']): Recipient {
  return { values: Object.fromEntries(fields.map((f) => [f.id, ''])) };
}

function normalizeColumnName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseDelimitedText(text: string, fields: CertificateTemplate['fields']): Recipient[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
  const fieldIds = fields.map((field) => field.id);
  const fieldLookup = new Map<string, string>();

  fields.forEach((field) => {
    fieldLookup.set(normalizeColumnName(field.id), field.id);
    fieldLookup.set(normalizeColumnName(field.label), field.id);
  });

  const firstLine = lines[0].split(delimiter).map((cell) => normalizeColumnName(cell));
  const hasHeader = firstLine.some((cell) => fieldLookup.has(cell));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const headers = hasHeader
    ? firstLine.map((cell, index) => fieldLookup.get(cell) ?? fieldIds[index] ?? null)
    : fieldIds;

  return dataLines.map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      values[header] = cells[index] ?? '';
    });
    return {
      values: Object.fromEntries(fieldIds.map((fieldId) => [fieldId, values[fieldId] ?? ''])),
    };
  });
}

export function BatchForm({ template }: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient(template.fields)]);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [pdfExportMode, setPdfExportMode] = useState<BatchPdfExportMode>('zip');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [globalFieldIds, setGlobalFieldIds] = useState<string[]>([]);
  const [globalValues, setGlobalValues] = useState<Record<string, string>>({});
  const [resultFileKey, setResultFileKey] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState<string | null>(null);
  const [downloadLabel, setDownloadLabel] = useState('Download ZIP');
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const rowFields = useMemo(
    () => template.fields.filter((field) => !globalFieldIds.includes(field.id)),
    [globalFieldIds, template.fields],
  );
  const rowFieldIds = rowFields.map((field) => field.id);

  function handleFormatChange(value: string) {
    const nextFormat = value as ExportFormat;
    setFormat(nextFormat);
    setPdfExportMode(nextFormat === 'pdf' ? 'single_pdf' : 'zip');
  }

  function addRow() {
    setRecipients((prev) => [...prev, emptyRecipient(template.fields)]);
  }

  function removeRow(i: number) {
    setRecipients((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCell(rowIdx: number, fieldId: string, value: string) {
    setRecipients((prev) =>
      prev.map((r, i) => (i === rowIdx ? { values: { ...r.values, [fieldId]: value } } : r)),
    );
  }

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseDelimitedText(text, rowFields);
      if (parsed.length > 0) setRecipients(parsed);
    };
    reader.readAsText(file);
  }

  function handlePasteImport() {
    if (rowFields.length === 0) {
      setError('All fields are global already. Remove one global field if you want to paste row-specific data.');
      return;
    }

    const parsed = parseDelimitedText(pasteValue, rowFields);
    if (parsed.length === 0) {
      setError('Paste data from Google Sheets or CSV first.');
      return;
    }

    setRecipients(parsed);
    setError(null);
  }

  function toggleGlobalField(fieldId: string, checked: boolean) {
    setGlobalFieldIds((prev) => {
      if (checked) {
        return prev.includes(fieldId) ? prev : [...prev, fieldId];
      }

      return prev.filter((id) => id !== fieldId);
    });

    if (checked) {
      setGlobalValues((prev) => {
        if (prev[fieldId] !== undefined) {
          return prev;
        }

        return {
          ...prev,
          [fieldId]: recipients[0]?.values[fieldId] ?? '',
        };
      });
    }
  }

  function updateGlobalValue(fieldId: string, value: string) {
    setGlobalValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultFileKey(null);
    setResultFileName(null);
    try {
      const res = await fetch('/api/certificate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          format,
          exportMode: format === 'pdf' ? pdfExportMode : 'zip',
          recipients: recipients.map((r) => ({
            values: template.fields.map((field) => ({
              fieldId: field.id,
              value: globalFieldIds.includes(field.id)
                ? (globalValues[field.id] ?? '')
                : (r.values[field.id] ?? ''),
            })),
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Batch failed');
      const data = await res.json() as {
        fileKey: string;
        fileName: string;
        count: number;
        downloadLabel?: string;
      };
      setResultFileKey(data.fileKey);
      setResultFileName(data.fileName);
      setDownloadLabel(data.downloadLabel ?? 'Download ZIP');
      setCount(data.count);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!resultFileKey) return;

    setDownloading(true);
    setError(null);

    try {
      const fileUrl = `/api/certificate/files?key=${encodeURIComponent(resultFileKey)}&download=1&filename=${encodeURIComponent(resultFileName ?? `${template.name || 'certificates'}.zip`)}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = resultFileName ?? `${template.name || 'certificates'}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  if (template.fields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-400">
        This template has no fields. Configure fields first.
      </p>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => csvRef.current?.click()}
        >
          <Upload className="mr-1 h-3.5 w-3.5" /> Import CSV
        </Button>
        <span className="text-xs text-zinc-400">
          Row columns: {rowFieldIds.join(', ') || 'none'}
        </span>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-border">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Paste from Google Sheets</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Copy rows from Sheets, then paste here. Only non-global fields are imported into the row table.
            </p>
          </div>
          <Textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder={rowFields.map((field) => field.label || field.id).join('\t')}
            className="min-h-32 text-xs"
            disabled={rowFields.length === 0}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handlePasteImport} disabled={rowFields.length === 0}>
              Paste into table
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPasteValue('')}>
              Clear pasted text
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-border">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Global fields</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select fields like date or venue that should stay fixed for every certificate in this batch.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {template.fields.map((field) => {
              const isChecked = globalFieldIds.includes(field.id);

              return (
                <label
                  key={field.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-border"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => toggleGlobalField(field.id, checked === true)}
                  />
                  <span>{field.label || field.id}</span>
                </label>
              );
            })}
          </div>
          {globalFieldIds.length > 0 && (
            <div className="grid gap-3 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-border">
              {template.fields
                .filter((field) => globalFieldIds.includes(field.id))
                .map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label htmlFor={`global-${field.id}`}>{field.label || field.id}</Label>
                    <Input
                      id={`global-${field.id}`}
                      value={globalValues[field.id] ?? ''}
                      onChange={(e) => updateGlobalValue(field.id, e.target.value)}
                      placeholder={`Shared ${field.label || field.id} value`}
                    />
                  </div>
                ))}
            </div>
          )}
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {globalFieldIds.length > 0
              ? `Row table now shows ${rowFieldIds.length} non-global field${rowFieldIds.length !== 1 ? 's' : ''}.`
              : 'No global fields selected yet.'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border dark:border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:border-border dark:bg-muted/50">
              <th className="w-8 px-3 py-2 text-left text-xs text-zinc-400">#</th>
              {rowFields.map((f) => (
                <th key={f.id} className="px-3 py-2 text-left text-xs font-medium text-zinc-600 dark:text-muted-foreground">
                  {f.label}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {recipients.map((r, i) => (
              <tr key={i} className="border-b last:border-0 dark:border-border">
                <td className="px-3 py-1.5 text-xs text-zinc-400">{i + 1}</td>
                {rowFields.map((f) => (
                  <td key={f.id} className="px-2 py-1">
                    <Input
                      value={r.values[f.id] ?? ''}
                      onChange={(e) => updateCell(i, f.id, e.target.value)}
                      placeholder={f.label}
                      className="h-7 text-xs"
                    />
                  </td>
                ))}
                <td className="px-2">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={recipients.length === 1}
                    className="text-zinc-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add row
      </Button>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Format</Label>
          <Select value={format} onValueChange={handleFormatChange}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {format === 'pdf' && (
          <div className="space-y-1.5">
            <Label>PDF export</Label>
            <Select value={pdfExportMode} onValueChange={(v) => setPdfExportMode(v as BatchPdfExportMode)}>
              <SelectTrigger className="w-44"><SelectValue>{PDF_EXPORT_LABELS[pdfExportMode]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">ZIP of PDFs</SelectItem>
                <SelectItem value="single_pdf">One PDF file</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? `Generating ${recipients.length} certificates…` : `Generate ${recipients.length} Certificate${recipients.length !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {resultFileKey && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="flex-1 text-sm font-medium text-green-700 dark:text-green-400">
            {count} certificates generated!
          </p>
          <Button size="sm" variant="outline" type="button" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-1 h-3.5 w-3.5" /> {downloading ? 'Downloading…' : downloadLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
