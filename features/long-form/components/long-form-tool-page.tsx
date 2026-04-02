'use client';

import { useState } from 'react';
import { FileText, Copy, Trash2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContentPieces, useSaveContentPiece, useDeleteContentPiece } from '../hooks/use-content-pieces';
import type { ToolManifest } from '@/features/tools/registry/types';
import type { ContentType } from '../types';

type Props = { manifest: ToolManifest };

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog_post: 'Blog Post',
  newsletter: 'Newsletter',
  email_sequence: 'Email Sequence',
  landing_page: 'Landing Page',
  linkedin_post: 'LinkedIn Post',
  tweet_thread: 'Tweet Thread',
  ad_copy: 'Ad Copy',
};

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  blog_post: 'bg-blue-100 text-blue-800',
  newsletter: 'bg-purple-100 text-purple-800',
  email_sequence: 'bg-orange-100 text-orange-800',
  landing_page: 'bg-green-100 text-green-800',
  linkedin_post: 'bg-sky-100 text-sky-800',
  tweet_thread: 'bg-cyan-100 text-cyan-800',
  ad_copy: 'bg-rose-100 text-rose-800',
};

type GenerateForm = {
  contentType: ContentType;
  topic: string;
  targetKeyword: string;
  tone: string;
  wordCount: string;
  brandContext: string;
  outline: string;
  // newsletter / email / landing page fields
  audience: string;
  goal: string;
  product: string;
  sequenceLength: string;
  targetAudience: string;
  keyBenefit: string;
};

const DEFAULT_FORM: GenerateForm = {
  contentType: 'blog_post',
  topic: '',
  targetKeyword: '',
  tone: '',
  wordCount: '800',
  brandContext: '',
  outline: '',
  audience: '',
  goal: '',
  product: '',
  sequenceLength: '3',
  targetAudience: '',
  keyBenefit: '',
};

