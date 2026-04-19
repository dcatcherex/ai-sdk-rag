'use client';

import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Props = {
  skillId: string;
  skillName?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  label?: string;
  iconOnly?: boolean;
};

export function SkillExportButton({
  skillId,
  skillName,
  variant = 'outline',
  size = 'sm',
  label = 'Export',
  iconOnly = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skillId}/export`);
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }

      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `${skillName ?? 'skill'}.zip`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={iconOnly ? '' : 'gap-1.5'}
      onClick={handleExport}
      disabled={loading}
      title={iconOnly ? label : undefined}
    >
      <DownloadIcon className="size-3.5" />
      {!iconOnly && (loading ? 'Exporting…' : label)}
    </Button>
  );
}
