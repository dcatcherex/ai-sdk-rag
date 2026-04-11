'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BotIcon, EyeIcon, ImageIcon, Loader2Icon, SearchIcon, SparklesIcon, WrenchIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AdminChatRunStatus = 'pending' | 'success' | 'error';
type AdminChatRouteKind = 'text' | 'image';
type AdminChatRoutingMode = 'manual' | 'auto' | null;
type WorkspaceEntityType = 'agent' | 'skill';

type AdminChatRun = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  threadId: string;
  agentId: string | null;
  brandId: string | null;
  status: AdminChatRunStatus;
  routeKind: AdminChatRouteKind;
  requestedModelId: string | null;
  resolvedModelId: string | null;
  routingMode: AdminChatRoutingMode;
  routingReason: string | null;
  useWebSearch: boolean;
  usedTools: boolean;
  toolCallCount: number;
  creditCost: number | null;
  totalTokens: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AdminChatRunDetail = AdminChatRun & {
  promptTokens: number | null;
  completionTokens: number | null;
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
  startedAt: string;
};

type AdminChatRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byRouteKind: Array<{ key: string; count: number }>;
    byResolvedModel: Array<{ key: string; count: number }>;
  };
  runs: AdminChatRun[];
  page: number;
  totalPages: number;
};

type AdminWorkspaceAiRun = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  kind: string;
  entityType: WorkspaceEntityType;
  entityId: string | null;
  route: 'text' | 'image';
  status: AdminChatRunStatus;
  modelId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AdminWorkspaceAiRunDetail = AdminWorkspaceAiRun & {
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
};

type AdminWorkspaceAiRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byKind: Array<{ key: string; count: number }>;
    byRoute: Array<{ key: string; count: number }>;
    byModel: Array<{ key: string; count: number }>;
  };
  runs: AdminWorkspaceAiRun[];
  page: number;
  totalPages: number;
};

type AdminToolRun = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  toolSlug: string;
  threadId: string | null;
  source: string;
  status: AdminChatRunStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AdminToolRunDetail = AdminToolRun & {
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
};

type AdminToolRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byToolSlug: Array<{ key: string; count: number }>;
    bySource: Array<{ key: string; count: number }>;
  };
  runs: AdminToolRun[];
  page: number;
  totalPages: number;
};

type AdminUnifiedRun = {
  id: string;
  runtime: 'chat' | 'workspace' | 'tool';
  title: string;
  subtitle: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: AdminChatRunStatus;
  createdAt: string;
  completedAt: string | null;
  routeKind: string | null;
  modelOrTarget: string | null;
};

type AdminUnifiedRunsResponse = {
  summary: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
    byRuntime: Array<{ key: string; count: number }>;
  };
  runs: AdminUnifiedRun[];
  page: number;
  totalPages: number;
};

type AdminAiTrendsResponse = {
  range: {
    dateFrom: string;
    dateTo: string;
  };
  summary: {
    totalRuns: number;
    totalErrors: number;
    totalTokens: number;
    totalCredits: number;
    byRuntime: {
      chat: { runCount: number; errorCount: number; tokenTotal: number; creditTotal: number };
      workspace: { runCount: number; errorCount: number; tokenTotal: number; creditTotal: number };
      tool: { runCount: number; errorCount: number; tokenTotal: number; creditTotal: number };
    };
  };
  daily: Array<{
    day: string;
    totalRuns: number;
    totalErrors: number;
    totalTokens: number;
    totalCredits: number;
    chat: { runCount: number; errorCount: number; tokenTotal: number; creditTotal: number };
    workspace: { runCount: number; errorCount: number; tokenTotal: number; creditTotal: number };
    tool: { runCount: number; errorCount: number; tokenTotal: number; creditTotal: number };
  }>;
};

