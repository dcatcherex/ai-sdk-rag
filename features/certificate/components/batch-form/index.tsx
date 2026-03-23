'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { BookUser, Plus, Save, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTemplates } from '@/features/certificate/hooks/use-templates';
import { useGroups, useUpdateGroup } from '@/features/certificate/hooks/use-groups';
import type { CertificateTemplate, ExportFormat, GroupPerson, PdfQuality } from '../../types';

import { ImportPanel } from './import-panel';
import { GlobalFieldsPanel } from './global-fields-panel';
import { ImportMappingReview } from './import-mapping-review';
import { RecipientsTable } from './recipients-table';
import { ExportOptions } from './export-options';
import {
  IGNORE_IMPORT_FIELD_ID,
  getTemplateInputFields,
  emptyRecipient,
  parseDelimitedData,
  createPendingImport,
  type BatchPdfExportMode,
  type BatchRecipient,
  type PendingImport,
} from './utils';

type Props = { template: CertificateTemplate };

export function BatchForm({ template }: Props) {
  const queryClient = useQueryClient();
  const { data: allTemplates = [] } = useTemplates();
  const { data: groups = [] } = useGroups();
  const updateGroup = useUpdateGroup();
  const templateInputFields = useMemo(() => getTemplateInputFields(template), [template]);
  const [recipients, setRecipients] = useState<BatchRecipient[]>([emptyRecipient(templateInputFields)]);
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null);
  const [loadedGroupName, setLoadedGroupName] = useState('');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [pdfExportMode, setPdfExportMode] = useState<BatchPdfExportMode>('zip');
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('standard');
  const [padToGrid, setPadToGrid] = useState(true);
  const [fillerTemplateId, setFillerTemplateId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [globalFieldIds, setGlobalFieldIds] = useState<string[]>([]);
  const [globalValues, setGlobalValues] = useState<Record<string, string>>({});
  const [resultFileKey, setResultFileKey] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState<string | null>(null);
  const [downloadLabel, setDownloadLabel] = useState('Download ZIP');
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const rowFields = useMemo(
    () => templateInputFields.filter((field) => !globalFieldIds.includes(field.id)),
    [globalFieldIds, templateInputFields],
  );
  const rowFieldIds = rowFields.map((field) => field.id);
  const requiredFields = useMemo(
    () => templateInputFields.filter((field) => field.required === true),
    [templateInputFields],
  );
  const missingRequiredRows = useMemo(
    () => recipients.flatMap((recipient, index) => {
      const missingFieldLabels = requiredFields.flatMap((field) => {
        const value = globalFieldIds.includes(field.id)
          ? (globalValues[field.id] ?? '')
          : (recipient.values[field.id] ?? '');

        return value.trim().length === 0 ? [field.label || field.id] : [];
      });

      return missingFieldLabels.length > 0
        ? [{ rowIndex: index, missingFieldLabels }]
        : [];
    }),
    [globalFieldIds, globalValues, recipients, requiredFields],
  );
  const hasMissingRequiredValues = missingRequiredRows.length > 0;
  const pendingImportMappedFieldIds = useMemo(
    () => pendingImport?.columns
      .map((column) => column.mappedFieldId)
      .filter((fieldId): fieldId is string => fieldId !== IGNORE_IMPORT_FIELD_ID) ?? [],
    [pendingImport],
  );
  const pendingImportMissingFields = useMemo(
    () => pendingImport
      ? rowFields.filter((field) => !pendingImportMappedFieldIds.includes(field.id))
      : [],
    [pendingImport, pendingImportMappedFieldIds, rowFields],
  );
  const rowFieldKey = rowFields.map((field) => field.id).join('|');

  const sheetPadCount = useMemo(() => {
    if (pdfExportMode !== 'sheet_pdf') return 0;
    const perSheet = template.printSettings.columns * template.printSettings.rows;
    if (perSheet <= 1) return 0;
    const remainder = recipients.length % perSheet;
    return remainder === 0 ? 0 : perSheet - remainder;
  }, [pdfExportMode, recipients.length, template.printSettings.columns, template.printSettings.rows]);

  useEffect(() => {
    if (template.templateType === 'card' || template.templateType === 'tag') {
      setFormat('pdf');
      setPdfExportMode('sheet_pdf');
    }
  }, [template.templateType]);

  // Reset group state when the template changes
  useEffect(() => {
    setLoadedGroupId(null);
    setLoadedGroupName('');
  }, [template.id]);

  useEffect(() => {
    setPendingImport(null);
  }, [rowFieldKey]);

  function handleFormatChange(value: string) {
    const nextFormat = value as ExportFormat;
    setFormat(nextFormat);
    if (nextFormat !== 'pdf') {
      setPdfExportMode('zip');
      return;
    }

    setPdfExportMode(template.templateType === 'card' || template.templateType === 'tag' ? 'sheet_pdf' : 'single_pdf');
  }

  function addRow() {
    setRecipients((prev) => [...prev, emptyRecipient(templateInputFields)]);
  }

  function removeRow(i: number) {
    setRecipients((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCell(rowIdx: number, fieldId: string, value: string) {
    setRecipients((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, values: { ...r.values, [fieldId]: value } } : r)),
    );
  }

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseDelimitedData(text, rowFields);
      if (!parsed) {
        setError('CSV file is empty or has no data rows.');
        return;
      }

      setPendingImport(createPendingImport(parsed, rowFields));
      setError(null);
    };
    reader.readAsText(file);
  }

  function handlePasteImport() {
    if (rowFields.length === 0) {
      setError('All fields are global already. Remove one global field if you want to paste row-specific data.');
      return;
    }

    const parsed = parseDelimitedData(pasteValue, rowFields);
    if (!parsed) {
      setError('Paste data from Google Sheets or CSV first.');
      return;
    }

    setPendingImport(createPendingImport(parsed, rowFields));
    setError(null);
  }

  function updatePendingImportMapping(columnId: string, value: string) {
    const nextMappedFieldId = value === IGNORE_IMPORT_FIELD_ID ? IGNORE_IMPORT_FIELD_ID : value;

    setPendingImport((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        columns: prev.columns.map((column) => {
          if (column.id === columnId) {
            return {
              ...column,
              mappedFieldId: nextMappedFieldId,
              matchLabel: nextMappedFieldId === IGNORE_IMPORT_FIELD_ID ? 'Ignored manually' : 'Mapped manually',
            };
          }

          if (nextMappedFieldId !== IGNORE_IMPORT_FIELD_ID && column.mappedFieldId === nextMappedFieldId) {
            return {
              ...column,
              mappedFieldId: IGNORE_IMPORT_FIELD_ID,
              matchLabel: 'Ignored to avoid duplicate mapping',
            };
          }

          return column;
        }),
      };
    });
  }

  function applyPendingImport() {
    if (!pendingImport) {
      return;
    }

    const nextRecipients = pendingImport.rows.map((row) => {
      const values = Object.fromEntries(rowFields.map((field) => [field.id, '']));

      pendingImport.columns.forEach((column, index) => {
        if (column.mappedFieldId === IGNORE_IMPORT_FIELD_ID) {
          return;
        }

        values[column.mappedFieldId] = row[index] ?? '';
      });

      return { values };
    });

    if (nextRecipients.length === 0) {
      setError('Imported data has no rows to apply.');
      return;
    }

    setRecipients(nextRecipients);
    setPendingImport(null);
    setError(null);
    // Importing new data replaces the group link
    setLoadedGroupId(null);
    setLoadedGroupName('');
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

  function handleLoadGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const fieldIds = templateInputFields.map((f) => f.id);
    const nextRecipients: BatchRecipient[] = group.recipients.map((person) => ({
      _groupPersonId: person.id,
      values: Object.fromEntries(fieldIds.map((fieldId) => [fieldId, person.values[fieldId] ?? ''])),
    }));

    setRecipients(nextRecipients.length > 0 ? nextRecipients : [emptyRecipient(templateInputFields)]);
    setLoadedGroupId(group.id);
    setLoadedGroupName(group.name);
    setError(null);
  }

  function handleSaveToGroup() {
    if (!loadedGroupId) return;
    const group = groups.find((g) => g.id === loadedGroupId);
    const existingPersonMap = new Map<string, GroupPerson>(
      (group?.recipients ?? []).map((p) => [p.id, p]),
    );

    const nextGroupRecipients: GroupPerson[] = recipients.map((r) => {
      if (r._groupPersonId && existingPersonMap.has(r._groupPersonId)) {
        const original = existingPersonMap.get(r._groupPersonId)!;
        return { id: original.id, values: { ...original.values, ...r.values } };
      }
      return { id: nanoid(), values: { ...r.values } };
    });

    updateGroup.mutate({ id: loadedGroupId, recipients: nextGroupRecipients });
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    if (hasMissingRequiredValues) {
      setError('Fill all required fields before generating certificates.');
      return;
    }

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
          pdfQuality: format === 'pdf' ? pdfQuality : undefined,
          padToGrid: pdfExportMode === 'sheet_pdf' ? padToGrid : undefined,
          fillerTemplateId: (pdfExportMode === 'sheet_pdf' && padToGrid && fillerTemplateId) ? fillerTemplateId : undefined,
          recipients: recipients.map((r) => ({
            values: templateInputFields.map((field) => ({
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
      void queryClient.invalidateQueries({ queryKey: ['certificate-jobs'] });
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

  if (templateInputFields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-400">
        This template has no fields. Configure fields first.
      </p>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => csvRef.current?.click()}
        >
          <Upload className="mr-1 h-3.5 w-3.5" /> Import CSV
        </Button>

        {groups.length > 0 && (
          <Select value={loadedGroupId ?? ''} onValueChange={handleLoadGroup}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <BookUser className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <SelectValue placeholder="Load from group…" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  <span className="ml-1 text-zinc-400">({g.recipients.length})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

      {loadedGroupId && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-800 dark:bg-indigo-950/30">
          <BookUser className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="flex-1 text-indigo-700 dark:text-indigo-300">
            Loaded from: <span className="font-semibold">{loadedGroupName}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 border-indigo-300 px-2 text-xs text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300"
            onClick={handleSaveToGroup}
            disabled={updateGroup.isPending}
          >
            <Save className="mr-1 h-3 w-3" />
            {updateGroup.isPending ? 'Saving…' : 'Save to group'}
          </Button>
          {updateGroup.isSuccess && (
            <span className="text-xs text-green-600 dark:text-green-400">Saved!</span>
          )}
          <button
            type="button"
            onClick={() => { setLoadedGroupId(null); setLoadedGroupName(''); }}
            className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200"
            aria-label="Unlink group"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ImportPanel
          pasteValue={pasteValue}
          onPasteChange={setPasteValue}
          onReviewMapping={handlePasteImport}
          onClear={() => setPasteValue('')}
          rowFields={rowFields}
        />
        <GlobalFieldsPanel
          templateInputFields={templateInputFields}
          globalFieldIds={globalFieldIds}
          globalValues={globalValues}
          rowFieldIds={rowFieldIds}
          onToggleGlobal={toggleGlobalField}
          onUpdateGlobalValue={updateGlobalValue}
        />
      </div>

      {pendingImport && (
        <ImportMappingReview
          pendingImport={pendingImport}
          rowFields={rowFields}
          pendingImportMissingFields={pendingImportMissingFields}
          onUpdateMapping={updatePendingImportMapping}
          onApply={applyPendingImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      <RecipientsTable
        recipients={recipients}
        rowFields={rowFields}
        onUpdateCell={updateCell}
        onRemoveRow={removeRow}
      />

      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add row
      </Button>

      <ExportOptions
        template={template}
        format={format}
        pdfExportMode={pdfExportMode}
        pdfQuality={pdfQuality}
        padToGrid={padToGrid}
        fillerTemplateId={fillerTemplateId}
        sheetPadCount={sheetPadCount}
        allTemplates={allTemplates}
        recipientCount={recipients.length}
        loading={loading}
        downloading={downloading}
        hasMissingRequiredValues={hasMissingRequiredValues}
        resultFileKey={resultFileKey}
        downloadLabel={downloadLabel}
        count={count}
        error={error}
        onFormatChange={handleFormatChange}
        onPdfExportModeChange={setPdfExportMode}
        onPdfQualityChange={setPdfQuality}
        onPadToGridChange={setPadToGrid}
        onFillerTemplateChange={setFillerTemplateId}
        onDownload={handleDownload}
      />

      {hasMissingRequiredValues && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Missing required fields</p>
          <div className="mt-2 space-y-1 text-xs">
            {missingRequiredRows.slice(0, 5).map((row) => (
              <p key={row.rowIndex}>
                Row {row.rowIndex + 1}: {row.missingFieldLabels.join(', ')}
              </p>
            ))}
            {missingRequiredRows.length > 5 && (
              <p>And {missingRequiredRows.length - 5} more row{missingRequiredRows.length - 5 !== 1 ? 's' : ''}.</p>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
