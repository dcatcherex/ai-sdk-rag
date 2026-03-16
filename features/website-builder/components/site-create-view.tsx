'use client';

import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateSlug } from '../types';

const TEMPLATES: Array<{ slug: WebsiteTemplateSlug; label: string; description: string }> = [
  { slug: 'service-landing', label: 'Service Landing', description: 'Convert visitors to clients with a focused page' },
  { slug: 'portfolio', label: 'Portfolio', description: 'Showcase your work and skills' },
  { slug: 'consulting', label: 'Consulting', description: 'Professional consulting firm presence' },
  { slug: 'personal', label: 'Personal', description: 'Minimalist personal brand site' },
];

type Props = {
  onBack: () => void;
  onGenerate: (data: { businessDescription: string; templateSlug: WebsiteTemplateSlug; siteName: string }) => void;
  isGenerating: boolean;
  error?: string | null;
};

export function SiteCreateView({ onBack, onGenerate, isGenerating, error }: Props) {
  const [siteName, setSiteName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<WebsiteTemplateSlug>('service-landing');

  const canSubmit = siteName.trim().length > 0 && description.trim().length >= 10 && !isGenerating;

  return (
    <div className="p-6 max-w-2xl">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="size-4 mr-1" />
        Back
      </Button>

      <h2 className="text-xl font-semibold mb-1">Build a new website</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Describe your business and AI will generate a complete website in seconds. Costs 100 credits.
      </p>

      <div className="space-y-5">
        <div>
          <Label htmlFor="site-name">Business / site name</Label>
          <Input
            id="site-name"
            className="mt-1.5"
            placeholder="e.g. Bright Space Design Studio"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        <div>
          <Label htmlFor="description">Describe your business</Label>
          <Textarea
            id="description"
            className="mt-1.5 resize-none"
            rows={6}
            placeholder="Tell us about your business, what you do, who you serve, your key services, and any specific messaging you want. The more detail you provide, the better your website will be."
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={isGenerating}
          />
          <p className="text-xs text-muted-foreground mt-1">{description.length} / 2000 chars</p>
        </div>

        <div>
          <Label className="mb-2 block">Template style</Label>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map(t => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setTemplate(t.slug)}
                disabled={isGenerating}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all hover:border-primary/60',
                  template === t.slug ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border',
                )}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          onClick={() => onGenerate({ businessDescription: description.trim(), templateSlug: template, siteName: siteName.trim() })}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Generating your website…
            </>
          ) : (
            'Generate website (100 credits)'
          )}
        </Button>
      </div>
    </div>
  );
}
