'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Download,
  FileText,
  Plus,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ToolManifest } from '@/features/tools/registry/types';
import {
  useAddCaseNote,
  useCaseContext,
  useCaseSearch,
  useCaseWorkspaceDashboard,
  useCaseWorkspaceContacts,
  useCaseWorkspaceProfiles,
  useAssignCase,
  useCreateCase,
  useCreateContact,
  useCreateCaseWorkspaceProfile,
  useCreateTask,
  useSummarizeCase,
  useUpdateCase,
  useUpdateTask,
} from '@/features/case-workspace/hooks/use-case-workspace';
import type { SearchCasesInput } from '@/features/case-workspace/types';
import { CaseDetailPanel } from './case-detail-panel';
import { CaseIntakeDialog } from './case-intake-dialog';
import { CaseList } from './case-list';
import { TaskList } from './task-list';

type Props = {
  manifest: ToolManifest;
};

export function CaseWorkspaceToolPage({ manifest }: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>();
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>();
  const [status, setStatus] = useState<'all' | SearchCasesInput['status']>('all');
  const [priority, setPriority] = useState<'all' | SearchCasesInput['priority']>('all');
  const [source, setSource] = useState<'all' | NonNullable<SearchCasesInput['source']>>('all');
  const [query, setQuery] = useState('');
  const [dueSoonOnly, setDueSoonOnly] = useState(false);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [dialogMode, setDialogMode] = useState<'profile' | 'contact' | 'case' | 'task' | 'note' | null>(null);

  const profilesQuery = useCaseWorkspaceProfiles();
  const profiles = profilesQuery.data?.profiles ?? [];

  const filters = useMemo<SearchCasesInput>(() => ({
    profileId: selectedProfileId,
    query: query || undefined,
    status: status === 'all' ? undefined : status,
    priority: priority === 'all' ? undefined : priority,
    source: source === 'all' ? undefined : source,
    dueSoon: dueSoonOnly || undefined,
    waitingOnReply: waitingOnly || undefined,
    assignedToMe: assignedOnly || undefined,
    limit: 50,
  }), [assignedOnly, dueSoonOnly, priority, query, selectedProfileId, source, status, waitingOnly]);

  const casesQuery = useCaseSearch(filters);
  const contactsQuery = useCaseWorkspaceContacts(selectedProfileId);
  const contextQuery = useCaseContext(selectedCaseId);
  const dashboardQuery = useCaseWorkspaceDashboard(selectedProfileId);

  const createProfileMutation = useCreateCaseWorkspaceProfile();
  const createContactMutation = useCreateContact();
  const createCaseMutation = useCreateCase();
  const assignCaseMutation = useAssignCase(selectedCaseId);
  const createTaskMutation = useCreateTask(selectedCaseId);
  const addCaseNoteMutation = useAddCaseNote(selectedCaseId);
  const updateTaskMutation = useUpdateTask(selectedCaseId);
  const updateCaseMutation = useUpdateCase(selectedCaseId);
  const summarizeCaseMutation = useSummarizeCase(selectedCaseId);

  const selectedContext = contextQuery.data?.context ?? null;
  const cases = casesQuery.data?.cases ?? [];
  const contacts = contactsQuery.data?.contacts ?? [];
  const summary = summarizeCaseMutation.data?.summary ?? null;
  const dashboard = dashboardQuery.data?.dashboard;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={manifest.title}
        description={manifest.description}
        icon={<BriefcaseBusiness className="size-5" />}
        action={(
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedProfileId}
              onClick={() => {
                if (!selectedProfileId) return;
                window.open(`/api/case-workspace/profiles/${selectedProfileId}/export?format=csv`, '_blank');
              }}
            >
              <Download className="size-4" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedProfileId}
              onClick={() => {
                if (!selectedProfileId) return;
                window.open(`/api/case-workspace/profiles/${selectedProfileId}/export?format=pdf`, '_blank');
              }}
            >
              <FileText className="size-4" />
              PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialogMode('profile')}>
              <BriefcaseBusiness className="size-4" />
              New workspace
            </Button>
            <Button size="sm" variant="outline" disabled={!selectedProfileId} onClick={() => setDialogMode('contact')}>
              <UserPlus className="size-4" />
              New contact
            </Button>
            <Button size="sm" disabled={!selectedProfileId} onClick={() => setDialogMode('case')}>
              <Plus className="size-4" />
              New case
            </Button>
          </div>
        )}
      />

      <div className="grid flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[280px_minmax(0,1fr)_320px] md:p-6">
        <section className="flex min-h-0 flex-col rounded-lg border">
          <div className="space-y-3 border-b p-4">
            <Select
              value={selectedProfileId}
              onValueChange={(value) => {
                setSelectedProfileId(value);
                setSelectedCaseId(undefined);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select workspace profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profiles.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Create a workspace profile before adding contacts or cases.
              </div>
            ) : null}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cases"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={source} onValueChange={(value) => setSource(value as typeof source)}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={dueSoonOnly ? 'secondary' : 'outline'}
                  className="flex-1"
                  onClick={() => setDueSoonOnly((value) => !value)}
                >
                  Due soon
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={waitingOnly ? 'secondary' : 'outline'}
                  className="flex-1"
                  onClick={() => setWaitingOnly((value) => !value)}
                >
                  Waiting
                </Button>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={assignedOnly ? 'secondary' : 'outline'}
              onClick={() => setAssignedOnly((value) => !value)}
            >
              Assigned to me
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <CaseList
              cases={cases}
              selectedCaseId={selectedCaseId}
              onSelectCase={setSelectedCaseId}
            />
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto rounded-lg border p-4">
          {dashboard ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open cases</div>
                <div className="mt-1 text-2xl font-semibold">{dashboard.metrics.openCases}</div>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Waiting</div>
                <div className="mt-1 text-2xl font-semibold">{dashboard.metrics.waitingCases}</div>
              </div>
              <div className="rounded-lg border px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Overdue tasks</div>
                <div className="mt-1 text-2xl font-semibold">{dashboard.metrics.overdueTasks}</div>
              </div>
            </div>
          ) : null}
          <CaseDetailPanel context={selectedContext} summary={summary} />
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border">
          <div className="border-b p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Work panel</h2>
                <p className="text-xs text-muted-foreground">
                  Tasks, contact context, and quick actions.
                </p>
              </div>
              {selectedContext ? (
                <Badge variant="outline" className="capitalize">
                  {selectedContext.case.status.replace('_', ' ')}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {selectedContext?.contact ? (
              <div className="rounded-lg border px-3 py-3">
                <h3 className="text-sm font-medium">{selectedContext.contact.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedContext.contact.data.organization ?? 'No organization set'}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {selectedContext.contact.data.phone ? <div>{selectedContext.contact.data.phone}</div> : null}
                  {selectedContext.contact.data.email ? <div>{selectedContext.contact.data.email}</div> : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCaseId || assignCaseMutation.isPending}
                onClick={() => assignCaseMutation.mutate({ assigneeUserId: 'me' })}
              >
                <UserCheck className="size-4" />
                Assign to me
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCaseId || assignCaseMutation.isPending}
                onClick={() => assignCaseMutation.mutate({ assigneeUserId: null })}
              >
                Clear assignment
              </Button>
              <Button size="sm" variant="outline" disabled={!selectedCaseId} onClick={() => setDialogMode('note')}>
                <FileText className="size-4" />
                Add note
              </Button>
              <Button size="sm" variant="outline" disabled={!selectedCaseId} onClick={() => setDialogMode('task')}>
                <Plus className="size-4" />
                Add task
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCaseId || summarizeCaseMutation.isPending}
                onClick={() => summarizeCaseMutation.mutate()}
              >
                <Sparkles className="size-4" />
                Generate summary
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCaseId}
                onClick={() => updateCaseMutation.mutate({ status: 'waiting' })}
              >
                Waiting on reply
              </Button>
            </div>

            <TaskList
              tasks={selectedContext?.tasks ?? []}
              onMarkDone={(taskId) => updateTaskMutation.mutate({ taskId, patch: { status: 'done' } })}
            />

            <div className="rounded-lg border px-3 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Reminders</h3>
              </div>
              <div className="mt-3 space-y-2">
                {!dashboard || dashboard.reminders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active reminders.</p>
                ) : dashboard.reminders.slice(0, 6).map((item) => (
                  <div key={`${item.kind}-${item.caseId}-${item.message}`} className="rounded-md border px-3 py-2">
                    <div className="text-sm font-medium">{item.caseName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.message}</div>
                    {item.dueAt ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">Due {item.dueAt}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border px-3 py-3">
              <h3 className="text-sm font-medium">Contacts in profile</h3>
              <div className="mt-3 space-y-2">
                {contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No contacts yet.</p>
                ) : contacts.map((contact) => (
                  <div key={contact.id} className="rounded-md border px-3 py-2 text-sm">
                    {contact.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <CaseIntakeDialog
        mode={dialogMode ?? 'case'}
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
        onSubmit={async ({ title, body, dueAt }) => {
          if (dialogMode === 'profile') {
            const created = await createProfileMutation.mutateAsync({
              domain: 'general',
              name: title,
              description: body || undefined,
              locale: 'th-TH',
              data: { source: 'web' },
            });
            setSelectedProfileId(created.profile.id);
            setSelectedCaseId(undefined);
            return;
          }

          if (!selectedProfileId) {
            return;
          }

          if (dialogMode === 'contact' && selectedProfileId) {
            await createContactMutation.mutateAsync({
              profileId: selectedProfileId,
              name: title,
              description: body || undefined,
            });
            return;
          }

          if (dialogMode === 'case' && selectedProfileId) {
            await createCaseMutation.mutateAsync({
              profileId: selectedProfileId,
              name: title,
              description: body || undefined,
            });
            return;
          }

          if (dialogMode === 'task' && selectedCaseId) {
            await createTaskMutation.mutateAsync({
              profileId: selectedProfileId,
              title,
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
              data: body ? { details: body } : undefined,
            });
            return;
          }

          if (dialogMode === 'note' && selectedCaseId) {
            await addCaseNoteMutation.mutateAsync({
              profileId: selectedProfileId,
              title,
              body,
            });
          }
        }}
      />
    </div>
  );
}
