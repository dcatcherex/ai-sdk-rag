import type { ResponseTemplate } from '@/features/response-format/types';

export const COMMON_RESPONSE_TEMPLATES: ResponseTemplate[] = [
  {
    key: 'common.confirmation',
    title: 'Common Confirmation',
    supportedChannels: ['line', 'web'],
    intent: 'record_confirmation',
    requiredDataKeys: ['title', 'summary'],
  },
  {
    key: 'common.summary',
    title: 'Common Summary',
    supportedChannels: ['line', 'web'],
    intent: 'answer',
    requiredDataKeys: ['title', 'summary'],
  },
  {
    key: 'common.approval_request',
    title: 'Common Approval Request',
    supportedChannels: ['line', 'web'],
    intent: 'approval_request',
    requiredDataKeys: ['title', 'summary'],
  },
  {
    key: 'common.escalation',
    title: 'Common Escalation',
    supportedChannels: ['line', 'web'],
    intent: 'escalation',
    requiredDataKeys: ['title', 'summary'],
  },
];
