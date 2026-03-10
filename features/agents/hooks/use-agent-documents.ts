import { useQuery } from '@tanstack/react-query';

export type DocumentSummary = {
  id: string;
  metadata: { title?: string; [key: string]: unknown };
  createdAt: string;
};

export const useUserDocuments = () =>
  useQuery<DocumentSummary[]>({
    queryKey: ['user-documents'],
    queryFn: async () => {
      const res = await fetch('/api/rag/documents?limit=100');
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json() as { documents: DocumentSummary[] };
      return data.documents;
    },
    staleTime: 60_000,
  });
