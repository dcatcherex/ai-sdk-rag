'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftIcon, BotIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AgentForm } from './agent-form';
import type { AgentEditorSectionId } from './agent-editor-sections';
import type { Agent, CreateAgentInput } from '../types';

type AgentEditorPanelProps = {
  agent?: Agent | null;
  isPending?: boolean;
  onBack: () => void;
  onSubmit: (data: CreateAgentInput) => void;
};

export function AgentEditorPanel({ agent, isPending, onBack, onSubmit }: AgentEditorPanelProps) {
  const isEdit = Boolean(agent);
  const [activeSection, setActiveSection] = useState<AgentEditorSectionId>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBack = () => {
    if (isPending) {
      return;
    }

    if (hasUnsavedChanges) {
      setShowLeaveDialog(true);
      return;
    }

    onBack();
  };

  const handleDiscardChanges = () => {
    setShowLeaveDialog(false);
    onBack();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-black/5 px-6 py-4 dark:border-border">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleBack} disabled={isPending}>
            <ArrowLeftIcon className="size-4" />
            Back to Agents
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BotIcon className="size-4 text-primary" />
              <h2 className="truncate text-lg font-semibold">{isEdit ? 'Edit Agent' : 'Create Agent'}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update prompt, tools, sharing, and model settings in one workspace.'
                : 'Create a tailored AI agent with its own prompt, tools, and knowledge sources.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
        <AgentForm
          activeSection={activeSection}
          agent={agent}
          onSectionChange={setActiveSection}
          onCancel={handleBack}
          onDirtyChange={setHasUnsavedChanges}
          onSubmit={onSubmit}
          isPending={isPending}
          layout="panel"
          submitLabel={isEdit ? 'Save changes' : 'Create agent'}
        />
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits in this agent. Leave the editor now and those changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDiscardChanges}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
