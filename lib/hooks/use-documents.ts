import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentAnalysis } from '@/lib/document-analysis';

export type { DocumentAnalysis };

export interface DocumentItem {
  id: string;
  content: string;
  originalContent?: string | null;
  processingStatus: string;
  processingMode?: string | null;
  storageMode?: string | null;
  analysisResult?: DocumentAnalysis | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

export interface UploadResponse {
  success: boolean;
  pendingDocumentId: string;
  title: string;
  analysisResult: DocumentAnalysis;
  processingMode: string;
  isImageBased?: boolean;
}

export type ProcessingMode = 'precise' | 'optimized' | 'raw';

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
  search?: string,
  processingMode?: string,
  sortBy?: string,
  sortDir?: string,
) {
  return useQuery<DocumentListResponse>({
    queryKey: ['documents', page, limit, category, search, processingMode, sortBy, sortDir],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      if (processingMode) params.set('processingMode', processingMode);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortDir) params.set('sortDir', sortDir);

      const res = await fetch(`/api/rag/documents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
  });
}

export function useBulkDeleteDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => fetch(`/api/rag/documents/${id}`, { method: 'DELETE' }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
      return res.json() as Promise<UploadResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useReprocessDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, processingMode, modelId }: { id: string; processingMode: ProcessingMode; modelId?: string }) => {
      const res = await fetch(`/api/rag/documents/${id}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processingMode, modelId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Reprocessing failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useProcessDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'clean_and_save' | 'save_as_is' }) => {
      const res = await fetch(`/api/rag/documents/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Processing failed');
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
