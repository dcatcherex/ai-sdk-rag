'use client';

import { useState } from 'react';
import { DownloadIcon, MailIcon, MessageCircleIcon, SendIcon, WebhookIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useDistributionRecords, useSendEmail, useExportContent, useSendWebhook, useSendLineBroadcast } from '../hooks/use-distribution';
import { useLineOaChannels } from '@/features/line-oa/hooks/use-line-oa';
import type { DistributionRecord } from '../types';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { label: 'Sent', variant: 'default' },
  pending: { label: 'Pending', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

function HistoryRow({ record }: { record: DistributionRecord }) {
  const badge = STATUS_BADGE[record.status] ?? { label: record.status, variant: 'outline' };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-border bg-muted/20 px-3 py-2 text-xs">
      <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
      <span className="capitalize">{record.channel}</span>
      {record.recipientCount != null && (
        <span className="text-muted-foreground">{record.recipientCount} recipients</span>
      )}
      {record.externalRef && (
        <span className="text-muted-foreground truncate max-w-32">{record.externalRef}</span>
      )}
      <span className="ml-auto text-muted-foreground">
        {new Date(record.createdAt).toLocaleDateString()}
      </span>
    </div>
  );
}

type Props = {
  contentPieceId: string;
  defaultBody?: string;
  defaultTitle?: string;
};

