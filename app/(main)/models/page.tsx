import { ModelsTable } from '@/features/models/components/models-table';
import { PageHeader } from '@/components/page-header';

export default function ModelsPage() {
  return (
    <>
      <PageHeader title="AI Models" description="Enable or disable models available in your chat." />
      <div className="flex-1 overflow-hidden">
        <ModelsTable />
      </div>
    </>
  );
}
