'use client';

import { useState } from 'react';
import { Building2Icon, DownloadIcon, PlusIcon } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { BrandsSection } from '@/features/brands/components/brands-section';

export default function BrandsPage() {
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [showBrandImport, setShowBrandImport] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Brands"
        description="Brand identity, tone of voice, creative assets, photos, guardrails, and sharing"
        icon={<Building2Icon className="size-4" />}
        action={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBrandImport((value) => !value)}>
              <DownloadIcon className="mr-1.5 size-3.5" />
              Import JSON
            </Button>
            <Button size="sm" onClick={() => setIsCreatingBrand(true)}>
              <PlusIcon className="mr-1.5 size-3.5" />
              New Brand
            </Button>
          </div>
        )}
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <BrandsSection
          isCreating={isCreatingBrand}
          onCreatingChange={setIsCreatingBrand}
          showImport={showBrandImport}
          onShowImportChange={setShowBrandImport}
        />
      </div>
    </div>
  );
}
