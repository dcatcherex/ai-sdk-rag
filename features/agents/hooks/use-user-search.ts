import { useQuery } from '@tanstack/react-query';
import type { SharedUser } from '../types';

export const useUserSearch = (query: string) =>
  useQuery<SharedUser[]>({
    queryKey: ['user-search', query],
    queryFn: async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      return (await res.json() as { users: SharedUser[] }).users;
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
