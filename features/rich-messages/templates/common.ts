import {
  commonApprovalRequestRichMessageSchema,
  commonConfirmationRichMessageSchema,
  commonEscalationRichMessageSchema,
  commonSummaryRichMessageSchema,
} from '@/features/rich-messages/schema';
import type { RichMessageTemplate } from '@/features/rich-messages/types';

export const COMMON_RICH_MESSAGE_TEMPLATES: RichMessageTemplate[] = [
  {
    key: 'common.confirmation',
    title: 'Common Confirmation',
    description: 'Shared confirmation card for saved or confirmed actions.',
    category: 'common',
    intent: 'record_confirmation',
    schema: commonConfirmationRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'card',
      tone: 'success',
      eyebrow: 'Confirmed',
      title: '{{title}}',
      summary: '{{summary}}',
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'common.summary',
    title: 'Common Summary',
    description: 'Shared summary card for structured results.',
    category: 'common',
    intent: 'answer',
    schema: commonSummaryRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'summary',
      tone: 'neutral',
      title: '{{title}}',
      summary: '{{summary}}',
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'common.approval_request',
    title: 'Common Approval Request',
    description: 'Approval request card shared between web chat and LINE.',
    category: 'common',
    intent: 'approval_request',
    schema: commonApprovalRequestRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'card',
      tone: 'warning',
      eyebrow: 'Approval Request',
      title: '{{title}}',
      summary: '{{summary}}',
      sections: [
        {
          label: 'Status',
          value: '{{status}}',
        },
        {
          label: 'Assignee',
          value: '{{assigneeName}}',
        },
        {
          label: 'Due',
          value: '{{dueAt}}',
        },
      ],
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'common.escalation',
    title: 'Common Escalation',
    description: 'Human review or escalation card.',
    category: 'common',
    intent: 'escalation',
    schema: commonEscalationRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'alert',
      tone: 'danger',
      eyebrow: 'Needs Human Review',
      title: '{{title}}',
      summary: '{{summary}}',
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
];
