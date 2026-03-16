'use client';

import { useState } from 'react';
import { ArrowLeft, Send, Loader2, Globe, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { WebsiteRecord } from '../types';
import { useEditWebsite, usePublishWebsite } from '../hooks/use-website-editor';

type Props = {
  site: WebsiteRecord;
  onBack: () => void;
  onPublished: (liveUrl: string) => void;
  onSiteUpdated: (updatedSite: Partial<WebsiteRecord>) => void;
};

export function SitePreviewView({ site, onBack, onPublished, onSiteUpdated }: Props) {
  const [editRequest, setEditRequest] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [currentHtmlUrl, setCurrentHtmlUrl] = useState(site.renderedHtmlUrl ?? '');
  const [editError, setEditError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const editMutation = useEditWebsite(site.id);
  const publishMutation = usePublishWebsite();

  const handleEdit = async () => {
    if (!editRequest.trim() || editMutation.isPending) return;
    setEditError(null);
    try {
      const result = await editMutation.mutateAsync({ editRequest: editRequest.trim() });
      const newUrl = result.data.htmlUrl;
      setCurrentHtmlUrl(newUrl);
      setIframeKey(k => k + 1);
      setEditRequest('');
      onSiteUpdated({ renderedHtmlUrl: newUrl });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Edit failed');
    }
  };

  const handlePublish = async () => {
    setPublishError(null);
    try {
      const result = await publishMutation.mutateAsync({ websiteId: site.id });
      onPublished(result.liveUrl);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-3 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-1">
          <ArrowLeft className="size-4 mr-1" />
          Sites
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{site.name}</h2>
        </div>
        {site.status === 'published' && site.liveUrl && (
          <Badge variant="default" className="gap-1 text-xs">
            <Globe className="size-3" />
            Published
          </Badge>
        )}
        <Button
          onClick={() => { setIframeKey(k => k + 1); }}
          variant="ghost"
          size="icon"
          className="size-8"
          title="Refresh preview"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* iframe preview — 2/3 */}
        <div className="flex-1 border-r bg-gray-50 relative">
          {currentHtmlUrl ? (
            <iframe
              key={iframeKey}
              src={currentHtmlUrl}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full"
              title="Website preview"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No preview available
            </div>
          )}
          {editMutation.isPending && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* AI edit panel — 1/3 */}
        <div className="w-80 flex flex-col flex-shrink-0">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold mb-1">Edit with AI</h3>
            <p className="text-xs text-muted-foreground">Describe changes in plain English. Simple edits: 10 credits. Adding/removing sections: 20 credits.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Quick prompts */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Quick edits</p>
              {[
                'Change the primary color to green',
                'Add a pricing section with 3 tiers',
                'Make the hero headline more compelling',
                'Add a FAQ section',
              ].map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setEditRequest(prompt)}
                  className="w-full text-left text-xs px-3 py-2 rounded-md border hover:border-primary/60 hover:bg-primary/5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t space-y-3">
            {editError && (
              <p className="text-xs text-destructive">{editError}</p>
            )}
            <Textarea
              placeholder="e.g. Change the hero headline to 'Transform Your Business'"
              value={editRequest}
              onChange={e => setEditRequest(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              disabled={editMutation.isPending}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEdit();
              }}
            />
            <Button
              onClick={handleEdit}
              disabled={!editRequest.trim() || editMutation.isPending}
              className="w-full"
              size="sm"
            >
              {editMutation.isPending ? (
                <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Applying…</>
              ) : (
                <><Send className="size-3.5 mr-1.5" /> Apply edit</>
              )}
            </Button>

            <div className="pt-2 border-t">
              {publishError && (
                <p className="text-xs text-destructive mb-2">{publishError}</p>
              )}
              {site.liveUrl && (
                <a
                  href={site.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                >
                  <ExternalLink className="size-3" />
                  View live site
                </a>
              )}
              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending || site.status === 'publishing'}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {publishMutation.isPending ? (
                  <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Publishing…</>
                ) : (
                  <><Globe className="size-3.5 mr-1.5" /> {site.status === 'published' ? 'Re-publish' : 'Publish (5 credits)'}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
