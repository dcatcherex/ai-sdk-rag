'use client';

import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPrintPresetLabel } from '@/lib/certificate-print';
import { FORMAT_OPTIONS, PDF_QUALITY_OPTIONS, type ExportFormat, type PdfQuality } from '../../types';
import type { CertificateTemplate } from '../../types';
import { type BatchPdfExportMode, PDF_EXPORT_LABELS } from './utils';

type Props = {
  template: CertificateTemplate;
  format: ExportFormat;
  pdfExportMode: BatchPdfExportMode;
  pdfQuality: PdfQuality;
  padToGrid: boolean;
  fillerTemplateId: string;
  sheetPadCount: number;
  allTemplates: CertificateTemplate[];
  recipientCount: number;
  loading: boolean;
  downloading: boolean;
  hasMissingRequiredValues: boolean;
  resultFileKey: string | null;
  downloadLabel: string;
  count: number;
  error: string | null;
  onFormatChange: (value: string) => void;
  onPdfExportModeChange: (mode: BatchPdfExportMode) => void;
  onPdfQualityChange: (quality: PdfQuality) => void;
  onPadToGridChange: (checked: boolean) => void;
  onFillerTemplateChange: (id: string) => void;
  onDownload: () => void;
};

export function ExportOptions({
  template,
  format,
  pdfExportMode,
  pdfQuality,
  padToGrid,
  fillerTemplateId,
  sheetPadCount,
  allTemplates,
  recipientCount,
  loading,
  downloading,
  hasMissingRequiredValues,
  resultFileKey,
  downloadLabel,
  count,
  error,
  onFormatChange,
  onPdfExportModeChange,
  onPdfQualityChange,
  onPadToGridChange,
  onFillerTemplateChange,
  onDownload,
}: Props) {
  return (
    <>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Format</Label>
          <Select value={format} onValueChange={onFormatChange}>
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
            <Select value={pdfExportMode} onValueChange={(v) => onPdfExportModeChange(v as BatchPdfExportMode)}>
              <SelectTrigger className="w-44"><SelectValue>{PDF_EXPORT_LABELS[pdfExportMode]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">ZIP of PDFs</SelectItem>
                <SelectItem value="single_pdf">One PDF file</SelectItem>
                <SelectItem value="sheet_pdf">A4 3×3 sheet PDF</SelectItem>
              </SelectContent>
            </Select>
            {pdfExportMode === 'sheet_pdf' && (
              <>
                <p className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Uses the saved {getPrintPresetLabel(template.printSettings.preset)} preset with {template.printSettings.columns} column{template.printSettings.columns !== 1 ? 's' : ''}, {template.printSettings.rows} row{template.printSettings.rows !== 1 ? 's' : ''}, {template.printSettings.cropMarks ? 'crop marks enabled' : 'no crop marks'}, and {template.printSettings.duplexMode === 'front_back' && template.backR2Key
                    ? `front/back pages (${template.printSettings.backPageOrder} back order, X ${template.printSettings.backOffsetXMm} mm, Y ${template.printSettings.backOffsetYMm} mm${template.printSettings.backFlipX ? ', flipped horizontally' : ''}${template.printSettings.backFlipY ? ', flipped vertically' : ''})`
                    : 'single-sided pages'}.
                </p>
                <div className="mt-2 space-y-2">
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={padToGrid}
                      onCheckedChange={(checked) => onPadToGridChange(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      Pad sheet with blank cards
                      {sheetPadCount > 0
                        ? ` — adds ${sheetPadCount} blank card${sheetPadCount !== 1 ? 's' : ''} to fill the last row`
                        : ' — sheet is already full'}
                    </span>
                  </label>
                  {padToGrid && sheetPadCount > 0 && (
                    <div className="ml-6 flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Filler design:</span>
                      <Select value={fillerTemplateId || '__blank__'} onValueChange={(v) => onFillerTemplateChange(v === '__blank__' ? '' : v)}>
                        <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__blank__">Blank (same template)</SelectItem>
                          {allTemplates
                            .filter((t) => t.id !== template.id)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {format === 'pdf' && (
          <div className="space-y-1.5">
            <Label>PDF quality</Label>
            <Select value={pdfQuality} onValueChange={(value) => onPdfQualityChange(value as PdfQuality)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PDF_QUALITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={loading || hasMissingRequiredValues} className="flex-1">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? `Generating ${recipientCount} certificates…` : `Generate ${recipientCount} Certificate${recipientCount !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {resultFileKey && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="flex-1 text-sm font-medium text-green-700 dark:text-green-400">
            {count} certificates generated!
          </p>
          <Button size="sm" variant="outline" type="button" onClick={onDownload} disabled={downloading}>
            <Download className="mr-1 h-3.5 w-3.5" /> {downloading ? 'Downloading…' : downloadLabel}
          </Button>
        </div>
      )}
    </>
  );
}
