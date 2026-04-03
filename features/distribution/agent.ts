import { tool } from 'ai';
import { z } from 'zod';
import {
  sendEmailDistribution,
  exportContentPiece,
  sendWebhookDistribution,
  getDistributionRecords,
} from './service';

type DistributionToolContext = { userId: string };

export function createDistributionAgentTools({ userId }: DistributionToolContext) {
  return {
    send_email_distribution: tool({
      description:
        'Send a content piece or custom message to a list of email recipients via email. Use this when a user wants to distribute content by email.',
      inputSchema: z.object({
        contentPieceId: z.string().optional().describe('ID of the content piece to send (optional — can send custom body instead)'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body content (HTML or plain text)'),
        recipients: z.array(z.string().email()).min(1).describe('List of recipient email addresses'),
      }),
      async execute(args) {
        const record = await sendEmailDistribution(userId, args);
        return {
          id: record.id,
          status: record.status,
          recipientCount: record.recipientCount,
          sentAt: record.sentAt,
          externalRef: record.externalRef,
          errorMessage: record.errorMessage,
        };
      },
    }),

    export_content_piece: tool({
      description:
        'Export a content piece to a downloadable file format (markdown, html, or plain text). Returns the content as a string the user can copy or save.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('ID of the content piece to export'),
        format: z.enum(['markdown', 'html', 'plain']).describe('Export format'),
      }),
      async execute(args) {
        const result = await exportContentPiece(userId, args);
        return {
          filename: result.filename,
          mimeType: result.mimeType,
          content: result.content.slice(0, 5000),
          length: result.content.length,
        };
      },
    }),

    send_webhook: tool({
      description:
        'Push a content piece to an external CMS or service via a webhook URL. The content will be sent as a JSON POST request.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('ID of the content piece to send'),
        webhookUrl: z.string().url().describe('The webhook endpoint URL'),
      }),
      async execute(args) {
        const record = await sendWebhookDistribution(userId, args);
        return {
          id: record.id,
          status: record.status,
          sentAt: record.sentAt,
          errorMessage: record.errorMessage,
        };
      },
    }),

    list_distribution_history: tool({
      description:
        'List past distribution records for a content piece or all recent distributions for the user.',
      inputSchema: z.object({
        contentPieceId: z.string().optional().describe('Filter by content piece ID'),
        channel: z.enum(['email', 'webhook', 'export', 'linkedin', 'twitter']).optional().describe('Filter by channel'),
      }),
      async execute(args) {
        const records = await getDistributionRecords(userId, args);
        return records.slice(0, 20).map((r) => ({
          id: r.id,
          channel: r.channel,
          status: r.status,
          recipientCount: r.recipientCount,
          sentAt: r.sentAt,
          createdAt: r.createdAt,
        }));
      },
    }),
  };
}