export function DistributionPanel({ contentPieceId, defaultBody = '', defaultTitle = '' }: Props) {
  // Email state
  const [subject, setSubject] = useState(defaultTitle ? `[Content] ${defaultTitle}` : '');
  const [body, setBody] = useState(defaultBody);
  const [recipients, setRecipients] = useState('');
  const [emailError, setEmailError] = useState('');

  // Export state
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html' | 'plain'>('markdown');
  const [exportResult, setExportResult] = useState<{ content: string; filename: string } | null>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookError, setWebhookError] = useState('');

  // LINE Broadcast state
  const [lineChannelId, setLineChannelId] = useState('');
  const [lineError, setLineError] = useState('');
  const [lineSentCount, setLineSentCount] = useState<number | null>(null);

  const { data: history = [] } = useDistributionRecords(contentPieceId);
  const { data: lineChannels = [] } = useLineOaChannels();
  const sendEmail = useSendEmail();
  const exportContent = useExportContent();
  const sendWebhook = useSendWebhook();
  const sendLineBroadcast = useSendLineBroadcast();

  const handleSendEmail = () => {
    setEmailError('');
    const recipientList = recipients
      .split(/[\s,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (recipientList.length === 0) { setEmailError('Add at least one recipient.'); return; }
    if (!subject.trim()) { setEmailError('Subject is required.'); return; }
    if (!body.trim()) { setEmailError('Body is required.'); return; }

    sendEmail.mutate(
      { contentPieceId, subject, body, recipients: recipientList },
      {
        onSuccess: () => { setEmailError(''); setRecipients(''); },
        onError: (err) => setEmailError(err.message),
      },
    );
  };

  const handleExport = () => {
    exportContent.mutate(
      { contentPieceId, format: exportFormat },
      {
        onSuccess: (result) => setExportResult(result),
        onError: (err) => console.error(err),
      },
    );
  };

  const handleDownload = () => {
    if (!exportResult) return;
    const blob = new Blob([exportResult.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWebhook = () => {
    setWebhookError('');
    if (!webhookUrl.trim()) { setWebhookError('Enter a webhook URL.'); return; }
    sendWebhook.mutate(
      { contentPieceId, webhookUrl },
      {
        onSuccess: () => setWebhookError(''),
        onError: (err) => setWebhookError(err.message),
      },
    );
  };

  const handleLineBroadcast = () => {
    setLineError('');
    setLineSentCount(null);
    if (!lineChannelId) { setLineError('Select a LINE OA channel.'); return; }
    sendLineBroadcast.mutate(
      { contentPieceId, channelId: lineChannelId },
      {
        onSuccess: (record) => {
          setLineSentCount(record.recipientCount);
          setLineError('');
        },
        onError: (err) => setLineError(err.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="email">
        <TabsList className="h-auto justify-start gap-0 rounded-none border-b border-black/5 dark:border-border bg-transparent p-0">
          {[
            { value: 'email', label: 'Email', icon: <MailIcon className="size-3.5" /> },
            { value: 'export', label: 'Export', icon: <DownloadIcon className="size-3.5" /> },
            { value: 'webhook', label: 'Webhook', icon: <WebhookIcon className="size-3.5" /> },
            { value: 'line', label: 'LINE', icon: <MessageCircleIcon className="size-3.5" /> },
            { value: 'history', label: 'History', icon: <SendIcon className="size-3.5" /> },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs gap-1.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Email */}
        <TabsContent value="email" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Recipients</Label>
            <Input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="email@example.com, another@example.com"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body (HTML or plain text)"
              rows={5}
              className="mt-1 resize-none text-sm"
            />
          </div>
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          <Button size="sm" onClick={handleSendEmail} disabled={sendEmail.isPending} className="gap-1.5">
            <MailIcon className="size-3.5" />
            {sendEmail.isPending ? 'Sending…' : 'Send email'}
          </Button>
        </TabsContent>

        {/* Export */}
        <TabsContent value="export" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Format</Label>
            <Select value={exportFormat} onValueChange={(v) => { setExportFormat(v as typeof exportFormat); setExportResult(null); }}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown (.md)</SelectItem>
                <SelectItem value="html">HTML (.html)</SelectItem>
                <SelectItem value="plain">Plain text (.txt)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exportContent.isPending} className="gap-1.5">
              <DownloadIcon className="size-3.5" />
              {exportContent.isPending ? 'Generating…' : 'Generate export'}
            </Button>
            {exportResult && (
              <Button size="sm" onClick={handleDownload} className="gap-1.5">
                <DownloadIcon className="size-3.5" />
                Download {exportResult.filename}
              </Button>
            )}
          </div>
          {exportResult && (
            <pre className="max-h-60 overflow-y-auto rounded-lg border border-black/5 dark:border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {exportResult.content.slice(0, 1500)}
              {exportResult.content.length > 1500 ? '\n…(truncated)' : ''}
            </pre>
          )}
        </TabsContent>

        {/* Webhook */}
        <TabsContent value="webhook" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Webhook URL</Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-cms.com/api/content"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The content piece will be sent as a JSON POST request to this URL.
          </p>
          {webhookError && <p className="text-xs text-destructive">{webhookError}</p>}
          <Button size="sm" onClick={handleWebhook} disabled={sendWebhook.isPending} className="gap-1.5">
            <SendIcon className="size-3.5" />
            {sendWebhook.isPending ? 'Sending…' : 'Send to webhook'}
          </Button>
        </TabsContent>

        {/* LINE Broadcast */}
        <TabsContent value="line" className="mt-3 space-y-3">
          {lineChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No LINE OA channels connected. Go to <span className="font-medium">LINE OA</span> to connect one.
            </p>
          ) : (
            <>
              <div>
                <Label className="text-xs">LINE OA Channel</Label>
                <Select value={lineChannelId} onValueChange={(v) => { setLineChannelId(v); setLineSentCount(null); setLineError(''); }}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select a channel…" />
                  </SelectTrigger>
                  <SelectContent>
                    {lineChannels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                The content excerpt (or first 2000 characters) will be broadcast to all followers of the selected channel.
              </p>
              {lineError && <p className="text-xs text-destructive">{lineError}</p>}
              {lineSentCount != null && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Broadcast sent to {lineSentCount ?? 'all'} followers.
                </p>
              )}
              <Button
                size="sm"
                onClick={handleLineBroadcast}
                disabled={sendLineBroadcast.isPending || !lineChannelId}
                className="gap-1.5"
              >
                <MessageCircleIcon className="size-3.5" />
                {sendLineBroadcast.isPending ? 'Broadcasting…' : 'Broadcast to followers'}
              </Button>
            </>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-3">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No distribution history yet.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((r) => <HistoryRow key={r.id} record={r} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
