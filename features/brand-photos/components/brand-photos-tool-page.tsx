'use client';

import { Images } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { ToolPageProps } from '@/features/tools/registry/page-loaders';

export function BrandPhotosToolPage({ manifest }: ToolPageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
      <Images className="h-10 w-10 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium">Brand Photos moved</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Photos are now managed per brand so each brand has its own pool.
          <br />
          Go to <strong>Settings → Brands</strong>, open a brand, and use the <strong>Photos</strong> tab.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/settings?section=brands">Go to Brands</Link>
      </Button>
    </div>
  );
}
