'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Mode = 'profile' | 'contact' | 'case' | 'task' | 'note';

type SubmitPayload = {
  title: string;
  body: string;
  dueAt?: string;
};

type Props = {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SubmitPayload) => Promise<void> | void;
};

const TITLES: Record<Mode, { title: string; description: string; primaryLabel: string }> = {
  profile: {
    title: 'New workspace',
    description: 'Create a profile for a client book, classroom, clinic queue, sales pipeline, or support desk.',
    primaryLabel: 'Create workspace',
  },
  contact: {
    title: 'New contact',
    description: 'Capture the person or organization tied to this work.',
    primaryLabel: 'Create contact',
  },
  case: {
    title: 'New case',
    description: 'Start a new case, project, visit, deal, ticket, or order.',
    primaryLabel: 'Create case',
  },
  task: {
    title: 'New task',
    description: 'Add the next action, follow-up, or approval step.',
    primaryLabel: 'Create task',
  },
  note: {
    title: 'Add note',
    description: 'Save a note or message summary to the case timeline.',
    primaryLabel: 'Save note',
  },
};

export function CaseIntakeDialog({ mode, open, onOpenChange, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setBody('');
      setDueAt('');
      setSubmitting(false);
    }
  }, [open]);

  const copy = TITLES[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="case-workspace-title">Title</Label>
            <Input
              id="case-workspace-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={mode === 'contact' || mode === 'profile' ? 'Name' : 'Title'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="case-workspace-body">
              {mode === 'note' ? 'Note' : 'Details'}
            </Label>
            <Textarea
              id="case-workspace-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
            />
          </div>
          {mode === 'task' ? (
            <div className="space-y-2">
              <Label htmlFor="case-workspace-dueAt">Due date</Label>
              <Input
                id="case-workspace-dueAt"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setSubmitting(true);
              await onSubmit({ title, body, dueAt: dueAt || undefined });
              onOpenChange(false);
            }}
            disabled={submitting || !title.trim()}
          >
            {copy.primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
