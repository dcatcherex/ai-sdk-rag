'use client';

import { useState } from 'react';
import { PencilIcon, Trash2Icon, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useDeleteCampaignBrief } from '../hooks/use-calendar';
import { CampaignBriefForm } from './campaign-brief-form';
import type { CampaignBrief } from '../types';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

type Props = {
  brief: CampaignBrief;
};

export function CampaignBriefCard({ brief }: Props) {
  const [editing, setEditing] = useState(false);
  const del = useDeleteCampaignBrief();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{brief.title}</h3>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[brief.status] ?? statusColors['draft']}`}
            >
              {brief.status}
            </span>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(true)}>
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:text-destructive"
              onClick={() => del.mutate(brief.id)}
              disabled={del.isPending}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {brief.goal && (
            <p className="text-muted-foreground line-clamp-2">{brief.goal}</p>
          )}
          {brief.channels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {brief.channels.map((ch) => (
                <span
                  key={ch}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground"
                >
                  {ch}
                </span>
              ))}
            </div>
          )}
          {(brief.startDate || brief.endDate) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarIcon className="size-3" />
              {brief.startDate ?? '—'} → {brief.endDate ?? '—'}
            </div>
          )}
        </CardContent>
      </Card>

      <CampaignBriefForm open={editing} onOpenChange={setEditing} brief={brief} />
    </>
  );
}
