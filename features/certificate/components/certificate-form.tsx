'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CertificateTemplate, ExportFormat } from '../types';
import { FORMAT_OPTIONS } from '../types';

type Props = { template: CertificateTemplate };

export function CertificateForm({ template }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.fields.map((f) => [f.id, ''])),
  );
  const [format, setFormat] = useState<ExportFormat>('png');
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultUrl(null);
    try {
      const res = await fetch('/api/certificate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          format,
          values: Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed');
      const data = await res.json();
      setResultUrl(data.url);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (template.fields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-400">
        This template has no fields configured. Go to Configure Fields first.
      </p>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {template.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`field-${field.id}`}>{field.label}</Label>
            <Input
              id={`field-${field.id}`}
              value={values[field.id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              placeholder={field.label}
            />
          </div>
        ))}
      </div>

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
          {loading ? 'Generating…' : 'Generate Certificate'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {resultUrl && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="flex-1 text-sm font-medium text-green-700 dark:text-green-400">Certificate generated!</p>
          <a href={resultUrl} download target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Download className="mr-1 h-3.5 w-3.5" /> Download
            </Button>
          </a>
        </div>
      )}
    </form>
  );
}
