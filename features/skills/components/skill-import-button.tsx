'use client';

import { useState } from 'react';
import { FolderOpenIcon, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkillImportDialog } from './skill-import-dialog';

type Props = {
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
};

export function SkillImportButton({ label = 'นำเข้าจาก GitHub', variant = 'outline', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className="gap-1.5" onClick={() => setOpen(true)}>
        <LinkIcon className="size-4" />
        {label}
      </Button>
      <SkillImportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
