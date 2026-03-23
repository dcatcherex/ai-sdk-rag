'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CertificateTemplate } from '../../types';
import { IGNORE_IMPORT_FIELD_ID, type PendingImport } from './utils';

type Props = {
  pendingImport: PendingImport;
  rowFields: CertificateTemplate['fields'];
  pendingImportMissingFields: CertificateTemplate['fields'];
  onUpdateMapping: (columnId: string, value: string) => void;
  onApply: () => void;
  onCancel: () => void;
};

export function ImportMappingReview({
  pendingImport,
  rowFields,
  pendingImportMissingFields,
  onUpdateMapping,
  onApply,
  onCancel,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-border">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Review imported column mapping</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Match each imported column to the correct template field before filling the table.
          </p>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {pendingImport.rows.length} row{pendingImport.rows.length !== 1 ? 's' : ''} ready to import
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pendingImport.columns.map((column) => (
          <div key={column.id} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-border">
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{column.sourceHeader}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {column.sampleValue ? `Sample: ${column.sampleValue}` : 'No sample value found'}
              </p>
            </div>
            <Select value={column.mappedFieldId} onValueChange={(value) => onUpdateMapping(column.id, value)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={IGNORE_IMPORT_FIELD_ID}>Ignore this column</SelectItem>
                {rowFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>{field.label || field.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{column.matchLabel}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {pendingImportMissingFields.length > 0
            ? `Not mapped yet: ${pendingImportMissingFields.map((field) => field.label || field.id).join(', ')}`
            : 'All visible row fields are mapped.'}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel import
          </Button>
          <Button type="button" size="sm" onClick={onApply}>
            Import {pendingImport.rows.length} row{pendingImport.rows.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
