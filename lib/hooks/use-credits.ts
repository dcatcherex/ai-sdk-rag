import { useQuery, useQueryClient } from '@tanstack/react-query';

type CreditTransaction = {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string | null;
  createdAt: string;
};

type CreditsResponse = {
  balance: number;
  transactions: CreditTransaction[];
};

export const useCredits = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<CreditsResponse>({
    queryKey: ['credits'],
    queryFn: async () => {
      const response = await fetch('/api/credits');
      if (!response.ok) {
        throw new Error('Failed to load credits');
      }
      return response.json() as Promise<CreditsResponse>;
    },
    refetchInterval: 60_000, // refresh every 60s
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['credits'] });
  };

  return {
    balance: data?.balance ?? 0,
    transactions: data?.transactions ?? [],
    isLoading,
    error,
    invalidate,
  };
};
