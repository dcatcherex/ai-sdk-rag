'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AiSuggestionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
};

export function AiSuggestionDialog({
  open,
  onOpenChange,
  title,
  description,
  suggestions,
  onSelect,
  primaryActionLabel,
  onPrimaryAction,
}: AiSuggestionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions yet.</p>
          ) : suggestions.map((suggestion, index) => (
            <div key={`${suggestion}-${index}`} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm leading-relaxed">{suggestion}</p>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSelect(suggestion)}
                >
                  Use this
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {primaryActionLabel && onPrimaryAction ? (
            <Button type="button" onClick={onPrimaryAction} disabled={suggestions.length === 0}>
              {primaryActionLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
