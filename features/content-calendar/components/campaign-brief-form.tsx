'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSaveCampaignBrief } from '../hooks/use-calendar';
import type { CampaignBrief, CampaignStatus } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief?: CampaignBrief | null;
};

const CHANNEL_OPTIONS = ['instagram', 'facebook', 'linkedin', 'email', 'blog', 'other'];

export function CampaignBriefForm({ open, onOpenChange, brief }: Props) {
  const save = useSaveCampaignBrief();

  const [title, setTitle] = useState(brief?.title ?? '');
  const [goal, setGoal] = useState(brief?.goal ?? '');
  const [offer, setOffer] = useState(brief?.offer ?? '');
  const [keyMessage, setKeyMessage] = useState(brief?.keyMessage ?? '');
  const [cta, setCta] = useState(brief?.cta ?? '');
  const [channelsText, setChannelsText] = useState((brief?.channels ?? []).join(', '));
  const [startDate, setStartDate] = useState(brief?.startDate ?? '');
  const [endDate, setEndDate] = useState(brief?.endDate ?? '');
  const [status, setStatus] = useState<CampaignStatus>(brief?.status ?? 'draft');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const channels = channelsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    save.mutate(
      {
        id: brief?.id,
        data: {
          title,
          goal: goal || null,
          offer: offer || null,
          keyMessage: keyMessage || null,
          cta: cta || null,
          channels,
          startDate: startDate || null,
          endDate: endDate || null,
          status,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{brief ? 'Edit Campaign' : 'New Campaign Brief'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="brief-title">Title *</Label>
            <Input
              id="brief-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Campaign title"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brief-goal">Goal</Label>
            <Textarea
              id="brief-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What is the goal of this campaign?"
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brief-offer">Offer</Label>
            <Input
              id="brief-offer"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="What does this campaign promote?"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brief-key-message">Key Message</Label>
            <Textarea
              id="brief-key-message"
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              placeholder="Core message of the campaign"
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brief-cta">CTA</Label>
            <Input
              id="brief-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Call to action text"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brief-channels">
              Channels{' '}
              <span className="text-muted-foreground text-xs">(comma-separated)</span>
            </Label>
            <Input
              id="brief-channels"
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              placeholder={CHANNEL_OPTIONS.join(', ')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="brief-start">Start Date</Label>
              <Input
                id="brief-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brief-end">End Date</Label>
              <Input
                id="brief-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !title.trim()}>
              {save.isPending ? 'Saving…' : brief ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
