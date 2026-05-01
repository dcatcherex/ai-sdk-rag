'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WrenchIcon } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useUserSearch } from '@/features/agents/hooks/use-user-search';
import type { SharedUser } from '@/features/agents/types';
import { ToolBuilder } from './tool-builder';
import { ToolRunHistory } from './tool-run-history';
import { ToolRunner } from './tool-runner';
import { ToolSharingSection } from './tool-sharing-section';
import {
  useAddUserToolShare,
  useAddUserToolWorkspaceShare,
  useCreateUserTool,
  useCreateUserToolVersion,
  usePublishUserTool,
  useRemoveUserToolShare,
  useRemoveUserToolWorkspaceShare,
  useRunUserTool,
  useUpdateUserTool,
  useUserToolDetail,
  useUserToolRuns,
  useUserToolShareableWorkspaces,
  useUserTools,
  type CreateUserToolInput,
  type UserToolDetail,
  type UserToolField,
} from '../hooks/use-user-tools';

type ToolBuilderFormState = {
  name: string;
  slug: string;
  description: string;
  category: string;
  executionType: 'webhook' | 'workflow';
  readOnly: boolean;
  requiresConfirmation: boolean;
  supportsAgent: boolean;
  supportsManualRun: boolean;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  webhookUrl: string;
  inputSchemaText: string;
  outputSchemaText: string;
  requestTemplateText: string;
  workflowStepsText: string;
};

const DEFAULT_INPUT_SCHEMA = JSON.stringify([
  { key: 'query', label: 'Query', type: 'text', required: true },
], null, 2);

const DEFAULT_OUTPUT_SCHEMA = JSON.stringify([
  { key: 'result', label: 'Result', type: 'json', required: true },
], null, 2);

const DEFAULT_REQUEST_TEMPLATE = JSON.stringify({
  query: '{{input.query}}',
}, null, 2);

const DEFAULT_WORKFLOW_STEPS = JSON.stringify([
  {
    id: 'campaign',
    kind: 'create_campaign_brief',
    artifactLabel: 'Campaign brief',
    input: {
      title: '{{input.title}}',
      goal: '{{input.goal}}',
      keyMessage: '{{input.keyMessage}}',
      channels: ['instagram', 'facebook'],
      status: 'draft',
    },
  },
  {
    id: 'calendar_entry',
    kind: 'create_calendar_entry',
    artifactLabel: 'Calendar entry',
    input: {
      title: '{{steps.campaign.title}}',
      contentType: 'social',
      channel: 'instagram',
      plannedDate: '{{input.plannedDate}}',
      campaignId: '{{steps.campaign.id}}',
      notes: '{{input.notes}}',
      status: 'idea',
    },
  },
], null, 2);

