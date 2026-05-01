import type { FlexBubble, FlexMessage } from '@/features/line-oa/webhook/types';
import type { ResponseTemplate } from '@/features/response-format/types';
import {
  buildWebCardFields,
  readTemplateString,
} from '@/features/response-format/templates/shared';

function bubbleToFlexMessage(
  altText: string,
  bubble: FlexBubble,
): FlexMessage {
  return {
    type: 'flex',
    altText,
    contents: bubble,
  };
}

export const COMMON_RESPONSE_TEMPLATES: ResponseTemplate[] = [
  {
    key: 'common.confirmation',
    title: 'Common Confirmation',
    supportedChannels: ['line', 'web'],
    intent: 'record_confirmation',
    requiredDataKeys: ['title', 'summary'],
    renderLine(data) {
      const bubble: FlexBubble = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: 'Confirmed',
              size: 'lg',
              weight: 'bold',
              color: '#1B5E20',
            },
            {
              type: 'text',
              text: String(data.title),
              size: 'md',
              weight: 'bold',
              wrap: true,
            },
            {
              type: 'text',
              text: String(data.summary),
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
          ],
        },
      };

      return bubbleToFlexMessage(String(data.altText ?? data.title ?? 'Confirmation'), bubble);
    },
    renderWeb(data) {
      return {
        kind: 'card',
        tone: 'success',
        eyebrow: 'Confirmed',
        title: readTemplateString(data, 'title', 'Confirmation'),
        summary: readTemplateString(data, 'summary'),
      };
    },
  },
  {
    key: 'common.summary',
    title: 'Common Summary',
    supportedChannels: ['line', 'web'],
    intent: 'answer',
    requiredDataKeys: ['title', 'summary'],
    renderLine(data) {
      const bubble: FlexBubble = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: String(data.title),
              size: 'lg',
              weight: 'bold',
              wrap: true,
            },
            {
              type: 'text',
              text: String(data.summary),
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
          ],
        },
      };

      return bubbleToFlexMessage(String(data.altText ?? data.title ?? 'Summary'), bubble);
    },
    renderWeb(data) {
      return {
        kind: 'card',
        tone: 'neutral',
        title: readTemplateString(data, 'title', 'Summary'),
        summary: readTemplateString(data, 'summary'),
      };
    },
  },
  {
    key: 'common.approval_request',
    title: 'Common Approval Request',
    supportedChannels: ['line', 'web'],
    intent: 'approval_request',
    requiredDataKeys: ['title', 'summary'],
    renderLine(data) {
      const bubble: FlexBubble = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: 'Approval Request',
              size: 'lg',
              weight: 'bold',
              color: '#8E24AA',
            },
            {
              type: 'text',
              text: String(data.title),
              size: 'md',
              weight: 'bold',
              wrap: true,
            },
            {
              type: 'text',
              text: String(data.summary),
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
          ],
        },
      };

      return bubbleToFlexMessage(String(data.altText ?? data.title ?? 'Approval Request'), bubble);
    },
    renderWeb(data) {
      return {
        kind: 'card',
        tone: 'warning',
        eyebrow: 'Approval Request',
        title: readTemplateString(data, 'title', 'Approval request'),
        summary: readTemplateString(data, 'summary'),
        fields: buildWebCardFields([
          { label: 'Status', value: data.status },
          { label: 'Assignee', value: data.assigneeName },
          { label: 'Due', value: data.dueAt },
        ]),
      };
    },
  },
  {
    key: 'common.escalation',
    title: 'Common Escalation',
    supportedChannels: ['line', 'web'],
    intent: 'escalation',
    requiredDataKeys: ['title', 'summary'],
    renderLine(data) {
      const bubble: FlexBubble = {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: 'Needs Human Review',
              size: 'lg',
              weight: 'bold',
              color: '#C62828',
            },
            {
              type: 'text',
              text: String(data.title),
              size: 'md',
              weight: 'bold',
              wrap: true,
            },
            {
              type: 'text',
              text: String(data.summary),
              size: 'sm',
              color: '#555555',
              wrap: true,
            },
          ],
        },
      };

      return bubbleToFlexMessage(String(data.altText ?? data.title ?? 'Escalation'), bubble);
    },
    renderWeb(data) {
      return {
        kind: 'card',
        tone: 'danger',
        eyebrow: 'Needs Human Review',
        title: readTemplateString(data, 'title', 'Escalation'),
        summary: readTemplateString(data, 'summary'),
      };
    },
  },
];
