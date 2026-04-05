'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type RichMenuAreaInput = {
  label: string;
  emoji: string;
  bgColor: string;
  bounds?: { x: number; y: number; width: number; height: number };
  action:
    | { type: 'message'; text: string }
    | { type: 'uri'; uri: string }
    | { type: 'postback'; data: string; displayText?: string }
    | { type: 'switch_agent'; agentId: string };
};

export type RichMenuRecord = {
  id: string;
  channelId: string;
  lineMenuId: string | null;
  name: string;
  chatBarText: string;
  areas: RichMenuAreaInput[];
  backgroundImageUrl: string | null;
  isDefault: boolean;
  status: 'draft' | 'active';
  createdAt: string;
  updatedAt: string;
};

export type CreateRichMenuInput = {
  name: string;
  chatBarText: string;
  areas: RichMenuAreaInput[];
};

const queryKey = (channelId: string) => ['rich-menus', channelId] as const;

export const useRichMenus = (channelId: string) =>
  useQuery<RichMenuRecord[]>({
    queryKey: queryKey(channelId),
    queryFn: async () => {
      const res = await fetch(`/api/line-oa/${channelId}/rich-menus`);
      if (!res.ok) throw new Error('Failed to load rich menus');
      const data = (await res.json()) as { menus: RichMenuRecord[] };
      return data.menus;
    },
    staleTime: 60_000,
  });

export const useCreateRichMenu = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRichMenuInput) => {
      const res = await fetch(`/api/line-oa/${channelId}/rich-menus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { menu: RichMenuRecord };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
};

export const useUpdateRichMenu = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateRichMenuInput> & { id: string }) => {
      const res = await fetch(`/api/line-oa/${channelId}/rich-menus/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { menu: RichMenuRecord };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
};

export const useDeleteRichMenu = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menuId: string) => {
      const res = await fetch(`/api/line-oa/${channelId}/rich-menus/${menuId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
};

export const useUploadRichMenuImage = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ menuId, file }: { menuId: string; file: File }) => {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/line-oa/${channelId}/rich-menus/${menuId}/upload-image`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { url: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
};

export const useDeployRichMenu = (channelId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ menuId, setAsDefault }: { menuId: string; setAsDefault: boolean }) => {
      const res = await fetch(`/api/line-oa/${channelId}/rich-menus/${menuId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setAsDefault }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { lineMenuId: string; isDefault: boolean };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
};
