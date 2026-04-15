'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAiRunsFilters } from '@/features/admin/ai-runs/hooks/use-ai-runs-filters';
import { useAiRunsQueries } from '@/features/admin/ai-runs/hooks/use-ai-runs-queries';
import { DateRangeFilter } from '@/features/admin/ai-runs/components/date-range-filter';
import { TrendAnalytics } from '@/features/admin/ai-runs/components/trend-analytics';
import { AllRunsTab } from '@/features/admin/ai-runs/components/tabs/all-runs-tab';
import { ChatRunsTab } from '@/features/admin/ai-runs/components/tabs/chat-runs-tab';
import { WorkspaceRunsTab } from '@/features/admin/ai-runs/components/tabs/workspace-runs-tab';
import { ToolRunsTab } from '@/features/admin/ai-runs/components/tabs/tool-runs-tab';
import { ChatRunDetailDialog } from '@/features/admin/ai-runs/components/dialogs/chat-run-detail-dialog';
import { WorkspaceRunDetailDialog } from '@/features/admin/ai-runs/components/dialogs/workspace-run-detail-dialog';
import { ToolRunDetailDialog } from '@/features/admin/ai-runs/components/dialogs/tool-run-detail-dialog';

export default function AdminChatRunsPage() {
  const f = useAiRunsFilters();
  const q = useAiRunsQueries(f);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Runs</h1>
        <p className="text-sm text-muted-foreground">
          Admin observability for main chat requests and workspace AI assists.
        </p>
      </div>

      <DateRangeFilter
        dateFrom={f.dateFrom}
        dateTo={f.dateTo}
        onDateFromChange={(v) => { f.setDateFrom(v); f.resetAllPages(); }}
        onDateToChange={(v) => { f.setDateTo(v); f.resetAllPages(); }}
        onApplyShortcut={f.applyDateShortcut}
        onClear={f.clearDateRange}
      />

      <TrendAnalytics data={q.trends.data} isLoading={q.trends.isLoading} />

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Runs</TabsTrigger>
          <TabsTrigger value="chat">Chat Runs</TabsTrigger>
          <TabsTrigger value="workspace">Workspace AI Runs</TabsTrigger>
          <TabsTrigger value="tools">Tool Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AllRunsTab
            data={q.all.data}
            isLoading={q.all.isLoading}
            isFetching={q.all.isFetching}
            search={f.allSearch}
            status={f.allStatus}
            runtime={f.allRuntime}
            page={f.allPage}
            onSearchChange={(v) => { f.setAllSearch(v); f.setAllPage(1); }}
            onStatusChange={(v) => { f.setAllStatus(v); f.setAllPage(1); }}
            onRuntimeChange={(v) => { f.setAllRuntime(v); f.setAllPage(1); }}
            onPageChange={f.setAllPage}
            onViewRun={f.handleViewRun}
          />
        </TabsContent>

        <TabsContent value="chat">
          <ChatRunsTab
            data={q.chat.data}
            isLoading={q.chat.isLoading}
            isFetching={q.chat.isFetching}
            search={f.chatSearch}
            status={f.chatStatus}
            routeKind={f.chatRouteKind}
            resolvedModelId={f.chatResolvedModelId}
            page={f.chatPage}
            onSearchChange={(v) => { f.setChatSearch(v); f.setChatPage(1); }}
            onStatusChange={(v) => { f.setChatStatus(v); f.setChatPage(1); }}
            onRouteKindChange={(v) => { f.setChatRouteKind(v); f.setChatPage(1); }}
            onResolvedModelIdChange={(v) => { f.setChatResolvedModelId(v); f.setChatPage(1); }}
            onPageChange={f.setChatPage}
            onViewRun={f.setSelectedChatRunId}
          />
        </TabsContent>

        <TabsContent value="workspace">
          <WorkspaceRunsTab
            data={q.workspace.data}
            isLoading={q.workspace.isLoading}
            isFetching={q.workspace.isFetching}
            search={f.workspaceSearch}
            status={f.workspaceStatus}
            route={f.workspaceRoute}
            kind={f.workspaceKind}
            modelId={f.workspaceModelId}
            page={f.workspacePage}
            onSearchChange={(v) => { f.setWorkspaceSearch(v); f.setWorkspacePage(1); }}
            onStatusChange={(v) => { f.setWorkspaceStatus(v); f.setWorkspacePage(1); }}
            onRouteChange={(v) => { f.setWorkspaceRoute(v); f.setWorkspacePage(1); }}
            onKindChange={(v) => { f.setWorkspaceKind(v); f.setWorkspacePage(1); }}
            onModelIdChange={(v) => { f.setWorkspaceModelId(v); f.setWorkspacePage(1); }}
            onPageChange={f.setWorkspacePage}
            onViewRun={f.setSelectedWorkspaceRunId}
          />
        </TabsContent>

        <TabsContent value="tools">
          <ToolRunsTab
            data={q.tool.data}
            isLoading={q.tool.isLoading}
            isFetching={q.tool.isFetching}
            search={f.toolSearch}
            status={f.toolStatus}
            slug={f.toolSlug}
            source={f.toolSource}
            page={f.toolPage}
            onSearchChange={(v) => { f.setToolSearch(v); f.setToolPage(1); }}
            onStatusChange={(v) => { f.setToolStatus(v); f.setToolPage(1); }}
            onSlugChange={(v) => { f.setToolSlug(v); f.setToolPage(1); }}
            onSourceChange={(v) => { f.setToolSource(v); f.setToolPage(1); }}
            onPageChange={f.setToolPage}
            onViewRun={f.setSelectedToolRunId}
          />
        </TabsContent>
      </Tabs>

      <ChatRunDetailDialog
        open={!!f.selectedChatRunId}
        onOpenChange={(open) => !open && f.setSelectedChatRunId(null)}
        detail={q.chatDetail.data}
        isLoading={q.chatDetail.isLoading}
      />

      <WorkspaceRunDetailDialog
        open={!!f.selectedWorkspaceRunId}
        onOpenChange={(open) => !open && f.setSelectedWorkspaceRunId(null)}
        detail={q.workspaceDetail.data}
        isLoading={q.workspaceDetail.isLoading}
      />

      <ToolRunDetailDialog
        open={!!f.selectedToolRunId}
        onOpenChange={(open) => !open && f.setSelectedToolRunId(null)}
        detail={q.toolDetail.data}
        isLoading={q.toolDetail.isLoading}
      />
    </div>
  );
}
