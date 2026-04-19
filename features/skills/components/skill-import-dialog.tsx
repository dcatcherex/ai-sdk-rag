'use client';

import { useState } from 'react';
import { FolderOpenIcon, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useImportSkill } from '../hooks/use-skills';

type SkillImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isHttpUrl(input: string): boolean {
  try {
    const p = new URL(input);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

export const SkillImportDialog = ({ open, onOpenChange }: SkillImportDialogProps) => {
  const importSkill = useImportSkill();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const isUrl = isHttpUrl(url.trim());

  const handleClose = (next: boolean) => {
    if (!next) {
      setUrl('');
      setError('');
    }
    onOpenChange(next);
  };

  const handleImport = () => {
    setError('');
    importSkill.mutate(url.trim(), {
      onSuccess: () => handleClose(false),
      onError: (err) => setError(err.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Skill</DialogTitle>
          <DialogDescription>
            Paste a GitHub link to a skill folder or{' '}
            <code className="text-xs">SKILL.md</code> file, or enter a local
            folder path (dev only).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="https://github.com/user/repo/… or D:\skills\my-skill"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!url.trim() || importSkill.isPending}
          >
            {isUrl ? <LinkIcon className="size-4" /> : <FolderOpenIcon className="size-4" />}
            {importSkill.isPending ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
