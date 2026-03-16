'use client';

import { useState } from 'react';
import { CheckCircle, Copy, ExternalLink, Globe, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  siteName: string;
  liveUrl: string;
  onBack: () => void;
  onEditSite: () => void;
};

export function SitePublishedView({ siteName, liveUrl, onBack, onEditSite }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-lg">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="size-4 mr-1" />
        Back to sites
      </Button>

      <div className="text-center mb-8">
        <div className="inline-flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
          <CheckCircle className="size-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{siteName} is live!</h2>
        <p className="text-muted-foreground">Your website has been deployed to Cloudflare Pages and is accessible worldwide.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border p-4 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">Live URL</p>
          <div className="flex gap-2">
            <Input value={liveUrl} readOnly className="text-sm font-mono" />
            <Button size="icon" variant="outline" onClick={handleCopy} title="Copy URL">
              <Copy className={`size-4 ${copied ? 'text-green-600' : ''}`} />
            </Button>
          </div>
          {copied && <p className="text-xs text-green-600 mt-1">Copied to clipboard!</p>}
        </div>

        <div className="flex gap-3">
          <Button asChild className="flex-1">
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Globe className="size-4 mr-2" />
              Visit live site
              <ExternalLink className="size-3.5 ml-1.5 opacity-70" />
            </a>
          </Button>
          <Button variant="outline" onClick={onEditSite} className="flex-1">
            Edit site
          </Button>
        </div>

        <div className="rounded-xl border p-4 space-y-2">
          <p className="text-sm font-medium">Share your site</p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(liveUrl)}&text=${encodeURIComponent(`Check out my new website: ${siteName}`)}`, '_blank')}
            >
              Share on X
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(liveUrl)}&title=${encodeURIComponent(siteName)}`, '_blank')}
            >
              Share on LinkedIn
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
