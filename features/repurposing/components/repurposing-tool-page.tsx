'use client';

import { useState } from 'react';
import { RefreshCw, Copy, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRepurpose } from '../hooks/use-repurposing';
import type { ToolManifest } from '@/features/tools/registry/types';
import type { ContentPiece } from '@/features/long-form/types';
import type { RepurposeFormat } from '../types';

type Props = { manifest: ToolManifest };

const FORMAT_OPTIONS: { value: RepurposeFormat; label: string; description: string }[] = [
  { value: 'blog_post', label: 'Blog Post', description: 'SEO-optimized, 600-800 words' },
  { value: 'newsletter', label: 'Newsletter', description: 'Personal, conversational' },
  { value: 'linkedin_post', label: 'LinkedIn Post', description: '200-300 words' },
  { value: 'tweet_thread', label: 'Tweet Thread', description: '8-12 tweets' },
  { value: 'social_caption', label: 'Social Caption', description: '150 chars + hashtags' },
  { value: 'ad_copy', label: 'Ad Copy', description: 'Headline + benefits + CTA' },
  { value: 'email_sequence', label: 'Email Sequence', description: '3 emails' },
];

const FORMAT_BADGE_COLORS: Record<RepurposeFormat, string> = {
  blog_post: 'bg-blue-100 text-blue-800',
  newsletter: 'bg-purple-100 text-purple-800',
  linkedin_post: 'bg-sky-100 text-sky-800',
  tweet_thread: 'bg-cyan-100 text-cyan-800',
  social_caption: 'bg-pink-100 text-pink-800',
  ad_copy: 'bg-rose-100 text-rose-800',
  email_sequence: 'bg-orange-100 text-orange-800',
};

export function RepurposingToolPage({ manifest }: Props) {
  const [sourceText, setSourceText] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [tone, setTone] = useState('');
  const [brandContext, setBrandContext] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<RepurposeFormat[]>([
    'linkedin_post',
    'tweet_thread',
  ]);
  const [results, setResults] = useState<ContentPiece[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const repurposeMutation = useRepurpose();

  function toggleFormat(format: RepurposeFormat) {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  }

  async function handleRepurpose() {
    const pieces = await repurposeMutation.mutateAsync({
      sourceText,
      sourceTitle: sourceTitle || undefined,
      targetFormats: selectedFormats,
      brandContext: brandContext || undefined,
      tone: tone || undefined,
    });
    setResults(pieces);
  }

  async function handleCopy(body: string | null, id: string) {
    if (!body) return;
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const canRepurpose =
    sourceText.trim().length >= 50 && selectedFormats.length > 0 && !repurposeMutation.isPending;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{manifest.title}</h1>
          <p className="text-sm text-muted-foreground">{manifest.description}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  placeholder="e.g. How We Grew to $1M ARR"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Paste your content *
                  <span className="ml-1 font-normal text-muted-foreground">
                    (min. 50 characters)
                  </span>
                </label>
                <Textarea
                  placeholder="Paste your article, blog post, video transcript, or any text here..."
                  rows={8}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {sourceText.length} characters
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {FORMAT_OPTIONS.map((option) => {
                  const isSelected = selectedFormats.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleFormat(option.value)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border hover:border-border/80 hover:bg-muted/40'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tone</label>
                <Input
                  placeholder="e.g. professional, casual, witty..."
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Brand Context</label>
                <Textarea
                  placeholder="Brand voice notes, guidelines..."
                  rows={3}
                  value={brandContext}
                  onChange={(e) => setBrandContext(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {repurposeMutation.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {repurposeMutation.error.message}
            </p>
          )}

          <Button onClick={handleRepurpose} disabled={!canRepurpose} className="w-full">
            {repurposeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Repurposing {selectedFormats.length} format
                {selectedFormats.length !== 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Repurpose into {selectedFormats.length} format
                {selectedFormats.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <RefreshCw className="mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                Repurposed content will appear here
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Paste your content, select formats, and click Repurpose.
              </p>
            </div>
          ) : (
            results.map((piece) => {
              const repurposedFormat = (
                (piece.metadata as Record<string, unknown>)?.repurposedFormat
              ) as RepurposeFormat | undefined;
              const formatLabel = repurposedFormat
                ? FORMAT_OPTIONS.find((f) => f.value === repurposedFormat)?.label ?? piece.contentType
                : piece.contentType;
              const badgeColor = repurposedFormat
                ? FORMAT_BADGE_COLORS[repurposedFormat]
                : 'bg-gray-100 text-gray-800';

              return (
                <Card key={piece.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}
                        >
                          {formatLabel}
                        </span>
                        <h3 className="mt-1.5 text-sm font-semibold">{piece.title}</h3>
                        {piece.body && (
                          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                            {piece.body.slice(0, 400)}
                            {piece.body.length > 400 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="Copy content"
                        onClick={() => void handleCopy(piece.body, piece.id)}
                      >
                        <Copy
                          className={`h-4 w-4 ${
                            copiedId === piece.id ? 'text-green-600' : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
