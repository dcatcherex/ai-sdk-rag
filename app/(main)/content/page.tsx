import { Suspense } from 'react';

import { ContentHubPage } from '@/features/content-hub/components/content-hub-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading content hub...</div>}>
      <ContentHubPage />
    </Suspense>
  );
}
