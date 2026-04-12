'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BotIcon,
  Loader2Icon,
  RefreshCcwIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/page-header';
import { RightPanel } from '@/features/layout/right-panel';
import { cn } from '@/lib/utils';

type SupportConversation = {
  id: string;
  title: string | null;
  status: 'open' | 'closed';
  channel: 'line';
  contactId: string;
  externalId: string;
  displayName: string | null;
  pictureUrl: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedToImage: string | null;
  tags: string[];
  lastMessageAt: string;
  lastMessageBody: string | null;
  lastMessageDirection: 'inbound' | 'outbound' | null;
  lastMessageSenderType: 'customer' | 'ai' | 'agent' | null;
};

type SupportConversationsResponse = {
  conversations: SupportConversation[];
  total: number;
  page: number;
  totalPages: number;
};

type SupportMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  senderType: 'customer' | 'ai' | 'agent';
  body: string | null;
  externalMessageId: string | null;
  lineReplyToken: string | null;
  modelId: string | null;
  payload: unknown;
  sentAt: string | null;
  createdAt: string;
};

type SupportMessagesResponse = {
  messages: SupportMessage[];
};

type SendReplyResponse = {
  ok: true;
  text: string;
  messageId?: string;
  modelId?: string;
  draft?: boolean;
};

type SupportAssignableUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type SupportAssigneesResponse = {
  assignees: SupportAssignableUser[];
};

type DraftInsertMode = 'replace' | 'append';
type DraftState = 'none' | 'ai' | 'edited';

const formatConversationTime = (value: string): string => {
  const date = new Date(value);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getMessageLabel = (senderType: SupportMessage['senderType']): string => {
  if (senderType === 'customer') return 'Customer';
  if (senderType === 'ai') return 'AI';
  return 'Agent';
};

const getInitials = (value: string | null, fallback = 'U'): string => {
  if (!value?.trim()) return fallback;
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
};

const normalizeTags = (value: string): string[] => {
  const normalized: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim().slice(0, 32);
    if (!trimmed) continue;
    if (normalized.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) continue;
    normalized.push(trimmed);
    if (normalized.length >= 12) break;
  }
  return normalized;
};

type SupportLineMediaPayload = {
  kind: 'line-media';
  messageType: 'image' | 'video' | 'audio' | 'file';
  url?: string;
  r2Key?: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  durationMs?: number;
  error?: 'download_failed';
  analysis?: { extractedText: string; summary: string; modelId: string; kind: 'vision' | 'transcription' | 'text' | 'unsupported' };
};

type SupportLineLocationPayload = {
  kind: 'line-location';
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  mapUrl: string;
};

type SupportLineStickerPayload = {
  kind: 'line-sticker';
  packageId: string;
  stickerId: string;
  stickerResourceType: string;
  keywords: string[];
  text?: string;
};

type SupportLineContentPayload = SupportLineMediaPayload | SupportLineLocationPayload | SupportLineStickerPayload;

type SupportLineInboundPayload = {
  webhookEventId: string | null;
  isRedelivery: boolean;
  timestamp: number;
  source: { userId?: string };
  content?: SupportLineContentPayload;
};

const getLineContentPayload = (payload: unknown): SupportLineContentPayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  return (payload as SupportLineInboundPayload).content ?? null;
};

