'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TEAM_TEMPLATES } from '../templates';
import type { TeamTemplate } from '../types';

type TemplatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: TeamTemplate) => void;
};

export function TemplatePickerDialog({ open, onOpenChange, onSelect }: TemplatePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[480px] pr-1">
          <div className="flex flex-col gap-3 pb-2">
            {TEAM_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  onSelect(template);
                  onOpenChange(false);
                }}
                className="flex flex-col gap-1.5 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{template.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[11px] capitalize"
                  >
                    {template.routingStrategy === 'planner_generated' ? 'planner' : 'sequential'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{template.description}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {template.memberSlots.map((slot) => (
                    <Badge
                      key={slot.position}
                      variant="secondary"
                      className="text-[11px]"
                    >
                      {slot.displayRole}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
