'use client';

import { useState } from 'react';
import { useCertificateJobsWithFilters, useTemplates } from '@/features/certificate/hooks/use-templates';
import { TemplateSelector } from '@/features/certificate/components/template-selector';
import { TemplateUploader } from '@/features/certificate/components/template-uploader';
import { FieldConfigurator } from '@/features/certificate/components/field-configurator';
import { CertificateForm } from '@/features/certificate/components/certificate-form';
import { BatchForm } from '@/features/certificate/components/batch-form';
import { JobHistory } from '@/features/certificate/components/job-history';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Plus } from 'lucide-react';
import type { CertificateJob, CertificateTemplate } from '@/features/certificate/types';
import type { ToolManifest } from '@/features/tools/registry/types';

type View = 'list' | 'upload' | 'configure';

type Props = { manifest: ToolManifest };

export function CertificateToolPage({ manifest }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [view, setView] = useState<View>('list');
  const [jobSourceFilter, setJobSourceFilter] = useState<CertificateJob['source'] | 'all'>('all');
  const [jobStatusFilter, setJobStatusFilter] = useState<CertificateJob['status'] | 'all'>('all');

  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const { data: jobs = [], isLoading: jobsLoading } = useCertificateJobsWithFilters({
    templateId: selectedTemplate?.id,
    source: jobSourceFilter,
    status: jobStatusFilter,
  });

  function handleSelectTemplate(t: CertificateTemplate) {
    setSelectedTemplate(t);
    setView('list');
    setJobSourceFilter('all');
    setJobStatusFilter('all');
  }

  function handleUploadDone(t: CertificateTemplate) {
    setSelectedTemplate(t);
    setView('configure');
  }

  function handleFieldsSaved(t: CertificateTemplate) {
    setSelectedTemplate(t);
    setView('list');
  }

  return (
    <>
      <PageHeader
        title={manifest.title}
        description={manifest.description}
        action={
          view === 'list' && (
            <Button size="sm" variant="outline" onClick={() => setView('upload')}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add template
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto space-y-6 p-4 md:p-6">
        {view === 'upload' ? (
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-border md:p-6">
            <TemplateUploader onDone={handleUploadDone} onCancel={() => setView('list')} />
          </div>
        ) : view === 'configure' && selectedTemplate ? (
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-border md:p-6">
            <FieldConfigurator
              template={selectedTemplate}
              onSaved={handleFieldsSaved}
              onTemplateUpdated={setSelectedTemplate}
              onCancel={() => setView('list')}
            />
          </div>
        ) : (
          <div>
            {templatesLoading ? (
              <p className="text-sm text-zinc-400">Loading templates…</p>
            ) : (
              <TemplateSelector
                templates={templates}
                selectedId={selectedTemplate?.id ?? null}
                onSelect={handleSelectTemplate}
              />
            )}
          </div>
        )}

        {view === 'list' && selectedTemplate && (
          <>
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-2 dark:bg-indigo-950/30">
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                Selected: <span className="font-bold">{selectedTemplate.name}</span>
              </p>
              <button
                onClick={() => setView('configure')}
                className="text-xs font-medium text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400"
              >
                Configure fields
              </button>
            </div>

            <Tabs defaultValue="single" className="w-full">
              <TabsList>
                <TabsTrigger value="single">Single</TabsTrigger>
                <TabsTrigger value="batch">Batch</TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="pt-4">
                <CertificateForm template={selectedTemplate} />
              </TabsContent>
              <TabsContent value="batch" className="pt-4">
                <BatchForm template={selectedTemplate} />
              </TabsContent>
            </Tabs>

            <JobHistory
              jobs={jobs}
              isLoading={jobsLoading}
              onSourceChange={setJobSourceFilter}
              onStatusChange={setJobStatusFilter}
              selectedSource={jobSourceFilter}
              selectedStatus={jobStatusFilter}
            />
          </>
        )}
      </div>
    </>
  );
}
