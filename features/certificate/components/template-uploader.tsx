'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDefaultPrintSheetSettingsForTemplateType, TEMPLATE_TYPE_OPTIONS } from '@/lib/certificate-print';
import { useUploadTemplate } from '../hooks/use-templates';
import type { CertificateTemplate, CertificateTemplateType } from '../types';

type Props = {
  onDone: (template: CertificateTemplate) => void;
  onCancel: () => void;
};

export function TemplateUploader({ onDone, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<CertificateTemplateType>('certificate');
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadTemplate();

  function handleFile(f: File) {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name.trim());
    if (description.trim()) fd.append('description', description.trim());
    fd.append('fields', '[]');
    fd.append('templateType', templateType);
    fd.append('printSettings', JSON.stringify(getDefaultPrintSheetSettingsForTemplateType(templateType)));
    const template = await uploadMutation.mutateAsync(fd);
    onDone(template);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Upload Template</h3>
        <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-zinc-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drop zone */}
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-6 transition hover:border-indigo-400 dark:border-border"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="max-h-40 max-w-full rounded-lg object-contain" />
        ) : (
          <>
            <Upload className="h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-400">Click or drag a PNG / JPG / WEBP image</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-name">Template name</Label>
        <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Certificate" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-desc">Description (optional)</Label>
        <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="..." />
      </div>

      <div className="space-y-2">
        <Label>Template type</Label>
        <Select value={templateType} onValueChange={(value) => setTemplateType(value as CertificateTemplateType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={!file || !name.trim() || uploadMutation.isPending} className="flex-1">
          {uploadMutation.isPending ? 'Uploading…' : 'Upload & Configure'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>

      {uploadMutation.isError && (
        <p className="text-xs text-red-500">Upload failed. Please try again.</p>
      )}
    </form>
  );
}
