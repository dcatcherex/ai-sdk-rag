'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RichMenuAreaInput } from './use-rich-menus';

export type MenuTemplate = {
  id: string;
  userId: string;
  name: string;
  chatBarText: string;
  areas: RichMenuAreaInput[];
  createdAt: string;
  updatedAt: string;
};

const QUERY_KEY = ['line-oa-menu-templates'] as const;

export const useMenuTemplates = () =>
  useQuery<MenuTemplate[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/line-oa/menu-templates');
      if (!res.ok) throw new Error('Failed to load templates');
      const data = (await res.json()) as { templates: MenuTemplate[] };
      return data.templates;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useSaveMenuTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; chatBarText: string; areas: RichMenuAreaInput[] }) => {
      const res = await fetch('/api/line-oa/menu-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { template: MenuTemplate };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useDeleteMenuTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/line-oa/menu-templates/${templateId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};