function createEmptyForm(): ToolBuilderFormState {
  return {
    name: '',
    slug: '',
    description: '',
    category: 'utilities',
    executionType: 'webhook',
    readOnly: true,
    requiresConfirmation: false,
    supportsAgent: true,
    supportsManualRun: true,
    method: 'POST',
    webhookUrl: '',
    inputSchemaText: DEFAULT_INPUT_SCHEMA,
    outputSchemaText: DEFAULT_OUTPUT_SCHEMA,
    requestTemplateText: DEFAULT_REQUEST_TEMPLATE,
    workflowStepsText: DEFAULT_WORKFLOW_STEPS,
  };
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function loadFormFromTool(tool: UserToolDetail): ToolBuilderFormState {
  const config = tool.activeVersion?.configJson as
    | {
      type?: string;
      webhook?: { url?: string; method?: string; requestTemplate?: Record<string, unknown> };
      workflow?: { steps?: unknown[] };
    }
    | undefined;
  const executionType = config?.type === 'workflow' ? 'workflow' : 'webhook';

  return {
    name: tool.tool.name,
    slug: tool.tool.slug,
    description: tool.tool.description ?? '',
    category: tool.tool.category,
    executionType,
    readOnly: tool.tool.readOnly,
    requiresConfirmation: tool.tool.requiresConfirmation,
    supportsAgent: tool.tool.supportsAgent,
    supportsManualRun: tool.tool.supportsManualRun,
    method: (config?.webhook?.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | undefined) ?? 'POST',
    webhookUrl: config?.webhook?.url ?? '',
    inputSchemaText: stringifyJson(tool.activeVersion?.inputSchemaJson ?? []),
    outputSchemaText: stringifyJson(tool.activeVersion?.outputSchemaJson ?? []),
    requestTemplateText: stringifyJson(config?.webhook?.requestTemplate ?? {}),
    workflowStepsText: stringifyJson(config?.workflow?.steps ?? []),
  };
}

function buildExecutionConfig(form: ToolBuilderFormState) {
  if (form.executionType === 'workflow') {
    return {
      type: 'workflow' as const,
      workflow: {
        steps: parseJson(form.workflowStepsText, 'Workflow steps'),
      },
    };
  }

  return {
    type: 'webhook' as const,
    webhook: {
      url: form.webhookUrl.trim(),
      method: form.method,
      requestBodyMode: 'json' as const,
      requestTemplate: parseJson(form.requestTemplateText, 'Request template'),
    },
  };
}

export function UserToolsPage() {
  const { data, isLoading } = useUserTools();
  const createTool = useCreateUserTool();
  const updateTool = useUpdateUserTool();
  const createToolVersion = useCreateUserToolVersion();
  const publishTool = usePublishUserTool();
  const runTool = useRunUserTool();
  const addShare = useAddUserToolShare();
  const removeShare = useRemoveUserToolShare();
  const addWorkspaceShare = useAddUserToolWorkspaceShare();
  const removeWorkspaceShare = useRemoveUserToolWorkspaceShare();
  const [selectedToolId, setSelectedToolId] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder');
  const [testInputText, setTestInputText] = useState('{\n  "query": "example"\n}');
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [shareSearch, setShareSearch] = useState('');
  const [userShareRole, setUserShareRole] = useState<'runner' | 'editor'>('runner');
  const [workspaceShareRole, setWorkspaceShareRole] = useState<'runner' | 'editor'>('runner');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [form, setForm] = useState<ToolBuilderFormState>(createEmptyForm);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);

  const tools = data?.tools ?? [];
  const resolvedSelectedToolId = selectedToolId === undefined ? (tools[0]?.id ?? null) : selectedToolId;
  const detailQuery = useUserToolDetail(resolvedSelectedToolId);
  const runsQuery = useUserToolRuns(resolvedSelectedToolId);
  const selectedTool = detailQuery.data ?? null;
  const { data: shareSearchResults = [] } = useUserSearch(shareSearch);
  const { data: shareableWorkspaceData } = useUserToolShareableWorkspaces();
  const shareableWorkspaces = shareableWorkspaceData?.workspaces ?? [];

  const counts = useMemo(() => {
    return {
      all: tools.length,
      active: tools.filter((tool) => tool.status === 'active').length,
      draft: tools.filter((tool) => tool.status === 'draft').length,
    };
  }, [tools]);

  const scrollEditorToTop = () => {
    editorScrollRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  useEffect(() => {
    if (!selectedTool || activeTab !== 'builder') {
      return;
    }

    setForm(loadFormFromTool(selectedTool));
    scrollEditorToTop();
  }, [activeTab, selectedTool]);

  const handleCreate = () => {
    try {
      const payload: CreateUserToolInput = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || 'utilities',
        executionType: form.executionType,
        readOnly: form.readOnly,
        requiresConfirmation: form.requiresConfirmation,
        supportsAgent: form.supportsAgent,
        supportsManualRun: form.supportsManualRun,
        initialVersion: {
          inputSchema: parseJson(form.inputSchemaText, 'Input schema'),
          outputSchema: parseJson(form.outputSchemaText, 'Output schema'),
          config: buildExecutionConfig(form),
          activate: true,
          isDraft: false,
          changeSummary: 'Initial version',
        },
      };

      createTool.mutate(payload, {
        onSuccess: (result) => {
          toast.success('User tool created');
          setSelectedToolId(result.tool.id);
          setLastResult(null);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to create tool');
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleStartNewDraft = () => {
    setForm(createEmptyForm());
    setSelectedToolId(null);
    setActiveTab('builder');
    setLastResult(null);
    scrollEditorToTop();
  };

  const handleSave = () => {
    if (!selectedTool?.tool.id) {
      toast.error('Select a tool first');
      return;
    }

    try {
      const inputSchema = parseJson<UserToolField[]>(form.inputSchemaText, 'Input schema');
      const outputSchema = parseJson<UserToolField[]>(form.outputSchemaText, 'Output schema');

      updateTool.mutate(
        {
          toolId: selectedTool.tool.id,
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || null,
          category: form.category.trim() || 'utilities',
          executionType: form.executionType,
          readOnly: form.readOnly,
          requiresConfirmation: form.requiresConfirmation,
          supportsAgent: form.supportsAgent,
          supportsManualRun: form.supportsManualRun,
        },
        {
          onSuccess: () => {
            createToolVersion.mutate(
              {
                toolId: selectedTool.tool.id,
                inputSchema,
                outputSchema,
                config: buildExecutionConfig(form),
                activate: true,
                isDraft: true,
                changeSummary: 'Updated from builder',
              },
              {
                onSuccess: () => toast.success('Tool version saved'),
                onError: (error) => {
                  toast.error(error instanceof Error ? error.message : 'Failed to save tool version');
                },
              },
            );
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to update tool metadata');
          },
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleRun = (mode: 'test' | 'run') => {
    if (!resolvedSelectedToolId) {
      toast.error('Create or select a tool first');
      return;
    }

    try {
      const input = parseJson<Record<string, unknown>>(testInputText, 'Test input');
      const requiresConfirmation = Boolean(selectedTool?.tool.requiresConfirmation || selectedTool?.tool.readOnly === false);
      if (requiresConfirmation) {
        const ok = window.confirm(
          mode === 'test'
            ? 'This tool may call an external service or change data. Run this test now?'
            : 'This tool may call an external service or change data. Run it now?',
        );
        if (!ok) return;
      }

      runTool.mutate(
        { toolId: resolvedSelectedToolId, input, mode, confirmed: requiresConfirmation },
        {
          onSuccess: (result) => {
            setLastResult(result);
            toast.success(mode === 'test' ? 'Test completed' : 'Run completed');
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Tool run failed');
          },
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleShareAdd = (user: SharedUser) => {
    if (!selectedTool?.tool.id) return;
    addShare.mutate(
      {
        toolId: selectedTool.tool.id,
        userId: user.id,
        role: userShareRole,
      },
      {
        onSuccess: () => {
          toast.success('Tool shared');
          setShareSearch('');
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to share tool');
        },
      },
    );
  };

  const handleShareRemove = (userId: string) => {
    if (!selectedTool?.tool.id) return;
    removeShare.mutate(
      {
        toolId: selectedTool.tool.id,
        userId,
      },
      {
        onSuccess: () => toast.success('Share removed'),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to remove share');
        },
      },
    );
  };

  const handleWorkspaceShareAdd = () => {
    if (!selectedTool?.tool.id || !selectedWorkspaceId) return;

    addWorkspaceShare.mutate(
      {
        toolId: selectedTool.tool.id,
        brandId: selectedWorkspaceId,
        role: workspaceShareRole,
      },
      {
        onSuccess: () => {
          toast.success('Workspace shared');
          setSelectedWorkspaceId('');
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to share tool with workspace');
        },
      },
    );
  };

  const handleWorkspaceShareRemove = (brandId: string) => {
    if (!selectedTool?.tool.id) return;

    removeWorkspaceShare.mutate(
      {
        toolId: selectedTool.tool.id,
        brandId,
      },
      {
        onSuccess: () => toast.success('Workspace share removed'),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to remove workspace share');
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="User Tools"
        description="Create webhook actions or native workflows that your agents can call with structured inputs."
        icon={<WrenchIcon className="size-4" />}
        action={(
          <div className="flex gap-2">
            {selectedTool?.tool.id && selectedTool.activeVersion?.version && selectedTool.activeVersion.isDraft ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  publishTool.mutate(
                    { toolId: selectedTool.tool.id, version: selectedTool.activeVersion!.version },
                    {
                      onSuccess: () => toast.success('Tool published'),
                      onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to publish tool'),
                    },
                  );
                }}
                disabled={publishTool.isPending}
              >
                Publish
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleStartNewDraft}>
              New draft
            </Button>
          </div>
        )}
      />

      <div className="flex-1 p-6">
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-xl border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">Library</p>
              <p className="text-xs text-muted-foreground">
                {counts.all} total - {counts.active} active - {counts.draft} draft
              </p>
            </div>
            <div className="space-y-2 p-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No user-created tools yet.</p>
              ) : (
                tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setSelectedToolId(tool.id);
                      setActiveTab('builder');
                      scrollEditorToTop();
                    }}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      resolvedSelectedToolId === tool.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-medium">{tool.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tool.slug}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {tool.executionType} - v{tool.activeVersion ?? 0} - {tool.status}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div ref={editorScrollRef} className="min-w-0 rounded-xl border">
              <div className="border-b px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedTool ? selectedTool.tool.name : 'Draft editor'}</p>
                    <p className="text-xs text-muted-foreground">
                        {selectedTool
                          ? `Editing ${selectedTool.tool.executionType} v${selectedTool.activeVersion?.version ?? 'none'}`
                          : 'Fill in the draft below, then create a new webhook or workflow tool.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={activeTab === 'builder' ? 'default' : 'outline'}
                      onClick={() => setActiveTab('builder')}
                    >
                      Builder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeTab === 'history' ? 'default' : 'outline'}
                      onClick={() => setActiveTab('history')}
                    >
                      History ({runsQuery.data?.runs.length ?? 0})
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {activeTab === 'builder' ? (
                  <div className="space-y-4">
                    {!selectedTool ? (
                      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        This is a fresh draft. Nothing is saved yet.
                      </div>
                    ) : null}
                    <ToolBuilder
                      form={form}
                      selectedTool={selectedTool}
                      isPending={createTool.isPending || updateTool.isPending || createToolVersion.isPending}
                      onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                      onCreate={handleCreate}
                      onSave={handleSave}
                      onLoadFromTool={(tool) => {
                        setForm(loadFormFromTool(tool));
                        setSelectedToolId(tool.tool.id);
                      }}
                    />
                  </div>
                ) : (
                  <ToolRunHistory runs={runsQuery.data?.runs ?? []} />
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border p-4">
              <ToolRunner
                testInputText={testInputText}
                lastResult={lastResult}
                isPending={runTool.isPending}
                disabled={!resolvedSelectedToolId}
                onChange={setTestInputText}
                onRun={handleRun}
              />
            </div>

            {selectedTool?.isOwner ? (
              <ToolSharingSection
                shareSearch={shareSearch}
                userShareRole={userShareRole}
                workspaceShareRole={workspaceShareRole}
                selectedWorkspaceId={selectedWorkspaceId}
                sharedWith={selectedTool.sharedWith}
                workspaceShares={selectedTool.workspaceShares}
                shareableWorkspaces={shareableWorkspaces}
                searchResults={shareSearchResults}
                showNoResults={shareSearch.trim().length >= 2 && shareSearchResults.length === 0}
                isPending={
                  addShare.isPending
                  || removeShare.isPending
                  || addWorkspaceShare.isPending
                  || removeWorkspaceShare.isPending
                }
                onShareSearchChange={setShareSearch}
                onUserShareRoleChange={setUserShareRole}
                onWorkspaceShareRoleChange={setWorkspaceShareRole}
                onSelectedWorkspaceChange={setSelectedWorkspaceId}
                onAdd={handleShareAdd}
                onRemove={handleShareRemove}
                onAddWorkspace={handleWorkspaceShareAdd}
                onRemoveWorkspace={handleWorkspaceShareRemove}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
