'use client';

import { useState } from 'react';
import { PlusIcon, LayoutTemplateIcon, SaveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSaveFlexDraft, useUpdateFlexDraft } from '../hooks/use-flex-drafts';
import { parseFlexJson } from '../utils';
import { FlexEditor } from './flex-editor';
import { FlexTemplateGallery } from './flex-template-gallery';
import { FlexDraftList } from './flex-draft-list';
import type { FlexDraftRecord, FlexTemplateRecord } from '../types';

const EMPTY_BUBBLE = JSON.stringify(
  {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: 'Hello', size: 'lg', weight: 'bold' },
        { type: 'text', text: 'Edit the JSON on the left to build your flex message.', size: 'sm', wrap: true, color: '#888888', margin: 'md' },
      ],
    },
  },
  null,
  2,
);

type FlexMessagePanelProps = {
  channelId: string;
};

export function FlexMessagePanel({ channelId }: FlexMessagePanelProps) {
  const [jsonValue, setJsonValue] = useState(EMPTY_BUBBLE);
  const [altText, setAltText] = useState('');
  const [draftName, setDraftName] = useState('');
  const [editingDraft, setEditingDraft] = useState<FlexDraftRecord | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const saveDraft = useSaveFlexDraft(channelId);
  const updateDraft = useUpdateFlexDraft(channelId);

  const handleSelectTemplate = (template: FlexTemplateRecord) => {
    setJsonValue(JSON.stringify(template.flexPayload, null, 2));
    setAltText(template.altText);
    setDraftName(template.name);
    setSelectedTemplateId(template.id);
    setEditingDraft(null);
    setGalleryOpen(false);
  };

  const handleEditDraft = (draft: FlexDraftRecord) => {
    setEditingDraft(draft);
    setJsonValue(JSON.stringify(draft.flexPayload, null, 2));
    setAltText(draft.altText);
    setDraftName(draft.name);
    setSelectedTemplateId(draft.templateId ?? null);
  };

  const handleNewMessage = () => {
    setEditingDraft(null);
    setJsonValue(EMPTY_BUBBLE);
    setAltText('');
    setDraftName('');
    setSelectedTemplateId(null);
  };

  const handleSave = async () => {
    const payload = parseFlexJson(jsonValue);
    if (!payload || !draftName.trim() || !altText.trim()) return;

    if (editingDraft) {
      await updateDraft.mutateAsync({
        id: editingDraft.id,
        name: draftName.trim(),
        altText: altText.trim(),
        flexPayload: payload,
      });
    } else {
      await saveDraft.mutateAsync({
        name: draftName.trim(),
        altText: altText.trim(),
        flexPayload: payload,
        channelId,
        templateId: selectedTemplateId,
      });
    }
    setSaveDialogOpen(false);
  };

  const payload = parseFlexJson(jsonValue);
  const canSave = Boolean(payload && altText.trim());

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewMessage}>
          <PlusIcon className="size-4" />
          New
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setGalleryOpen(true)}
        >
          <LayoutTemplateIcon className="size-4" />
          From template
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!canSave}
            onClick={() => setSaveDialogOpen(true)}
          >
            <SaveIcon className="size-4" />
            {editingDraft ? 'Update' : 'Save draft'}
          </Button>
        </div>
      </div>

      {/* Editor — takes available height */}
      <div className="min-h-0 flex-1" style={{ height: 480 }}>
        <FlexEditor value={jsonValue} onChange={setJsonValue} />
      </div>

      {/* Saved drafts */}
      <div className="shrink-0 space-y-2">
        <h3 className="text-sm font-medium">Saved Flex Messages</h3>
        <FlexDraftList channelId={channelId} onEdit={handleEditDraft} />
      </div>

      {/* Template gallery dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick a template</DialogTitle>
          </DialogHeader>
          <FlexTemplateGallery selectedId={selectedTemplateId} onSelect={handleSelectTemplate} />
        </DialogContent>
      </Dialog>

      {/* Save draft dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingDraft ? 'Update flex message' : 'Save flex message'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Rice price alert"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Alt text (notification preview)</Label>
              <Input
                placeholder="Short description shown in notifications"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Max 400 characters. Shown when Flex can't render.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!draftName.trim() || !altText.trim() || saveDraft.isPending || updateDraft.isPending}
            >
              {saveDraft.isPending || updateDraft.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
