export { buildFallbackResponsePlan } from '@/features/response-format/service';
export { renderResponseForLine } from '@/features/response-format/channels/line';
export { renderResponseForWeb } from '@/features/response-format/channels/web';
export { inferResponseSafety } from '@/features/response-format/safety';
export {
  buildWorkflowPostbackData,
  buildWorkflowQuickReplies,
  mergeResponseQuickReplies,
  maybeBuildHumanReviewWorkflow,
} from '@/features/response-format/workflow';
export { buildResponseAuditSummary } from '@/features/response-format/server/audit';
export {
  buildResponsePlan,
  detectFallbackFormat,
  selectResponseFromToolResults,
} from '@/features/response-format/server/select';
export {
  canRenderResponseTemplate,
  getResponseTemplateByKey,
  listResponseTemplates,
} from '@/features/response-format/template-registry';
export {
  RESPONSE_INTENT_REGISTRY,
  dedupeSkillResponseContracts,
  normalizeRequiredSections,
  normalizeResponseContractEscalation,
  normalizeResponseFormat,
  normalizeResponseIntent,
} from '@/features/response-format/contracts';
export type {
  ResponseCard,
  ResponseChannel,
  ResponseFormat,
  ResponseIntent,
  ResponsePlan,
  ResponseQuickReply,
  ResponseSafety,
  ResponseSection,
  ResponseSeverity,
  ResponseTemplate,
  ResponseWorkflow,
  ResponseWorkflowCapability,
  ResponseWorkflowScopeType,
  ResponseWorkflowStatus,
  WebResponseCard,
} from '@/features/response-format/types';
export type { ResponseWorkflowContext } from '@/features/response-format/workflow';
export type {
  ResponseContractEscalation,
  ResponseIntentDefinition,
  SkillResponseContract,
} from '@/features/response-format/contracts';
