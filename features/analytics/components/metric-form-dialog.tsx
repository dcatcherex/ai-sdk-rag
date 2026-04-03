'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTrackMetric } from '../hooks/use-analytics';
import type { MetricPlatform } from '../types';

const PLATFORMS: { value: MetricPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'email', label: 'Email' },
  { value: 'blog', label: 'Blog' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'Other' },
];

type Props = {
  contentPieceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MetricFormDialog({ contentPieceId, open, onOpenChange }: Props) {
  const [platform, setPlatform] = useState<MetricPlatform>('blog');
  const [views, setViews] = useState('');
  const [clicks, setClicks] = useState('');
  const [impressions, setImpressions] = useState('');
  const [engagement, setEngagement] = useState('');
  const [conversions, setConversions] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const trackMutation = useTrackMetric();

  const handleSubmit = () => {
    setError('');
    trackMutation.mutate(
      {
        contentPieceId,
        platform,
        views: views ? parseInt(views, 10) : undefined,
        clicks: clicks ? parseInt(clicks, 10) : undefined,
        impressions: impressions ? parseInt(impressions, 10) : undefined,
        engagement: engagement ? parseInt(engagement, 10) : undefined,
        conversions: conversions ? parseInt(conversions, 10) : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setViews(''); setClicks(''); setImpressions(''); setEngagement(''); setConversions(''); setNotes('');
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Performance Metrics</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as MetricPlatform)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Views</Label>
              <Input
                type="number" min={0} value={views}
                onChange={(e) => setViews(e.target.value)}
                placeholder="0" className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Impressions</Label>
              <Input
                type="number" min={0} value={impressions}
                onChange={(e) => setImpressions(e.target.value)}
                placeholder="0" className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Clicks</Label>
              <Input
                type="number" min={0} value={clicks}
                onChange={(e) => setClicks(e.target.value)}
                placeholder="0" className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Engagement</Label>
              <Input
                type="number" min={0} value={engagement}
                onChange={(e) => setEngagement(e.target.value)}
                placeholder="0" className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Conversions</Label>
              <Input
                type="number" min={0} value={conversions}
                onChange={(e) => setConversions(e.target.value)}
                placeholder="0" className="mt-1 h-8 text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context about this measurement…"
              rows={2}
              className="mt-1 resize-none text-sm"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={trackMutation.isPending}>
            {trackMutation.isPending ? 'Saving…' : 'Save metrics'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