const statusBadgeVariant: Record<AdminChatRunStatus, 'secondary' | 'destructive' | 'outline'> = {
  success: 'secondary',
  error: 'destructive',
  pending: 'outline',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function WorkspaceKindLabel({ kind }: { kind: string }) {
  return <span>{kind.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}</span>;
}

function TokenValue({ value }: { value: number | null }) {
  return <span>{typeof value === 'number' ? value : '—'}</span>;
}

export default function AdminChatRunsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [chatSearch, setChatSearch] = useState('');
  const [chatStatus, setChatStatus] = useState('all');
  const [chatRouteKind, setChatRouteKind] = useState('all');
  const [chatResolvedModelId, setChatResolvedModelId] = useState('all');
  const [chatPage, setChatPage] = useState(1);
  const [selectedChatRunId, setSelectedChatRunId] = useState<string | null>(null);

  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspaceStatus, setWorkspaceStatus] = useState('all');
  const [workspaceRoute, setWorkspaceRoute] = useState('all');
  const [workspaceKind, setWorkspaceKind] = useState('all');
  const [workspaceModelId, setWorkspaceModelId] = useState('all');
  const [workspacePage, setWorkspacePage] = useState(1);
  const [selectedWorkspaceRunId, setSelectedWorkspaceRunId] = useState<string | null>(null);

  const [toolSearch, setToolSearch] = useState('');
  const [toolStatus, setToolStatus] = useState('all');
  const [toolSlug, setToolSlug] = useState('all');
  const [toolSource, setToolSource] = useState('all');
  const [toolPage, setToolPage] = useState(1);
  const [selectedToolRunId, setSelectedToolRunId] = useState<string | null>(null);

  const [allSearch, setAllSearch] = useState('');
  const [allStatus, setAllStatus] = useState('all');
  const [allRuntime, setAllRuntime] = useState('all');
  const [allPage, setAllPage] = useState(1);

  const { data: chatData, isLoading: isChatLoading, isFetching: isChatFetching } = useQuery<AdminChatRunsResponse>({
    queryKey: ['admin', 'chat-runs', { chatSearch, chatStatus, chatRouteKind, chatResolvedModelId, dateFrom, dateTo, chatPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(chatPage),
        limit: '20',
      });
      if (chatSearch.trim()) params.set('search', chatSearch.trim());
      if (chatStatus !== 'all') params.set('status', chatStatus);
      if (chatRouteKind !== 'all') params.set('routeKind', chatRouteKind);
      if (chatResolvedModelId !== 'all') params.set('resolvedModelId', chatResolvedModelId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/chat-runs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch chat runs');
      return res.json();
    },
  });

  const { data: chatDetail, isLoading: isChatDetailLoading } = useQuery<AdminChatRunDetail>({
    queryKey: ['admin', 'chat-runs', 'detail', selectedChatRunId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/chat-runs/${selectedChatRunId}`);
      if (!res.ok) throw new Error('Failed to fetch chat run detail');
      return res.json();
    },
    enabled: !!selectedChatRunId,
  });

  const { data: workspaceData, isLoading: isWorkspaceLoading, isFetching: isWorkspaceFetching } =
    useQuery<AdminWorkspaceAiRunsResponse>({
      queryKey: ['admin', 'workspace-ai-runs', { workspaceSearch, workspaceStatus, workspaceRoute, workspaceKind, workspaceModelId, dateFrom, dateTo, workspacePage }],
      queryFn: async () => {
        const params = new URLSearchParams({
          page: String(workspacePage),
          limit: '20',
        });
        if (workspaceSearch.trim()) params.set('search', workspaceSearch.trim());
        if (workspaceStatus !== 'all') params.set('status', workspaceStatus);
        if (workspaceRoute !== 'all') params.set('route', workspaceRoute);
        if (workspaceKind !== 'all') params.set('kind', workspaceKind);
        if (workspaceModelId !== 'all') params.set('modelId', workspaceModelId);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await fetch(`/api/admin/workspace-ai-runs?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch workspace AI runs');
        return res.json();
      },
    });

  const { data: workspaceDetail, isLoading: isWorkspaceDetailLoading } = useQuery<AdminWorkspaceAiRunDetail>({
    queryKey: ['admin', 'workspace-ai-runs', 'detail', selectedWorkspaceRunId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/workspace-ai-runs/${selectedWorkspaceRunId}`);
      if (!res.ok) throw new Error('Failed to fetch workspace AI run detail');
      return res.json();
    },
    enabled: !!selectedWorkspaceRunId,
  });

  const { data: toolData, isLoading: isToolLoading, isFetching: isToolFetching } = useQuery<AdminToolRunsResponse>({
    queryKey: ['admin', 'tool-runs', { toolSearch, toolStatus, toolSlug, toolSource, dateFrom, dateTo, toolPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(toolPage),
        limit: '20',
      });
      if (toolSearch.trim()) params.set('search', toolSearch.trim());
      if (toolStatus !== 'all') params.set('status', toolStatus);
      if (toolSlug !== 'all') params.set('toolSlug', toolSlug);
      if (toolSource !== 'all') params.set('source', toolSource);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/tool-runs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tool runs');
      return res.json();
    },
  });

  const { data: toolDetail, isLoading: isToolDetailLoading } = useQuery<AdminToolRunDetail>({
    queryKey: ['admin', 'tool-runs', 'detail', selectedToolRunId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tool-runs/${selectedToolRunId}`);
      if (!res.ok) throw new Error('Failed to fetch tool run detail');
      return res.json();
    },
    enabled: !!selectedToolRunId,
  });

  const { data: allData, isLoading: isAllLoading, isFetching: isAllFetching } = useQuery<AdminUnifiedRunsResponse>({
    queryKey: ['admin', 'ai-runs', { allSearch, allStatus, allRuntime, dateFrom, dateTo, allPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(allPage),
        limit: '20',
      });
      if (allSearch.trim()) params.set('search', allSearch.trim());
      if (allStatus !== 'all') params.set('status', allStatus);
      if (allRuntime !== 'all') params.set('runtime', allRuntime);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/ai-runs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch unified AI runs');
      return res.json();
    },
  });

  const { data: trendsData, isLoading: isTrendsLoading } = useQuery<AdminAiTrendsResponse>({
    queryKey: ['admin', 'ai-runs', 'trends', { dateFrom, dateTo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/admin/ai-runs/trends?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch AI trends');
      return res.json();
    },
  });

  const chatModelOptions = chatData?.summary.byResolvedModel ?? [];
  const workspaceKindOptions = workspaceData?.summary.byKind ?? [];
  const workspaceModelOptions = workspaceData?.summary.byModel ?? [];
  const toolSlugOptions = toolData?.summary.byToolSlug ?? [];
  const toolSourceOptions = toolData?.summary.bySource ?? [];

  const applyDateShortcut = (days: number) => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(end);
    setChatPage(1);
    setWorkspacePage(1);
    setToolPage(1);
    setAllPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Runs</h1>
        <p className="text-sm text-muted-foreground">
          Admin observability for main chat requests and workspace AI assists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => applyDateShortcut(7)}>
              Last 7d
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => applyDateShortcut(30)}>
              Last 30d
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setChatPage(1);
                setWorkspacePage(1);
                setToolPage(1);
                setAllPage(1);
              }}
            >
              All time
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1.5 text-sm font-medium">From</div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setChatPage(1);
                setWorkspacePage(1);
                setToolPage(1);
                setAllPage(1);
              }}
            />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">To</div>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setChatPage(1);
                setWorkspacePage(1);
                setToolPage(1);
                setAllPage(1);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setChatPage(1);
                setWorkspacePage(1);
                setToolPage(1);
                setAllPage(1);
              }}
            >
              Clear range
            </Button>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trend Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTrendsLoading || !trendsData ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading trend analytics...
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <SummaryCard title="Runs in range" value={trendsData.summary.totalRuns} />
                <SummaryCard title="Errors in range" value={trendsData.summary.totalErrors} />
                <SummaryCard title="Tokens in range" value={trendsData.summary.totalTokens} />
                <SummaryCard title="Credits in range" value={trendsData.summary.totalCredits} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Chat</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>Runs: {trendsData.summary.byRuntime.chat.runCount}</div>
                    <div>Errors: {trendsData.summary.byRuntime.chat.errorCount}</div>
                    <div>Tokens: {trendsData.summary.byRuntime.chat.tokenTotal}</div>
                    <div>Credits: {trendsData.summary.byRuntime.chat.creditTotal}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Workspace AI</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>Runs: {trendsData.summary.byRuntime.workspace.runCount}</div>
                    <div>Errors: {trendsData.summary.byRuntime.workspace.errorCount}</div>
                    <div>Tokens: {trendsData.summary.byRuntime.workspace.tokenTotal}</div>
                    <div>Credits: {trendsData.summary.byRuntime.workspace.creditTotal}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tools</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>Runs: {trendsData.summary.byRuntime.tool.runCount}</div>
                    <div>Errors: {trendsData.summary.byRuntime.tool.errorCount}</div>
                    <div>Tokens: {trendsData.summary.byRuntime.tool.tokenTotal}</div>
                    <div>Credits: {trendsData.summary.byRuntime.tool.creditTotal}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Chat</TableHead>
                      <TableHead>Workspace AI</TableHead>
                      <TableHead>Tools</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Credits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trendsData.daily.map((day) => (
                      <TableRow key={day.day} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{day.day}</TableCell>
                        <TableCell className="text-sm">
                          <div>{day.totalRuns} runs</div>
                          <div className="text-xs text-muted-foreground">{day.totalErrors} errors</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{day.chat.runCount} runs</div>
                          <div className="text-xs text-muted-foreground">{day.chat.errorCount} errors</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{day.workspace.runCount} runs</div>
                          <div className="text-xs text-muted-foreground">{day.workspace.errorCount} errors</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{day.tool.runCount} runs</div>
                          <div className="text-xs text-muted-foreground">{day.tool.errorCount} errors</div>
                        </TableCell>
                        <TableCell className="text-sm">{day.totalTokens}</TableCell>
                        <TableCell className="text-sm">{day.totalCredits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Runs</TabsTrigger>
          <TabsTrigger value="chat">Chat Runs</TabsTrigger>
          <TabsTrigger value="workspace">Workspace AI Runs</TabsTrigger>
          <TabsTrigger value="tools">Tool Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryCard title="Total runs" value={allData?.summary.totalRuns ?? 0} />
            <SummaryCard title="Successful" value={allData?.summary.successCount ?? 0} />
            <SummaryCard title="Errors" value={allData?.summary.errorCount ?? 0} />
            <SummaryCard title="Pending" value={allData?.summary.pendingCount ?? 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unified Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={allSearch}
                  onChange={(event) => {
                    setAllSearch(event.target.value);
                    setAllPage(1);
                  }}
                  placeholder="Search user, model, tool, thread..."
                  className="pl-9"
                />
              </div>

              <Select value={allStatus} onValueChange={(value) => { setAllStatus(value); setAllPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={allRuntime} onValueChange={(value) => { setAllRuntime(value); setAllPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Runtime" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All runtimes</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="workspace">Workspace AI</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Runtime</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Route / Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAllLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : !allData?.runs.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No AI runs found</TableCell>
                  </TableRow>
                ) : (
                  allData.runs.map((run) => (
                    <TableRow key={`${run.runtime}-${run.id}`} className="hover:bg-muted/30">
                      <TableCell className="min-w-40">
                        <div className="space-y-1">
                          <div className="font-medium capitalize">{run.runtime === 'workspace' ? 'Workspace AI' : run.runtime}</div>
                          <div className="text-xs text-muted-foreground">{run.title}</div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-52">
                        <div className="space-y-1">
                          <div className="font-medium">{run.userName || 'Unknown user'}</div>
                          <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[run.status]} className="capitalize">{run.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div>{run.modelOrTarget || '—'}</div>
                          <div className="text-xs text-muted-foreground">{run.subtitle || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{run.routeKind || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(run.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (run.runtime === 'chat') setSelectedChatRunId(run.id);
                            if (run.runtime === 'workspace') setSelectedWorkspaceRunId(run.id);
                            if (run.runtime === 'tool') setSelectedToolRunId(run.id);
                          }}
                        >
                          <EyeIcon className="mr-1.5 size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {allData && allData.totalPages > 1 ? (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Page {allData.page} of {allData.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={allPage <= 1 || isAllFetching} onClick={() => setAllPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={allPage >= allData.totalPages || isAllFetching} onClick={() => setAllPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryCard title="Total runs" value={chatData?.summary.totalRuns ?? 0} />
            <SummaryCard title="Successful" value={chatData?.summary.successCount ?? 0} />
            <SummaryCard title="Errors" value={chatData?.summary.errorCount ?? 0} />
            <SummaryCard title="Pending" value={chatData?.summary.pendingCount ?? 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chat Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={chatSearch}
                  onChange={(event) => {
                    setChatSearch(event.target.value);
                    setChatPage(1);
                  }}
                  placeholder="Search user, email, thread..."
                  className="pl-9"
                />
              </div>

              <Select value={chatStatus} onValueChange={(value) => { setChatStatus(value); setChatPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chatRouteKind} onValueChange={(value) => { setChatRouteKind(value); setChatPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Route kind" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All routes</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chatResolvedModelId} onValueChange={(value) => { setChatResolvedModelId(value); setChatPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Resolved model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models</SelectItem>
                  {chatModelOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isChatLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !chatData?.runs.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No chat runs found
                    </TableCell>
                  </TableRow>
                ) : (
                  chatData.runs.map((run) => (
                    <TableRow key={run.id} className="hover:bg-muted/30">
                      <TableCell className="min-w-52">
                        <div className="space-y-1">
                          <div className="font-medium">{run.userName || 'Unknown user'}</div>
                          <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                          <div className="text-xs text-muted-foreground">Thread {run.threadId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[run.status]} className="capitalize">
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 text-sm capitalize">
                          {run.routeKind === 'image' ? <ImageIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
                          {run.routeKind}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <div className="space-y-1">
                          <div className="text-sm">{run.resolvedModelId || '—'}</div>
                          <div className="text-xs capitalize text-muted-foreground">{run.routingMode || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.usedTools ? (
                          <div className="inline-flex items-center gap-1.5 text-sm">
                            <WrenchIcon className="size-3.5" />
                            {run.toolCallCount}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div>{run.totalTokens ?? 0} tokens</div>
                          <div className="text-xs text-muted-foreground">{run.creditCost ?? 0} credits</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedChatRunId(run.id)}>
                          <EyeIcon className="mr-1.5 size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {chatData && chatData.totalPages > 1 ? (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Page {chatData.page} of {chatData.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={chatPage <= 1 || isChatFetching} onClick={() => setChatPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={chatPage >= chatData.totalPages || isChatFetching} onClick={() => setChatPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="workspace" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryCard title="Total runs" value={workspaceData?.summary.totalRuns ?? 0} />
            <SummaryCard title="Successful" value={workspaceData?.summary.successCount ?? 0} />
            <SummaryCard title="Errors" value={workspaceData?.summary.errorCount ?? 0} />
            <SummaryCard title="Pending" value={workspaceData?.summary.pendingCount ?? 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace AI Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workspaceSearch}
                  onChange={(event) => {
                    setWorkspaceSearch(event.target.value);
                    setWorkspacePage(1);
                  }}
                  placeholder="Search user, kind, entity..."
                  className="pl-9"
                />
              </div>

              <Select value={workspaceStatus} onValueChange={(value) => { setWorkspaceStatus(value); setWorkspacePage(1); }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={workspaceRoute} onValueChange={(value) => { setWorkspaceRoute(value); setWorkspacePage(1); }}>
                <SelectTrigger><SelectValue placeholder="Route" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All routes</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>

              <Select value={workspaceKind} onValueChange={(value) => { setWorkspaceKind(value); setWorkspacePage(1); }}>
                <SelectTrigger><SelectValue placeholder="Kind" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All kinds</SelectItem>
                  {workspaceKindOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={workspaceModelId} onValueChange={(value) => { setWorkspaceModelId(value); setWorkspacePage(1); }}>
                <SelectTrigger><SelectValue placeholder="Model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models</SelectItem>
                  {workspaceModelOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isWorkspaceLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !workspaceData?.runs.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No workspace AI runs found
                    </TableCell>
                  </TableRow>
                ) : (
                  workspaceData.runs.map((run) => (
                    <TableRow key={run.id} className="hover:bg-muted/30">
                      <TableCell className="min-w-52">
                        <div className="space-y-1">
                          <div className="font-medium">{run.userName || 'Unknown user'}</div>
                          <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[run.status]} className="capitalize">
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 text-sm">
                          <SparklesIcon className="size-3.5" />
                          <WorkspaceKindLabel kind={run.kind} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div className="capitalize">{run.entityType}</div>
                          <div className="text-xs text-muted-foreground">{run.entityId || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 text-sm capitalize">
                          {run.route === 'image' ? <ImageIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
                          {run.route}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{run.modelId || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedWorkspaceRunId(run.id)}>
                          <EyeIcon className="mr-1.5 size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {workspaceData && workspaceData.totalPages > 1 ? (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Page {workspaceData.page} of {workspaceData.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={workspacePage <= 1 || isWorkspaceFetching} onClick={() => setWorkspacePage((value) => value - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={workspacePage >= workspaceData.totalPages || isWorkspaceFetching} onClick={() => setWorkspacePage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="tools" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryCard title="Total runs" value={toolData?.summary.totalRuns ?? 0} />
            <SummaryCard title="Successful" value={toolData?.summary.successCount ?? 0} />
            <SummaryCard title="Errors" value={toolData?.summary.errorCount ?? 0} />
            <SummaryCard title="Pending" value={toolData?.summary.pendingCount ?? 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tool Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={toolSearch}
                  onChange={(event) => {
                    setToolSearch(event.target.value);
                    setToolPage(1);
                  }}
                  placeholder="Search user, tool, thread..."
                  className="pl-9"
                />
              </div>

              <Select value={toolStatus} onValueChange={(value) => { setToolStatus(value); setToolPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={toolSlug} onValueChange={(value) => { setToolSlug(value); setToolPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Tool" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tools</SelectItem>
                  {toolSlugOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={toolSource} onValueChange={(value) => { setToolSource(value); setToolPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {toolSourceOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Thread</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isToolLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !toolData?.runs.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No tool runs found
                    </TableCell>
                  </TableRow>
                ) : (
                  toolData.runs.map((run) => (
                    <TableRow key={run.id} className="hover:bg-muted/30">
                      <TableCell className="min-w-52">
                        <div className="space-y-1">
                          <div className="font-medium">{run.userName || 'Unknown user'}</div>
                          <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[run.status]} className="capitalize">
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 text-sm">
                          <WrenchIcon className="size-3.5" />
                          {run.toolSlug}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{run.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{run.threadId || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(run.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedToolRunId(run.id)}>
                          <EyeIcon className="mr-1.5 size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {toolData && toolData.totalPages > 1 ? (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Page {toolData.page} of {toolData.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={toolPage <= 1 || isToolFetching} onClick={() => setToolPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={toolPage >= toolData.totalPages || isToolFetching} onClick={() => setToolPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedChatRunId} onOpenChange={(open) => !open && setSelectedChatRunId(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Chat Run Detail</DialogTitle>
            <DialogDescription>Request-level execution data for the selected main chat run.</DialogDescription>
          </DialogHeader>

          {isChatDetailLoading || !chatDetail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading run detail...
            </div>
          ) : (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Run</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>ID: {chatDetail.id}</div>
                      <div>Status: <span className="capitalize">{chatDetail.status}</span></div>
                      <div>Route: <span className="capitalize">{chatDetail.routeKind}</span></div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">User</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>{chatDetail.userName || 'Unknown user'}</div>
                      <div>{chatDetail.userEmail || chatDetail.userId}</div>
                      <div>Thread {chatDetail.threadId}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Usage</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>Prompt: <TokenValue value={chatDetail.promptTokens} /></div>
                      <div>Completion: <TokenValue value={chatDetail.completionTokens} /></div>
                      <div>Total: <TokenValue value={chatDetail.totalTokens} /></div>
                      <div>Credits: {chatDetail.creditCost ?? '—'}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Input Summary</div>
                    <JsonBlock value={chatDetail.inputJson} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Output Summary</div>
                    <JsonBlock value={chatDetail.outputJson} />
                  </div>
                </div>

                {chatDetail.errorMessage ? (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Error</CardTitle></CardHeader>
                    <CardContent className="text-sm text-destructive">{chatDetail.errorMessage}</CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedWorkspaceRunId} onOpenChange={(open) => !open && setSelectedWorkspaceRunId(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Workspace AI Run Detail</DialogTitle>
            <DialogDescription>Execution data for the selected workspace AI assist run.</DialogDescription>
          </DialogHeader>

          {isWorkspaceDetailLoading || !workspaceDetail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading run detail...
            </div>
          ) : (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Run</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>ID: {workspaceDetail.id}</div>
                      <div>Status: <span className="capitalize">{workspaceDetail.status}</span></div>
                      <div>Route: <span className="capitalize">{workspaceDetail.route}</span></div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">User</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>{workspaceDetail.userName || 'Unknown user'}</div>
                      <div>{workspaceDetail.userEmail || workspaceDetail.userId}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Assist</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div><WorkspaceKindLabel kind={workspaceDetail.kind} /></div>
                      <div className="capitalize">{workspaceDetail.entityType}</div>
                      <div>{workspaceDetail.modelId || '—'}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Input Summary</div>
                    <JsonBlock value={workspaceDetail.inputJson} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Output Summary</div>
                    <JsonBlock value={workspaceDetail.outputJson} />
                  </div>
                </div>

                {workspaceDetail.errorMessage ? (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Error</CardTitle></CardHeader>
                    <CardContent className="text-sm text-destructive">{workspaceDetail.errorMessage}</CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedToolRunId} onOpenChange={(open) => !open && setSelectedToolRunId(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tool Run Detail</DialogTitle>
            <DialogDescription>Execution data for the selected tool run.</DialogDescription>
          </DialogHeader>

          {isToolDetailLoading || !toolDetail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading run detail...
            </div>
          ) : (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Run</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>ID: {toolDetail.id}</div>
                      <div>Status: <span className="capitalize">{toolDetail.status}</span></div>
                      <div>Tool: {toolDetail.toolSlug}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">User</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>{toolDetail.userName || 'Unknown user'}</div>
                      <div>{toolDetail.userEmail || toolDetail.userId}</div>
                      <div>Thread {toolDetail.threadId || '—'}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Source</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div>{toolDetail.source}</div>
                      <div>Created: {formatDate(toolDetail.createdAt)}</div>
                      <div>Completed: {toolDetail.completedAt ? formatDate(toolDetail.completedAt) : '—'}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Input Summary</div>
                    <JsonBlock value={toolDetail.inputJson} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Output Summary</div>
                    <JsonBlock value={toolDetail.outputJson} />
                  </div>
                </div>

                {toolDetail.errorMessage ? (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Error</CardTitle></CardHeader>
                    <CardContent className="text-sm text-destructive">{toolDetail.errorMessage}</CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
