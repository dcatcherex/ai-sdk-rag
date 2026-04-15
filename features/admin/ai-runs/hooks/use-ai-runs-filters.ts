'use client';

import { useCallback, useState } from 'react';

export function useAiRunsFilters() {
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

  const resetAllPages = useCallback(() => {
    setChatPage(1);
    setWorkspacePage(1);
    setToolPage(1);
    setAllPage(1);
  }, []);

  const applyDateShortcut = useCallback(
    (days: number) => {
      const today = new Date();
      const end = today.toISOString().slice(0, 10);
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));
      setDateFrom(start.toISOString().slice(0, 10));
      setDateTo(end);
      resetAllPages();
    },
    [resetAllPages],
  );

  const clearDateRange = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    resetAllPages();
  }, [resetAllPages]);

  const handleViewRun = useCallback((runtime: string, id: string) => {
    if (runtime === 'chat') setSelectedChatRunId(id);
    if (runtime === 'workspace') setSelectedWorkspaceRunId(id);
    if (runtime === 'tool') setSelectedToolRunId(id);
  }, []);

  return {
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    applyDateShortcut,
    clearDateRange,
    resetAllPages,

    chatSearch, setChatSearch,
    chatStatus, setChatStatus,
    chatRouteKind, setChatRouteKind,
    chatResolvedModelId, setChatResolvedModelId,
    chatPage, setChatPage,
    selectedChatRunId, setSelectedChatRunId,

    workspaceSearch, setWorkspaceSearch,
    workspaceStatus, setWorkspaceStatus,
    workspaceRoute, setWorkspaceRoute,
    workspaceKind, setWorkspaceKind,
    workspaceModelId, setWorkspaceModelId,
    workspacePage, setWorkspacePage,
    selectedWorkspaceRunId, setSelectedWorkspaceRunId,

    toolSearch, setToolSearch,
    toolStatus, setToolStatus,
    toolSlug, setToolSlug,
    toolSource, setToolSource,
    toolPage, setToolPage,
    selectedToolRunId, setSelectedToolRunId,

    allSearch, setAllSearch,
    allStatus, setAllStatus,
    allRuntime, setAllRuntime,
    allPage, setAllPage,

    handleViewRun,
  };
}

export type AiRunsFilters = ReturnType<typeof useAiRunsFilters>;
