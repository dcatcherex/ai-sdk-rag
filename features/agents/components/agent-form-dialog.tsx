'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AgentForm } from './agent-form';
import type { Agent, CreateAgentInput } from '../types';

type AgentFormDialogProps = {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSubmit: (data: CreateAgentInput) => void;
  isPending?: boolean;
};

export const AgentFormDialog = ({
  open,
  agent,
  onClose,
  onSubmit,
  isPending,
}: AgentFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
        </DialogHeader>
        <AgentForm
          agent={agent}
          onCancel={onClose}
          onSubmit={onSubmit}
          isPending={isPending}
          layout="dialog"
          resetKey={`${open}-${agent?.id ?? 'new'}`}
          submitLabel={agent ? 'Save changes' : 'Create agent'}
        />
      </DialogContent>
    </Dialog>
  );
};
