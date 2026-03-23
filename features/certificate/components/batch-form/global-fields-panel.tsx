'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CertificateTemplate } from '../../types';

type Props = {
  templateInputFields: CertificateTemplate['fields'];
  globalFieldIds: string[];
  globalValues: Record<string, string>;
  rowFieldIds: string[];
  onToggleGlobal: (fieldId: string, checked: boolean) => void;
  onUpdateGlobalValue: (fieldId: string, value: string) => void;
};

export function GlobalFieldsPanel({
  templateInputFields,
  globalFieldIds,
  globalValues,
  rowFieldIds,
  onToggleGlobal,
  onUpdateGlobalValue,
}: Props) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Global fields</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Select fields like date or venue that should stay fixed for every certificate in this batch.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {templateInputFields.map((field) => {
          const isChecked = globalFieldIds.includes(field.id);

          return (
            <label
              key={field.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-border"
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => onToggleGlobal(field.id, checked === true)}
              />
              <span>{field.label || field.id}{field.required ? ' *' : ''}</span>
            </label>
          );
        })}
      </div>
      {globalFieldIds.length > 0 && (
        <div className="grid gap-3 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-border">
          {templateInputFields
            .filter((field) => globalFieldIds.includes(field.id))
            .map((field) => (
              <div key={field.id} className="space-y-1">
                <Label htmlFor={`global-${field.id}`}>{field.label || field.id}{field.required ? ' *' : ''}</Label>
                <Input
                  id={`global-${field.id}`}
                  value={globalValues[field.id] ?? ''}
                  onChange={(e) => onUpdateGlobalValue(field.id, e.target.value)}
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
  );
}