const formatBytes = (value?: number): string | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const renderLineContent = (payload: SupportLineContentPayload | null) => {
  if (!payload) return null;

  if (payload.kind === 'line-location') {
    return (
      <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{payload.title}</div>
        <div className="mt-1">{payload.address}</div>
        <a href={payload.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-primary underline-offset-4 hover:underline">Open in Maps</a>
      </div>
    );
  }

  if (payload.kind === 'line-sticker') {
    return (
      <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Sticker {payload.packageId}:{payload.stickerId}</div>
        <div className="mt-1">{payload.stickerResourceType}</div>
        {payload.keywords.length > 0 && <div className="mt-1 truncate">{payload.keywords.join(', ')}</div>}
      </div>
    );
  }

  if (payload.messageType === 'image' && payload.url) {
    return (
      <div className="mt-3 space-y-2">
        <a href={payload.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
          <div className="relative h-72 w-full">
            <Image src={payload.url} alt={payload.fileName} fill unoptimized className="object-cover" />
          </div>
        </a>
        <div className="text-xs text-muted-foreground">{payload.fileName}{formatBytes(payload.sizeBytes) ? ` • ${formatBytes(payload.sizeBytes)}` : ''}</div>
        {payload.analysis?.summary && (
          <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Extracted summary</div>
            <div className="mt-1 whitespace-pre-wrap">{payload.analysis.summary}</div>
          </div>
        )}
      </div>
    );
  }

  if (payload.messageType === 'video' && payload.url) {
    return (
      <div className="mt-3 space-y-2">
        <video controls src={payload.url} className="max-h-72 w-full rounded-xl border bg-black" />
        <div className="text-xs text-muted-foreground">{payload.fileName}{formatBytes(payload.sizeBytes) ? ` • ${formatBytes(payload.sizeBytes)}` : ''}</div>
      </div>
    );
  }

  if (payload.messageType === 'audio' && payload.url) {
    return (
      <div className="mt-3 space-y-2 rounded-xl border bg-muted/30 p-3">
        <audio controls src={payload.url} className="w-full" />
        <div className="text-xs text-muted-foreground">
          {payload.fileName}
          {typeof payload.durationMs === 'number' ? ` • ${(payload.durationMs / 1000).toFixed(1)}s` : ''}
          {formatBytes(payload.sizeBytes) ? ` • ${formatBytes(payload.sizeBytes)}` : ''}
        </div>
        {payload.analysis?.extractedText && (
          <div className="rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Transcript</div>
            <div className="mt-1 whitespace-pre-wrap">{payload.analysis.extractedText}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
      {payload.url ? (
        <a href={payload.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">{payload.fileName}</a>
      ) : (
        <div className="font-medium text-foreground">{payload.fileName}</div>
      )}
      <div className="mt-1">
        {payload.mimeType}
        {formatBytes(payload.sizeBytes) ? ` • ${formatBytes(payload.sizeBytes)}` : ''}
        {payload.error === 'download_failed' ? ' • download failed' : ''}
      </div>
      {payload.analysis?.summary && (
        <div className="mt-2 rounded-xl border bg-background/70 p-3">
          <div className="font-medium text-foreground">Extracted summary</div>
          <div className="mt-1 whitespace-pre-wrap">{payload.analysis.summary}</div>
          {payload.analysis.extractedText && (
            <details className="mt-2">
              <summary className="cursor-pointer text-foreground">View extracted text</summary>
              <div className="mt-2 whitespace-pre-wrap">{payload.analysis.extractedText}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Conversations panel (rendered in the layout's right panel slot)
// ---------------------------------------------------------------------------

function ConversationsPanel({
  conversations,
  total,
  isLoading,
  isError,
  isFetched,
  error,
  search,
  onSearchChange,
  selectedConversationId,
  onSelectConversation,
}: {
  conversations: SupportConversation[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFetched: boolean;
  error: Error | null;
  search: string;
  onSearchChange: (v: string) => void;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}) {
  return (
    <>
      <div className="shrink-0 space-y-3 border-b border-black/5 dark:border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Conversations</span>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-black/5 dark:divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              <Loader2Icon className="mr-2 size-4 animate-spin" />Loading…
            </div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">{error?.message}</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {isFetched ? 'No conversations found.' : 'LINE OA support is not configured'}
            </div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60', active && 'bg-primary/5')}
                >
                  <Avatar size="lg">
                    <AvatarImage src={conversation.pictureUrl ?? undefined} alt={conversation.displayName ?? conversation.externalId} />
                    <AvatarFallback>{getInitials(conversation.displayName, 'L')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{conversation.displayName ?? conversation.externalId}</div>
                        <div className="truncate text-xs text-muted-foreground">{conversation.title ?? 'LINE conversation'}</div>
                      </div>
                      <div className="shrink-0 text-[11px] text-muted-foreground">{formatConversationTime(conversation.lastMessageAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{conversation.channel}</Badge>
                      <Badge variant={conversation.status === 'open' ? 'secondary' : 'outline'} className="capitalize">{conversation.status}</Badge>
                      {conversation.assignedToName && <Badge variant="outline">{conversation.assignedToName}</Badge>}
                    </div>
                    {conversation.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {conversation.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="max-w-full truncate">{tag}</Badge>)}
                      </div>
                    )}
                    <p className="line-clamp-2 text-xs text-muted-foreground">{conversation.lastMessageBody ?? 'No messages yet'}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SupportInboxPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [draftInsertMode, setDraftInsertMode] = useState<DraftInsertMode>('replace');
  const [draftState, setDraftState] = useState<DraftState>('none');
  const [draftModelId, setDraftModelId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('unassigned');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const conversationsQuery = useQuery<SupportConversationsResponse>({
    queryKey: ['support', 'conversations', { search: debouncedSearch }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const response = await fetch(`/api/support/conversations?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch conversations' }));
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to fetch conversations');
      }
      return response.json() as Promise<SupportConversationsResponse>;
    },
  });

  const conversations = conversationsQuery.data?.conversations ?? [];

  useEffect(() => {
    if (!conversations.length) { setSelectedConversationId(null); return; }
    if (!selectedConversationId || !conversations.some((c) => c.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const messagesQuery = useQuery<SupportMessagesResponse>({
    queryKey: ['support', 'messages', selectedConversationId],
    enabled: Boolean(selectedConversationId),
    queryFn: async () => {
      const response = await fetch(`/api/support/conversations/${selectedConversationId}/messages`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch messages' }));
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to fetch messages');
      }
      return response.json() as Promise<SupportMessagesResponse>;
    },
  });

  const assigneesQuery = useQuery<SupportAssigneesResponse>({
    queryKey: ['support', 'assignees'],
    queryFn: async () => {
      const response = await fetch('/api/support/assignees');
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch assignees' }));
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to fetch assignees');
      }
      return response.json() as Promise<SupportAssigneesResponse>;
    },
  });

  useEffect(() => {
    setReplyText('');
    setDraftState('none');
    setDraftModelId(null);
    setSelectedAssigneeId(selectedConversation?.assignedToUserId ?? 'unassigned');
    setTagsInput((selectedConversation?.tags ?? []).join(', '));
  }, [selectedConversationId, selectedConversation?.assignedToUserId, selectedConversation?.tags]);

  const normalizedTags = useMemo(() => normalizeTags(tagsInput), [tagsInput]);
  const metadataDirty = useMemo(() => {
    if (!selectedConversation) return false;
    const currentAssignee = selectedConversation.assignedToUserId ?? 'unassigned';
    if (selectedAssigneeId !== currentAssignee) return true;
    if (normalizedTags.length !== selectedConversation.tags.length) return true;
    return normalizedTags.some((tag, i) => tag !== selectedConversation.tags[i]);
  }, [normalizedTags, selectedAssigneeId, selectedConversation]);

  const sendMutation = useMutation<SendReplyResponse, Error, { text: string }>({
    mutationFn: async ({ text }) => {
      if (!selectedConversationId) throw new Error('Select a conversation first');
      const response = await fetch(`/api/support/conversations/${selectedConversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send reply' }));
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to send reply');
      }
      return response.json() as Promise<SendReplyResponse>;
    },
    onSuccess: async () => {
      setReplyText('');
      setDraftState('none');
      setDraftModelId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support', 'messages', selectedConversationId] }),
        queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] }),
      ]);
    },
  });

  const aiReplyMutation = useMutation<SendReplyResponse, Error>({
    mutationFn: async () => {
      if (!selectedConversationId) throw new Error('Select a conversation first');
      const response = await fetch(`/api/support/conversations/${selectedConversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useAi: true, draftOnly: true }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate AI draft' }));
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to generate AI draft');
      }
      return response.json() as Promise<SendReplyResponse>;
    },
    onSuccess: async (data) => {
      setReplyText((current) => {
        if (draftInsertMode === 'append' && current.trim()) return `${current.trimEnd()}\n\n${data.text}`;
        return data.text;
      });
      setDraftState('ai');
      setDraftModelId(data.modelId ?? null);
    },
  });

  const metadataMutation = useMutation<{ ok: true }, Error, { assignedToUserId: string; tags: string[] }>({
    mutationFn: async ({ assignedToUserId, tags }) => {
      if (!selectedConversationId) throw new Error('Select a conversation first');
      const response = await fetch(`/api/support/conversations/${selectedConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToUserId: assignedToUserId === 'unassigned' ? null : assignedToUserId, tags }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update conversation' }));
        throw new Error(typeof error.error === 'string' ? error.error : 'Failed to update conversation');
      }
      return response.json() as Promise<{ ok: true }>;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] }); },
  });

  const isSending = sendMutation.isPending || aiReplyMutation.isPending;
  const assignees = assigneesQuery.data?.assignees ?? [];

  return (
    <>
      <RightPanel>
        <ConversationsPanel
          conversations={conversations}
          total={conversationsQuery.data?.total ?? 0}
          isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError}
          isFetched={conversationsQuery.isFetched}
          error={conversationsQuery.error}
          search={search}
          onSearchChange={setSearch}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
        />
      </RightPanel>

      <PageHeader
        title="Support Inbox"
        description="Review LINE OA conversations, generate AI drafts, and send replies manually."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void conversationsQuery.refetch();
              if (selectedConversationId) void messagesQuery.refetch();
            }}
          >
            <RefreshCcwIcon className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Conversation header */}
        <div className="shrink-0 border-b border-black/5 dark:border-border px-4 py-3 md:px-6">
          {selectedConversation ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage src={selectedConversation.pictureUrl ?? undefined} alt={selectedConversation.displayName ?? selectedConversation.externalId} />
                  <AvatarFallback>{getInitials(selectedConversation.displayName, 'L')}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedConversation.displayName ?? selectedConversation.externalId}</div>
                  <p className="text-sm text-muted-foreground">{selectedConversation.title ?? 'LINE conversation'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">LINE</Badge>
                <Badge variant={selectedConversation.status === 'open' ? 'secondary' : 'outline'} className="capitalize">{selectedConversation.status}</Badge>
                {selectedConversation.assignedToName && <Badge variant="outline">Assigned: {selectedConversation.assignedToName}</Badge>}
                {selectedConversation.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                <span className="text-xs text-muted-foreground">Updated {formatConversationTime(selectedConversation.lastMessageAt)}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="font-medium">Messages</div>
              <p className="text-sm text-muted-foreground">Select a conversation to view messages.</p>
            </div>
          )}
        </div>

        {/* Metadata: tags + assignee */}
        {selectedConversation && (
          <div className="shrink-0 border-b border-black/5 dark:border-border px-4 py-3 md:px-6">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Tags</div>
                <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, refund, urgent" disabled={metadataMutation.isPending} />
                <div className="flex flex-wrap gap-1">
                  {normalizedTags.map((tag) => (
                    <Badge key={tag} variant="secondary"><TagIcon className="size-3" />{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Assigned to</div>
                <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignees.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-start md:justify-end">
                <Button variant="outline" disabled={!metadataDirty || metadataMutation.isPending} onClick={() => metadataMutation.mutate({ assignedToUserId: selectedAssigneeId, tags: normalizedTags })}>
                  {metadataMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                  Save Details
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4 md:px-6">
          <div className="space-y-4">
            {!selectedConversation ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Choose a conversation from the right panel to inspect the thread.
              </div>
            ) : messagesQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2Icon className="mr-2 size-4 animate-spin" />Loading messages…
              </div>
            ) : messagesQuery.isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{messagesQuery.error.message}</div>
            ) : (messagesQuery.data?.messages ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No synced messages yet for this conversation.</div>
            ) : (
              (messagesQuery.data?.messages ?? []).map((message) => {
                const isCustomer = message.senderType === 'customer';
                const payload = getLineContentPayload(message.payload);
                return (
                  <div key={message.id} className={cn('flex gap-3', isCustomer ? 'justify-start' : 'justify-end')}>
                    {isCustomer && (
                      <Avatar size="sm">
                        <AvatarImage src={selectedConversation.pictureUrl ?? undefined} alt={selectedConversation.displayName ?? selectedConversation.externalId} />
                        <AvatarFallback>{getInitials(selectedConversation.displayName, 'L')}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn(
                      'max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-sm',
                      isCustomer ? 'bg-background text-foreground' : message.senderType === 'ai' ? 'border-primary/20 bg-primary/5' : 'bg-card text-foreground',
                    )}>
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {message.senderType === 'customer' ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
                        <span>{getMessageLabel(message.senderType)}</span>
                        <span>•</span>
                        <span>{formatConversationTime(message.createdAt)}</span>
                        {message.modelId && <><span>•</span><span className="truncate">{message.modelId}</span></>}
                      </div>
                      <div className="whitespace-pre-wrap wrap-break-word">{message.body ?? 'Unsupported content'}</div>
                      {renderLineContent(payload)}
                    </div>
                    {!isCustomer && (
                      <Avatar size="sm">
                        <AvatarFallback>{message.senderType === 'ai' ? 'AI' : 'AG'}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Reply */}
        <div className="shrink-0 space-y-3 px-4 pb-4 pt-3 md:px-6 md:pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">Reply</div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={draftInsertMode} onValueChange={(v) => setDraftInsertMode(v as DraftInsertMode)}>
                <SelectTrigger size="sm" className="w-[150px]"><SelectValue placeholder="Insert mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">Replace composer</SelectItem>
                  <SelectItem value="append">Append to composer</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={!selectedConversationId || isSending} onClick={() => aiReplyMutation.mutate()}>
                {aiReplyMutation.isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <SparklesIcon className="mr-2 size-4" />}
                {draftState === 'none' ? 'Generate AI Draft' : 'Regenerate Draft'}
              </Button>
              <Button variant="ghost" size="sm" disabled={!replyText || isSending} onClick={() => { setReplyText(''); setDraftState('none'); setDraftModelId(null); }}>
                Clear
              </Button>
            </div>
          </div>

          {(draftState !== 'none' || draftModelId || metadataMutation.isError) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {draftState === 'ai' && <Badge variant="secondary">AI draft ready</Badge>}
              {draftState === 'edited' && <Badge variant="outline">Draft edited</Badge>}
              {draftModelId && <Badge variant="outline">{draftModelId}</Badge>}
              {metadataMutation.isError && <span className="text-destructive">{metadataMutation.error.message}</span>}
            </div>
          )}

          <Textarea
            value={replyText}
            onChange={(e) => { setReplyText(e.target.value); if (draftState !== 'none') setDraftState('edited'); }}
            placeholder="Type a reply to the customer…"
            className="min-h-24 resize-y"
            disabled={!selectedConversationId || isSending}
          />

          {(sendMutation.isError || aiReplyMutation.isError) && (
            <div className="text-sm text-destructive">{sendMutation.error?.message ?? aiReplyMutation.error?.message}</div>
          )}

          <div className="flex justify-end">
            <Button disabled={!selectedConversationId || !replyText.trim() || isSending} onClick={() => sendMutation.mutate({ text: replyText })}>
              {sendMutation.isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <SendIcon className="mr-2 size-4" />}
              Send Reply
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
