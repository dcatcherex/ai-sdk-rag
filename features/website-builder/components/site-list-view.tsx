'use client';

import { Globe, Trash2, ExternalLink, Eye, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WebsiteRecord, WebsiteStatus } from '../types';

function StatusBadge({ status }: { status: WebsiteStatus }) {
  const config: Record<WebsiteStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    draft: { label: 'Draft', variant: 'secondary', icon: <Clock className="size-3" /> },
    generating: { label: 'Generating', variant: 'secondary', icon: <Loader2 className="size-3 animate-spin" /> },
    ready: { label: 'Ready', variant: 'default', icon: <CheckCircle className="size-3" /> },
    publishing: { label: 'Publishing', variant: 'secondary', icon: <Loader2 className="size-3 animate-spin" /> },
    published: { label: 'Published', variant: 'default', icon: <Globe className="size-3" /> },
    failed: { label: 'Failed', variant: 'destructive', icon: <AlertCircle className="size-3" /> },
  };
  const { label, variant, icon } = config[status] ?? config.draft;
  return (
    <Badge variant={variant} className="gap-1 text-xs">
      {icon}
      {label}
    </Badge>
  );
}

type Props = {
  websites: WebsiteRecord[];
  isLoading: boolean;
  onSelect: (site: WebsiteRecord) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
};

export function SiteListView({ websites, isLoading, onSelect, onDelete, onCreateNew }: Props) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Your Websites</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{websites.length} site{websites.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={onCreateNew}>
          <Globe className="size-4 mr-2" />
          Build new site
        </Button>
      </div>

      {websites.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Globe className="size-10 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-base font-medium mb-1">No websites yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Describe your business and let AI build your website in seconds.</p>
          <Button onClick={onCreateNew}>Build your first site</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {websites.map(site => (
            <div
              key={site.id}
              className="group border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => onSelect(site)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">{site.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{site.templateSlug.replace('-', ' ')} template</p>
                </div>
                <StatusBadge status={site.status} />
              </div>

              {site.liveUrl && (
                <a
                  href={site.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline mb-3"
                >
                  <ExternalLink className="size-3" />
                  {site.liveUrl.replace(/^https?:\/\//, '')}
                </a>
              )}

              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={e => { e.stopPropagation(); onSelect(site); }}
                >
                  <Eye className="size-3 mr-1" />
                  {site.status === 'ready' || site.status === 'published' ? 'Edit' : 'View'}
                </Button>
                {site.liveUrl && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                    <a href={site.liveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                      <ExternalLink className="size-3 mr-1" />
                      Live site
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`Delete "${site.name}"? This cannot be undone.`)) onDelete(site.id);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
