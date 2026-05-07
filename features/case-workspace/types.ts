import type { z } from 'zod';

import type {
  assignCaseInputSchema,
  createCaseInputSchema,
  createContactInputSchema,
  createTaskInputSchema,
  createTimelineNoteInputSchema,
  createWorkspaceProfileInputSchema,
  exportCaseWorkspaceInputSchema,
  getCaseWorkspaceDashboardInputSchema,
  getCaseContextInputSchema,
  searchCasesInputSchema,
  summarizeCaseInputSchema,
  updateCaseInputSchema,
  updateContactInputSchema,
  updateTaskInputSchema,
} from '@/features/case-workspace/schema';
import type { DomainProfileOwnerContext } from '@/features/domain-profiles/types';

export type CaseWorkspaceProfileStatus = 'active' | 'archived';
export type CaseWorkspaceContactStatus = 'active' | 'archived';
export type CaseWorkspaceCaseStatus = 'new' | 'in_progress' | 'waiting' | 'done' | 'archived';
export type CaseWorkspacePriority = 'low' | 'normal' | 'high' | 'urgent';
export type CaseWorkspaceTaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type CaseWorkspaceTimelineKind =
  | 'note'
  | 'message_summary'
  | 'status_change'
  | 'task_change'
  | 'file_link'
  | 'ai_action';
export type CaseWorkspaceSource = 'web' | 'chat' | 'line' | 'manual';

export type CaseWorkspaceProfile = {
  id: string;
  domain: string;
  name: string;
  description: string | null;
  locale: string;
  status: CaseWorkspaceProfileStatus;
  data: Record<string, unknown>;
};

export type CaseWorkspaceContactData = {
  role?: string;
  organization?: string;
  channel?: string;
  phone?: string;
  email?: string;
  lineUserId?: string;
  notes?: string;
  [key: string]: unknown;
};

export type CaseWorkspaceContact = {
  id: string;
  profileId: string;
  name: string;
  status: CaseWorkspaceContactStatus;
  kind: 'contact';
  data: CaseWorkspaceContactData;
};

export type CaseWorkspaceCaseData = {
  summary?: string;
  source?: CaseWorkspaceSource;
  dueAt?: string;
  lastContactAt?: string;
  nextAction?: string;
  professionType?: string;
  [key: string]: unknown;
};

export type CaseWorkspaceCase = {
  id: string;
  profileId: string;
  name: string;
  status: CaseWorkspaceCaseStatus;
  priority: CaseWorkspacePriority;
  contactId?: string;
  data: CaseWorkspaceCaseData;
};

export type CaseWorkspaceTask = {
  id: string;
  caseId: string;
  title: string;
  status: CaseWorkspaceTaskStatus;
  dueAt?: string;
  assigneeUserId?: string;
  data: Record<string, unknown>;
};

export type CaseWorkspaceTimelineItem = {
  id: string;
  caseId: string;
  kind: CaseWorkspaceTimelineKind;
  title: string;
  body?: string;
  createdAt: string;
  actorUserId?: string;
  data: Record<string, unknown>;
};

export type CaseWorkspaceCaseContext = {
  profile: CaseWorkspaceProfile;
  contact: CaseWorkspaceContact | null;
  case: CaseWorkspaceCase;
  tasks: CaseWorkspaceTask[];
  timeline: CaseWorkspaceTimelineItem[];
};

export type CaseWorkspaceSummary = {
  summary: string;
  replyDraft: string;
};

export type CaseWorkspaceAgingBucket = 'new' | 'stale' | 'aging' | 'critical';

export type CaseWorkspaceDashboardMetrics = {
  totalCases: number;
  openCases: number;
  waitingCases: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedCases: number;
  statusCounts: Record<CaseWorkspaceCaseStatus, number>;
  priorityCounts: Record<CaseWorkspacePriority, number>;
  agingCounts: Record<CaseWorkspaceAgingBucket, number>;
};

export type CaseWorkspaceReminderItem = {
  caseId: string;
  caseName: string;
  profileId: string;
  profileName: string;
  kind: 'follow_up' | 'task_overdue' | 'task_due_soon' | 'case_unassigned';
  message: string;
  dueAt?: string;
  assigneeUserId?: string;
  priority: CaseWorkspacePriority;
};

export type CaseWorkspaceAssignmentSummary = {
  caseId: string;
  assigneeUserId?: string;
  assignedAt?: string;
};

export type CaseWorkspaceDashboard = {
  profile: CaseWorkspaceProfile;
  metrics: CaseWorkspaceDashboardMetrics;
  reminders: CaseWorkspaceReminderItem[];
  overdueTasks: CaseWorkspaceTask[];
  dueSoonTasks: CaseWorkspaceTask[];
};

export type CaseWorkspaceExportFormat = 'csv' | 'pdf';

export type CaseWorkspaceOwnerContext = DomainProfileOwnerContext;

export type CreateWorkspaceProfileInput = z.infer<typeof createWorkspaceProfileInputSchema>;
export type CreateContactInput = z.infer<typeof createContactInputSchema>;
export type UpdateContactInput = z.infer<typeof updateContactInputSchema>;
export type CreateCaseInput = z.infer<typeof createCaseInputSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseInputSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type CreateTimelineNoteInput = z.infer<typeof createTimelineNoteInputSchema>;
export type SearchCasesInput = z.infer<typeof searchCasesInputSchema>;
export type GetCaseContextInput = z.infer<typeof getCaseContextInputSchema>;
export type SummarizeCaseInput = z.infer<typeof summarizeCaseInputSchema>;
export type GetCaseWorkspaceDashboardInput = z.infer<typeof getCaseWorkspaceDashboardInputSchema>;
export type AssignCaseInput = z.infer<typeof assignCaseInputSchema>;
export type ExportCaseWorkspaceInput = z.infer<typeof exportCaseWorkspaceInputSchema>;
