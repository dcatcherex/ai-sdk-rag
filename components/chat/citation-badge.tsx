'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpenIcon } from 'lucide-react';

interface CitationBadgeProps {
  file: string;
  page: number;
  section?: string;
}

export function CitationBadge({ file, page, section }: CitationBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="mx-0.5 inline-flex cursor-default items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300">
            <BookOpenIcon className="size-2.5" />
            {file}, p.{page}
          </span>
        </TooltipTrigger>
        {section && (
          <TooltipContent side="top" className="max-w-xs text-xs">
            Section: {section}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
