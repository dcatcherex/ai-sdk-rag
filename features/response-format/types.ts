export type ResponseChannel = 'line' | 'web';
export type ResponseWorkflowCapability =
  | 'workflow.request_human_review'
  | 'workflow.assign_reviewer'
  | 'workflow.view_review_queue'
  | 'workflow.resolve'
  | 'conversation.read_escalated';
export type ResponseWorkflowScopeType =
  | 'user'
  | 'brand'
  | 'channel'
  | 'workspace'
  | 'line_user'
  | 'system';
export type ResponseWorkflowStatus = 'suggested' | 'created' | 'restricted';

export type ResponseFormat =
  | 'plain_text'
  | 'structured_text'
  | 'quick_replies'
  | 'card'
  | 'workflow';

export type ResponseIntent =
  | 'answer'
  | 'advisory'
  | 'diagnosis'
  | 'risk_summary'
  | 'record_confirmation'
  | 'record_saved'
  | 'market_guidance'
  | 'lesson_plan'
  | 'student_support'
  | 'patient_follow_up'
  | 'client_follow_up'
  | 'content_plan'
  | 'approval_request'
  | 'escalation'
  | 'broadcast'
  | 'unknown';

export type ResponseSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type ResponseSection = {
  key: string;
  label: string;
  value: string;
  severity?: ResponseSeverity;
};

export type ResponseQuickReply = {
  label: string;
  text?: string;
  postbackData?: string;
  actionType: 'message' | 'postback' | 'camera' | 'camera_roll' | 'location' | 'datetime';
};

export type ResponseCard = {
  templateKey: string;
  altText: string;
  data: Record<string, unknown>;
  fallbackText: string;
};

export type WebResponseCard = {
  kind: 'card';
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  eyebrow?: string;
  title: string;
  summary?: string;
  fields?: Array<{
    label: string;
    value: string;
  }>;
};

export type ResponseTemplate = {
  key: string;
  title: string;
  supportedChannels: Array<'line' | 'web'>;
  intent: ResponseIntent;
  requiredDataKeys: string[];
  renderLine?: (data: Record<string, unknown>) => unknown;
  renderWeb?: (data: Record<string, unknown>) => WebResponseCard;
};

export type ResponseWorkflow = {
  type: 'human_review' | 'approval' | 'handoff' | 'booking' | 'data_capture';
  priority: 'normal' | 'urgent';
  reason: string;
  assigneeRole?: string;
  data?: Record<string, unknown>;
  status?: ResponseWorkflowStatus;
  subject?: string;
  scopeType?: ResponseWorkflowScopeType;
  scopeId?: string;
  sourceThreadId?: string;
  sourceMessageId?: string;
  requiredCapabilities?: ResponseWorkflowCapability[];
  visibility?: {
    canRequest: boolean;
    canAssign: boolean;
    canViewQueue: boolean;
    canResolve: boolean;
    canReadEscalated: boolean;
  };
};

export type ResponseSafety = {
  severity?: ResponseSeverity;
  requiresEscalation?: boolean;
  uncertaintyLabel?: string;
  notes?: string[];
};

export type ResponsePlan = {
  intent: ResponseIntent;
  formats: ResponseFormat[];
  locale: string;
  title?: string;
  summary?: string;
  bodyText: string;
  sections?: ResponseSection[];
  quickReplies?: ResponseQuickReply[];
  card?: ResponseCard;
  workflow?: ResponseWorkflow;
  safety?: ResponseSafety;
  metadata?: Record<string, unknown>;
};
