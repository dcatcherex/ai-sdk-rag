import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface DocumentItem {
  id: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DocumentDetail {
  document: DocumentItem;
  chunks: Array<{
    id: string;
    documentId: string;
    content: string;
    chunkIndex: number;
    metadata: Record<string, any>;
    createdAt: string;
  }>;
}

export interface DocumentStats {
  totalDocuments: number;
  totalChunks: number;
  categories: Array<{ name: string; count: number }>;
}

export function useDocuments(
  page = 1,
  limit = 20,
  category?: string,
  search?: string
) {
  return useQuery<DocumentListResponse>({
    queryKey: ['documents', page, limit, category, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (category) params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(`/api/rag/documents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
  });
}

export function useDocument(id: string | null) {
  return useQuery<DocumentDetail>({
    queryKey: ['documents', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/rag/documents/${id}`);
      if (!res.ok) throw new Error('Failed to fetch document');
      return res.json();
    },
  });
}

export function useDocumentStats() {
  return useQuery<DocumentStats>({
    queryKey: ['documents', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/rag/documents/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      file?: File;
      url?: string;
      text?: string;
      title?: string;
      category?: string;
    }) => {
      const formData = new FormData();
      if (data.file) formData.append('file', data.file);
      if (data.url) formData.append('url', data.url);
      if (data.text) formData.append('text', data.text);
      if (data.title) formData.append('title', data.title);
      if (data.category) formData.append('category', data.category);

      const res = await fetch('/api/rag/documents', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rag/documents/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
