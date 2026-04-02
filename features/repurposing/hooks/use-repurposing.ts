'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentPieceKeys } from '@/features/long-form/hooks/use-content-pieces';
import type { ContentPiece } from '@/features/long-form/types';
import type { RepurposeInput } from '../types';

export function useRepurpose() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RepurposeInput): Promise<ContentPiece[]> => {
      const res = await fetch('/api/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ContentPiece[]>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentPieceKeys.all });
    },
  });
}
