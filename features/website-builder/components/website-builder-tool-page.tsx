'use client';

import { useState } from 'react';
import type { ToolManifest } from '@/features/tools/registry/types';
import type { WebsiteRecord, WebsiteTemplateSlug } from '../types';
import { useWebsites, useDeleteWebsite } from '../hooks/use-websites';
import { useGenerateWebsite } from '../hooks/use-website-editor';
import { SiteListView } from './site-list-view';
import { SiteCreateView } from './site-create-view';
import { SitePreviewView } from './site-preview-view';
import { SitePublishedView } from './site-published-view';

type View = 'list' | 'create' | 'preview' | 'published';

type Props = { manifest: ToolManifest };

export function WebsiteBuilderToolPage({ manifest: _manifest }: Props) {
  const [view, setView] = useState<View>('list');
  const [selectedSite, setSelectedSite] = useState<WebsiteRecord | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { data, isLoading } = useWebsites();
  const deleteMutation = useDeleteWebsite();
  const generateMutation = useGenerateWebsite();

  const websites = data?.websites ?? [];

  const handleGenerate = async (input: { businessDescription: string; templateSlug: WebsiteTemplateSlug; siteName: string }) => {
    setGenerateError(null);
    try {
      const result = await generateMutation.mutateAsync(input);
      const newSite: WebsiteRecord = {
        id: result.data.websiteId,
        userId: '',
        name: input.siteName,
        slug: input.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        templateSlug: input.templateSlug,
        status: 'ready',
        siteDataJson: result.data.siteData,
        renderedHtmlKey: null,
        renderedHtmlUrl: result.data.htmlUrl,
        pagesProjectName: null,
        pagesDeploymentId: null,
        liveUrl: null,
        customDomain: null,
        error: null,
        generationCount: 1,
        editCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSelectedSite(newSite);
      setView('preview');
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleSelectSite = (site: WebsiteRecord) => {
    setSelectedSite(site);
    if (site.status === 'published' && site.liveUrl) {
      setPublishedUrl(site.liveUrl);
      setView('published');
    } else {
      setView('preview');
    }
  };

  const handlePublished = (liveUrl: string) => {
    setPublishedUrl(liveUrl);
    if (selectedSite) {
      setSelectedSite({ ...selectedSite, status: 'published', liveUrl });
    }
    setView('published');
  };

  const handleSiteUpdated = (updates: Partial<WebsiteRecord>) => {
    if (selectedSite) {
      setSelectedSite({ ...selectedSite, ...updates });
    }
  };

  if (view === 'create') {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <SiteCreateView
          onBack={() => setView('list')}
          onGenerate={handleGenerate}
          isGenerating={generateMutation.isPending}
          error={generateError}
        />
      </div>
    );
  }

  if (view === 'preview' && selectedSite) {
    return (
      <SitePreviewView
        site={selectedSite}
        onBack={() => setView('list')}
        onPublished={handlePublished}
        onSiteUpdated={handleSiteUpdated}
      />
    );
  }

  if (view === 'published' && selectedSite && publishedUrl) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <SitePublishedView
          siteName={selectedSite.name}
          liveUrl={publishedUrl}
          onBack={() => setView('list')}
          onEditSite={() => setView('preview')}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SiteListView
        websites={websites}
        isLoading={isLoading}
        onSelect={handleSelectSite}
        onDelete={handleDelete}
        onCreateNew={() => setView('create')}
      />
    </div>
  );
}
