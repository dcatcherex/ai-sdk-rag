'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CertificateJob, CertificateTemplate, CertificateTemplateType, PrintSheetSettings, TextFieldConfig } from '../types';

const QUERY_KEY = ['certificate-templates'];
const JOBS_QUERY_KEY = ['certificate-jobs'];

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

export function useCertificateJobs(templateId?: string) {
  return useCertificateJobsWithFilters({ templateId });
}

export function useCertificateJobsWithFilters(filters?: {
  source?: CertificateJob['source'] | 'all';
  status?: CertificateJob['status'] | 'all';
  templateId?: string;
}) {
  return useQuery({
    queryKey: [
      ...JOBS_QUERY_KEY,
      filters?.templateId ?? 'all',
      filters?.source ?? 'all',
      filters?.status ?? 'all',
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.templateId) {
        params.set('templateId', filters.templateId);
      }

      if (filters?.source && filters.source !== 'all') {
        params.set('source', filters.source);
      }

      if (filters?.status && filters.status !== 'all') {
        params.set('status', filters.status);
      }

      const query = params.size > 0 ? `?${params.toString()}` : '';
      const res = await fetch(`/api/certificate/jobs${query}`);
      if (!res.ok) throw new Error('Failed to load certificate jobs');
      const data = await res.json();
      return data.jobs as CertificateJob[];
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fields,
      backFields,
      templateType,
      printSettings,
    }: {
      id: string;
      fields: TextFieldConfig[];
      backFields?: TextFieldConfig[];
      templateType?: CertificateTemplateType;
      printSettings?: PrintSheetSettings;
    }) => {
      const res = await fetch(`/api/certificate/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, backFields, templateType, printSettings }),
      });
      if (!res.ok) throw new Error('Update failed');
      return (await res.json()).template as CertificateTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    },
  });
}

export function useReplaceTemplateImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData, side = 'front' }: { id: string; formData: FormData; side?: 'front' | 'back' }) => {
      formData.set('side', side);
      const res = await fetch(`/api/certificate/templates/${id}`, {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) throw new Error('Image replace failed');
      return (await res.json()).template as CertificateTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/certificate/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    },
  });
}
