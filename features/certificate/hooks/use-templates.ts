'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CertificateTemplate, TextFieldConfig } from '../types';

const QUERY_KEY = ['certificate-templates'];

export function useTemplates() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/certificate/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      const data = await res.json();
      return data.templates as CertificateTemplate[];
    },
  });
}

export function useUploadTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/certificate/templates', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      return (await res.json()).template as CertificateTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: TextFieldConfig[] }) => {
      const res = await fetch(`/api/certificate/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error('Update failed');
      return (await res.json()).template as CertificateTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/certificate/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
