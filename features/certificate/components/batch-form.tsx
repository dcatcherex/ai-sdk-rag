'use client';

import { useState, useRef } from 'react';
import { Download, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CertificateTemplate, ExportFormat, Recipient } from '../types';
import { FORMAT_OPTIONS } from '../types';

type Props = { template: CertificateTemplate };

function emptyRecipient(fields: CertificateTemplate['fields']): Recipient {
  return { values: Object.fromEntries(fields.map((f) => [f.id, ''])) };
}

function parseCSV(csv: string, fieldIds: string[]): Recipient[] {
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Auto-detect header row
  const firstLine = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader = fieldIds.some((id) => firstLine.includes(id.toLowerCase()));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const headers = hasHeader ? firstLine : fieldIds;

  return dataLines.map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const values: Record<string, string> = {};
    headers.forEach((h, i) => {
      const matchedId = fieldIds.find((id) => id.toLowerCase() === h) ?? fieldIds[i];
      if (matchedId) values[matchedId] = cells[i] ?? '';
    });
    return { values };
  });
}

export function BatchForm({ template }: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([emptyRecipient(template.fields)]);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [loading, setLoading] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const fieldIds = template.fields.map((f) => f.id);

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
      const parsed = parseCSV(text, fieldIds);
      if (parsed.length > 0) setRecipients(parsed);
    };
    reader.readAsText(file);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setZipUrl(null);
    try {
      const res = await fetch('/api/certificate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          format,
          recipients: recipients.map((r) => ({
            values: Object.entries(r.values).map(([fieldId, value]) => ({ fieldId, value })),
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Batch failed');
      const data = await res.json();
      setZipUrl(data.zipUrl);
      setCount(data.count);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
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
      {/* CSV import */}
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
          CSV columns: {fieldIds.join(', ')}
        </span>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }}
        />
      </div>

      {/* Recipients table */}
      <div className="overflow-x-auto rounded-xl border dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="w-8 px-3 py-2 text-left text-xs text-zinc-400">#</th>
              {template.fields.map((f) => (
                <th key={f.id} className="px-3 py-2 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {f.label}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {recipients.map((r, i) => (
              <tr key={i} className="border-b last:border-0 dark:border-zinc-700">
                <td className="px-3 py-1.5 text-xs text-zinc-400">{i + 1}</td>
                {template.fields.map((f) => (
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
          <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? `Generating ${recipients.length} certificates…` : `Generate ${recipients.length} Certificate${recipients.length !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {zipUrl && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="flex-1 text-sm font-medium text-green-700 dark:text-green-400">
            {count} certificates generated!
          </p>
          <a href={zipUrl} download target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Download className="mr-1 h-3.5 w-3.5" /> Download ZIP
            </Button>
          </a>
        </div>
      )}
    </form>
  );
}
