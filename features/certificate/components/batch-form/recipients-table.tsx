'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CertificateTemplate } from '../../types';
import type { BatchRecipient } from './utils';

type Props = {
  recipients: BatchRecipient[];
  rowFields: CertificateTemplate['fields'];
  onUpdateCell: (rowIdx: number, fieldId: string, value: string) => void;
  onRemoveRow: (i: number) => void;
};

export function RecipientsTable({ recipients, rowFields, onUpdateCell, onRemoveRow }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border dark:border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-zinc-50 dark:border-border dark:bg-muted/50">
            <th className="w-8 px-3 py-2 text-left text-xs text-zinc-400">#</th>
            {rowFields.map((f) => (
              <th key={f.id} className="px-3 py-2 text-left text-xs font-medium text-zinc-600 dark:text-muted-foreground">
                {f.label}{f.required ? ' *' : ''}
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
                    onChange={(e) => onUpdateCell(i, f.id, e.target.value)}
                    placeholder={f.label}
                    className="h-7 text-xs"
                  />
                </td>
              ))}
              <td className="px-2">
                <button
                  type="button"
                  onClick={() => onRemoveRow(i)}
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
  );
}