export function LongFormToolPage({ manifest }: Props) {
  const [form, setForm] = useState<GenerateForm>(DEFAULT_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: pieces = [], isLoading } = useContentPieces();
  const saveMutation = useSaveContentPiece();
  const deleteMutation = useDeleteContentPiece();

  function updateForm(key: keyof GenerateForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    setGenerateError(null);
    const { contentType } = form;

    let endpoint = '';
    let body: Record<string, unknown> = {};

    if (contentType === 'blog_post') {
      endpoint = '/api/content-pieces/generate/blog-post';
      body = {
        topic: form.topic,
        targetKeyword: form.targetKeyword || undefined,
        tone: form.tone || undefined,
        wordCount: parseInt(form.wordCount, 10) || 800,
        brandContext: form.brandContext || undefined,
        outline: form.outline || undefined,
      };
    } else if (contentType === 'newsletter') {
      endpoint = '/api/content-pieces/generate/newsletter';
      body = {
        topic: form.topic,
        audience: form.audience || undefined,
        tone: form.tone || undefined,
        brandContext: form.brandContext || undefined,
      };
    } else if (contentType === 'email_sequence') {
      endpoint = '/api/content-pieces/generate/email-sequence';
      body = {
        goal: form.goal,
        product: form.product || undefined,
        sequenceLength: parseInt(form.sequenceLength, 10) || 3,
        tone: form.tone || undefined,
        brandContext: form.brandContext || undefined,
      };
    } else if (contentType === 'landing_page') {
      endpoint = '/api/content-pieces/generate/landing-page';
      body = {
        product: form.product,
        targetAudience: form.targetAudience || undefined,
        keyBenefit: form.keyBenefit || undefined,
        tone: form.tone || undefined,
        brandContext: form.brandContext || undefined,
      };
    } else {
      setGenerateError('Generation for this content type is not yet available in the sidebar. Use the AI chat instead.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
      setForm(DEFAULT_FORM);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy(body: string | null, id: string) {
    if (!body) return;
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const primaryTopic =
    form.contentType === 'email_sequence' ? form.goal :
    form.contentType === 'landing_page' ? form.product :
    form.topic;

  const canGenerate = primaryTopic.trim().length > 0;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{manifest.title}</h1>
          <p className="text-sm text-muted-foreground">{manifest.description}</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="flex-1">
        <TabsList>
          <TabsTrigger value="generate">
            <Plus className="mr-1.5 h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="library">
            Library
            {pieces.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                {pieces.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create New Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Content Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Content Type</label>
                <Select
                  value={form.contentType}
                  onValueChange={(v) => updateForm('contentType', v as ContentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog_post">Blog Post</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="email_sequence">Email Sequence</SelectItem>
                    <SelectItem value="landing_page">Landing Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic primary field */}
              {form.contentType === 'email_sequence' ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Conversion Goal *</label>
                  <Input
                    placeholder="e.g. Onboard new users to our SaaS product"
                    value={form.goal}
                    onChange={(e) => updateForm('goal', e.target.value)}
                  />
                </div>
              ) : form.contentType === 'landing_page' ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Product / Service *</label>
                  <Input
                    placeholder="e.g. Acme Pro — project management software"
                    value={form.product}
                    onChange={(e) => updateForm('product', e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Topic *</label>
                  <Input
                    placeholder={
                      form.contentType === 'newsletter'
                        ? 'e.g. AI trends for marketers this quarter'
                        : 'e.g. How to build a content marketing strategy'
                    }
                    value={form.topic}
                    onChange={(e) => updateForm('topic', e.target.value)}
                  />
                </div>
              )}

              {/* Type-specific fields */}
              {form.contentType === 'blog_post' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Target Keyword</label>
                      <Input
                        placeholder="e.g. content marketing strategy"
                        value={form.targetKeyword}
                        onChange={(e) => updateForm('targetKeyword', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Word Count</label>
                      <Input
                        type="number"
                        min={200}
                        max={5000}
                        step={100}
                        value={form.wordCount}
                        onChange={(e) => updateForm('wordCount', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Outline / Key Points</label>
                    <Textarea
                      placeholder="Optional: list key points or headings to include..."
                      rows={3}
                      value={form.outline}
                      onChange={(e) => updateForm('outline', e.target.value)}
                    />
                  </div>
                </>
              )}

              {form.contentType === 'newsletter' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Target Audience</label>
                  <Input
                    placeholder="e.g. SaaS founders and growth marketers"
                    value={form.audience}
                    onChange={(e) => updateForm('audience', e.target.value)}
                  />
                </div>
              )}

              {form.contentType === 'email_sequence' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Product / Service</label>
                    <Input
                      placeholder="e.g. Acme Pro"
                      value={form.product}
                      onChange={(e) => updateForm('product', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Number of Emails</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={form.sequenceLength}
                      onChange={(e) => updateForm('sequenceLength', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {form.contentType === 'landing_page' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Target Audience</label>
                    <Input
                      placeholder="e.g. Small business owners"
                      value={form.targetAudience}
                      onChange={(e) => updateForm('targetAudience', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Key Benefit</label>
                    <Input
                      placeholder="e.g. Save 10 hours per week"
                      value={form.keyBenefit}
                      onChange={(e) => updateForm('keyBenefit', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Common fields */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tone</label>
                <Input
                  placeholder="e.g. professional, conversational, witty..."
                  value={form.tone}
                  onChange={(e) => updateForm('tone', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Brand Context</label>
                <Textarea
                  placeholder="Paste brand guidelines, tone of voice notes, or product descriptions..."
                  rows={3}
                  value={form.brandContext}
                  onChange={(e) => updateForm('brandContext', e.target.value)}
                />
              </div>

              {generateError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {generateError}
                </p>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Content'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Library Tab */}
        <TabsContent value="library" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pieces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No content yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Generate your first piece using the Generate tab.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pieces.map((piece) => (
                <Card key={piece.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              CONTENT_TYPE_COLORS[piece.contentType]
                            }`}
                          >
                            {CONTENT_TYPE_LABELS[piece.contentType]}
                          </span>
                          <span className="text-xs capitalize text-muted-foreground">
                            {piece.status}
                          </span>
                        </div>
                        <h3 className="mt-1.5 truncate text-sm font-semibold">{piece.title}</h3>
                        {piece.excerpt && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {piece.excerpt}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground/60">
                          {new Date(piece.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Copy content"
                          onClick={() => void handleCopy(piece.body, piece.id)}
                        >
                          <Copy
                            className={`h-4 w-4 ${
                              copiedId === piece.id ? 'text-green-600' : 'text-muted-foreground'
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() => deleteMutation.mutate(piece.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
