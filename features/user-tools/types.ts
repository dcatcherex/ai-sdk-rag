export type UserToolExecutionType = "webhook" | "workflow";
export type UserToolVisibility = "private" | "shared" | "template" | "published";
export type UserToolStatus = "draft" | "active" | "archived";
export type UserToolShareRole = "runner" | "editor";
export type UserToolWorkspaceShareRole = UserToolShareRole;
export type UserToolSource = "manual" | "agent" | "api" | "test" | "line";

export type UserToolFieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "enum"
  | "date"
  | "json";

export type UserToolField = {
  key: string;
  label: string;
  type: UserToolFieldType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: string[];
  defaultValue?: unknown;
};

export type UserToolWebhookConfig = {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  timeoutMs?: number;
  headersTemplate?: Record<string, string>;
  requestBodyMode: "json";
  requestTemplate?: Record<string, unknown>;
  responseDataPath?: string;
};

export type UserToolWorkflowStepBase = {
  id?: string;
  artifactLabel?: string;
  persistArtifact?: boolean;
};

export type UserToolCreateCampaignBriefStep = UserToolWorkflowStepBase & {
  kind: "create_campaign_brief";
  input: Record<string, unknown>;
};

export type UserToolCreateCalendarEntryStep = UserToolWorkflowStepBase & {
  kind: "create_calendar_entry";
  input: Record<string, unknown>;
};

export type UserToolCreateSocialPostStep = UserToolWorkflowStepBase & {
  kind: "create_social_post";
  input: Record<string, unknown>;
};

export type UserToolWorkflowStep =
  | UserToolCreateCampaignBriefStep
  | UserToolCreateCalendarEntryStep
  | UserToolCreateSocialPostStep;

export type UserToolWorkflowConfig = {
  steps: UserToolWorkflowStep[];
};

export type UserToolExecutionConfig =
  | { type: "webhook"; webhook: UserToolWebhookConfig }
  | { type: "workflow"; workflow: UserToolWorkflowConfig };

export type UserToolDefinition = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  category: string;
  executionType: UserToolExecutionType;
  visibility: UserToolVisibility;
  status: UserToolStatus;
  readOnly: boolean;
  requiresConfirmation: boolean;
  supportsAgent: boolean;
  supportsManualRun: boolean;
  latestVersion: number;
  activeVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserToolVersionDefinition = {
  id: string;
  toolId: string;
  version: number;
  inputSchemaJson: UserToolField[];
  outputSchemaJson: UserToolField[];
  configJson: UserToolExecutionConfig;
  changeSummary: string | null;
  isDraft: boolean;
};

export type AgentUserToolAttachmentInput = {
  userToolId: string;
  isEnabled?: boolean;
  priority?: number;
  notes?: string | null;
};

export type UserToolSharedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserToolShareRole;
};

export type UserToolSharedWorkspace = {
  brandId: string;
  brandName: string;
  role: UserToolWorkspaceShareRole;
};

export type UserToolShareableWorkspace = {
  id: string;
  name: string;
  access: "owner" | "admin";
};

export type AgentUserToolAttachment = {
  id: string;
  agentId: string;
  userToolId: string;
  isEnabled: boolean;
  priority: number;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};
