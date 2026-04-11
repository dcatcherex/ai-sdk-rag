'use client';

import { useQuery } from '@tanstack/react-query';

export type UserStatus = {
  id: string;
  name: string;
  email: string;
  approved: boolean;
};

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

async function fetchUserStatus(): Promise<UserStatus> {
  const response = await fetch('/api/user/status', {
    cache: 'no-store',
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<UserStatus>;
}

export function useUserStatus() {
  return useQuery<UserStatus>({
    queryKey: ['user-status'],
    queryFn: fetchUserStatus,
    retry: false,
  });
}
