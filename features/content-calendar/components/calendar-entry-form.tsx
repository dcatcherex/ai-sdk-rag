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
import { useSaveCalendarEntry, useCampaignBriefs } from '../hooks/use-calendar';
import type { CalendarEntry, CalendarEntryContentType, CalendarChannel, CalendarEntryStatus } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: CalendarEntry | null;
  defaultDate?: string;
};

const NONE_VALUE = '__none__';

export function CalendarEntryForm({ open, onOpenChange, entry, defaultDate }: Props) {
  const save = useSaveCalendarEntry();
  const { data: briefs } = useCampaignBriefs();

  const [title, setTitle] = useState(entry?.title ?? '');
  const [contentType, setContentType] = useState<CalendarEntryContentType>(entry?.contentType ?? 'blog_post');
  const [channel, setChannel] = useState<CalendarChannel | ''>(entry?.channel ?? '');
  const [status, setStatus] = useState<CalendarEntryStatus>(entry?.status ?? 'idea');
  const [plannedDate, setPlannedDate] = useState(entry?.plannedDate ?? defaultDate ?? '');
  const [campaignId, setCampaignId] = useState<string>(entry?.campaignId ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: entry?.id,
        data: {
          title,
          contentType,
          plannedDate,
          channel: channel || null,
          status,
          campaignId: campaignId || null,
          notes: notes || null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Entry' : 'New Calendar Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="entry-title">Title *</Label>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry title"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Content Type *</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as CalendarEntryContentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog_post">Blog Post</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="ad_copy">Ad Copy</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Channel</Label>
              <Select
                value={channel || NONE_VALUE}
                onValueChange={(v) => setChannel(v === NONE_VALUE ? '' : (v as CalendarChannel))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="entry-date">Planned Date *</Label>
              <Input
                id="entry-date"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CalendarEntryStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="briefed">Briefed</SelectItem>
                  <SelectItem value="drafting">Drafting</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="repurposed">Repurposed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {briefs && briefs.length > 0 && (
            <div className="space-y-1">
              <Label>Campaign</Label>
              <Select
                value={campaignId || NONE_VALUE}
                onValueChange={(v) => setCampaignId(v === NONE_VALUE ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {briefs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="entry-notes">Notes</Label>
            <Textarea
              id="entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !title.trim() || !plannedDate}>
              {save.isPending ? 'Saving…' : entry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
