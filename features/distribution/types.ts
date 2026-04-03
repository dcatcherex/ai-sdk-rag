export type DistributionChannel =
  | 'email'
  | 'webhook'
  | 'export'
  | 'linkedin'
  | 'twitter';

export type DistributionStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export type DistributionRecord = {
  id: string;
  userId: string;
  contentPieceId: string | null;
  brandId: string | null;
  channel: DistributionChannel;
  status: DistributionStatus;
  recipientCount: number | null;
  externalRef: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type SendEmailInput = {
  contentPieceId?: string;
  brandId?: string;
  subject: string;
  body: string; // HTML or markdown
  recipients: string[]; // email addresses
};

export type ExportInput = {
  contentPieceId: string;
  format: 'markdown' | 'html' | 'plain';
};

export type ExportResult = {
  content: string;
  filename: string;
  mimeType: string;
};

export type WebhookInput = {
  contentPieceId: string;
  webhookUrl: string;
  payload?: Record<string, unknown>;
};

export type CreateDistributionRecordInput = {
  contentPieceId?: string;
  brandId?: string;
  channel: DistributionChannel;
  recipientCount?: number;
  externalRef?: string;
  metadata?: Record<string, unknown>;
};
