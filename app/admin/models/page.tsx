'use client';

import { BrainCircuitIcon } from 'lucide-react';
import { availableModels, type ModelOption } from '@/lib/ai';
import { ModelsTableInner } from '@/features/models/components/models-table';
import { useAdminEnabledModels } from '@/features/models/hooks/use-admin-enabled-models';

export default function AdminModelsPage() {
  const { enabledModelIds, enabledModels, toggleModel, setEnabledModelIds, isLoading } =
    useAdminEnabledModels();

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BrainCircuitIcon className="size-6" />
          AI Models
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control which models are available platform-wide. Users can only enable models
          from this list in their personal settings.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ModelsTableInner
            models={availableModels as ModelOption[]}
            enabledModelIds={enabledModelIds}
            enabledCount={enabledModels.length}
            toggleModel={toggleModel}
            setEnabledModelIds={setEnabledModelIds}
          />
        </div>
      )}
    </div>
  );
}
