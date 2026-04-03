'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CampaignBrief, CalendarEntry, CalendarEntryStatus } from '../types';

// ── Query Keys ────────────────────────────────────────────────────────────────

export const calendarKeys = {
  campaigns: (filters?: Record<string, string>) => ['campaign-briefs', filters] as const,
  campaign: (id: string) => ['campaign-briefs', id] as const,
  entries: (year: number, month: number, filters?: Record<string, string>) =>
    ['content-calendar', year, month, filters] as const,
  kanban: (filters?: Record<string, string>) => ['content-calendar', 'kanban', filters] as const,
};

// ── Campaign Brief Hooks ───────────────────────────────────────────────────────

export function useCampaignBriefs(filters?: { brandId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.brandId) params.set('brandId', filters.brandId);
  if (filters?.status) params.set('status', filters.status);

  return useQuery({
    queryKey: calendarKeys.campaigns(filters as Record<string, string>),
    queryFn: async () => {
      const qs = params.toString();
      const res = await fetch(`/api/campaign-briefs${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch campaign briefs');
      return res.json() as Promise<CampaignBrief[]>;
    },
  });
}

export function useSaveCampaignBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Partial<CampaignBrief> & { title: string } }) => {
      const url = id ? `/api/campaign-briefs/${id}` : '/api/campaign-briefs';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save campaign brief');
      return res.json() as Promise<CampaignBrief>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-briefs'] }),
  });
}

export function useDeleteCampaignBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaign-briefs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campaign brief');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-briefs'] }),
  });
}

// ── Calendar Entry Hooks ───────────────────────────────────────────────────────

export function useCalendarEntries(
  year: number,
  month: number,
  filters?: { brandId?: string; campaignId?: string },
) {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (filters?.brandId) params.set('brandId', filters.brandId);
  if (filters?.campaignId) params.set('campaignId', filters.campaignId);

  return useQuery({
    queryKey: calendarKeys.entries(year, month, filters as Record<string, string>),
    queryFn: async () => {
      const res = await fetch(`/api/content-calendar?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch calendar entries');
      return res.json() as Promise<CalendarEntry[]>;
    },
  });
}

export function useKanbanEntries(filters?: { brandId?: string; campaignId?: string }) {
  const params = new URLSearchParams();
  if (filters?.brandId) params.set('brandId', filters.brandId);
  if (filters?.campaignId) params.set('campaignId', filters.campaignId);

  return useQuery({
    queryKey: calendarKeys.kanban(filters as Record<string, string>),
    queryFn: async () => {
      const qs = params.toString();
      const res = await fetch(`/api/content-calendar/kanban${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch kanban entries');
      return res.json() as Promise<Record<CalendarEntryStatus, CalendarEntry[]>>;
    },
  });
}

export function useSaveCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id?: string;
      data: Partial<CalendarEntry> & { title: string; contentType: string; plannedDate: string };
    }) => {
      const url = id ? `/api/content-calendar/${id}` : '/api/content-calendar';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save calendar entry');
      return res.json() as Promise<CalendarEntry>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-calendar'] }),
  });
}

export function useDeleteCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-calendar/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete calendar entry');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-calendar'] }),
  });
}

export function useUpdateEntryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CalendarEntryStatus }) => {
      const res = await fetch(`/api/content-calendar/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update entry status');
      return res.json() as Promise<CalendarEntry>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-calendar'] }),
  });
}
