'use client';

import { useQuery } from '@tanstack/react-query';
import type { FlexTemplateRecord } from '../types';

export function useFlexTemplates() {
  return useQuery<FlexTemplateRecord[]>({
    queryKey: ['line-flex-templates'],
    queryFn: async () => {
      const res = await fetch('/api/line-oa/flex-templates');
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as { templates: FlexTemplateRecord[] };
      return json.templates;
    },
    staleTime: 5 * 60 * 1000,
  });
}
