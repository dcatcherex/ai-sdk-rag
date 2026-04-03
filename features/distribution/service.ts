import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { distributionRecord, contentPiece } from '@/db/schema';
import type {
  DistributionRecord,
  DistributionChannel,
  DistributionStatus,
  SendEmailInput,
  ExportInput,
  ExportResult,
  WebhookInput,
  CreateDistributionRecordInput,
} from './types';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRecord(row: typeof distributionRecord.$inferSelect): DistributionRecord {
  return {
    id: row.id,
    userId: row.userId,
    contentPieceId: row.contentPieceId ?? null,
    brandId: row.brandId ?? null,
    channel: row.channel as DistributionChannel,
    status: row.status as DistributionStatus,
    recipientCount: row.recipientCount ?? null,
    externalRef: row.externalRef ?? null,
    scheduledAt: row.scheduledAt ?? null,
    sentAt: row.sentAt ?? null,
    errorMessage: row.errorMessage ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function createRecord(
  userId: string,
  input: CreateDistributionRecordInput & { status?: DistributionStatus },
): Promise<DistributionRecord> {
  const rows = await db
    .insert(distributionRecord)
    .values({
      id: nanoid(),
      userId,
      contentPieceId: input.contentPieceId ?? null,
      brandId: input.brandId ?? null,
      channel: input.channel,
      status: input.status ?? 'pending',
      recipientCount: input.recipientCount ?? null,
      externalRef: input.externalRef ?? null,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
    })
    .returning();

  return mapRecord(rows[0]);
}

async function updateRecord(
  userId: string,
  id: string,
  data: Partial<Pick<DistributionRecord, 'status' | 'sentAt' | 'externalRef' | 'errorMessage' | 'recipientCount'>>,
): Promise<DistributionRecord | null> {
  const rows = await db
    .update(distributionRecord)
    .set({
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sentAt !== undefined ? { sentAt: data.sentAt } : {}),
      ...(data.externalRef !== undefined ? { externalRef: data.externalRef } : {}),
      ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      ...(data.recipientCount !== undefined ? { recipientCount: data.recipientCount } : {}),
    })
    .where(and(eq(distributionRecord.id, id), eq(distributionRecord.userId, userId)))
    .returning();

  return rows[0] ? mapRecord(rows[0]) : null;
}

export async function getDistributionRecords(
  userId: string,
  opts?: { contentPieceId?: string; channel?: string },
): Promise<DistributionRecord[]> {
  const conditions = [eq(distributionRecord.userId, userId)];
  if (opts?.contentPieceId) {
    conditions.push(eq(distributionRecord.contentPieceId, opts.contentPieceId));
  }
  if (opts?.channel) {
    conditions.push(eq(distributionRecord.channel, opts.channel));
  }

  const rows = await db
    .select()
    .from(distributionRecord)
    .where(and(...conditions))
    .orderBy(desc(distributionRecord.createdAt));

  return rows.map(mapRecord);
}

export async function deleteDistributionRecord(userId: string, id: string): Promise<void> {
  await db
    .delete(distributionRecord)
    .where(and(eq(distributionRecord.id, id), eq(distributionRecord.userId, userId)));
}

// ── Email Distribution (Resend) ───────────────────────────────────────────────

export async function sendEmailDistribution(
  userId: string,
  input: SendEmailInput,
): Promise<DistributionRecord> {
  const record = await createRecord(userId, {
    contentPieceId: input.contentPieceId,
    brandId: input.brandId,
    channel: 'email',
    recipientCount: input.recipients.length,
    metadata: { subject: input.subject, recipients: input.recipients },
  });

  try {
    // Dynamic import — Resend SDK is only available server-side
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const htmlBody = input.body.startsWith('<')
      ? input.body
      : `<div style="font-family:sans-serif;max-width:640px;margin:auto">${input.body.replace(/\n/g, '<br/>')}</div>`;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
      to: input.recipients,
      subject: input.subject,
      html: htmlBody,
    });

    if (error || !data) {
      const msg = error?.message ?? 'Unknown Resend error';
      return (await updateRecord(userId, record.id, {
        status: 'failed',
        errorMessage: msg,
      })) ?? record;
    }

    return (await updateRecord(userId, record.id, {
      status: 'sent',
      sentAt: new Date(),
      externalRef: data.id,
    })) ?? record;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed';
    return (await updateRecord(userId, record.id, {
      status: 'failed',
      errorMessage: msg,
    })) ?? record;
  }
}

// ── Content Export ────────────────────────────────────────────────────────────

export async function exportContentPiece(
  userId: string,
  input: ExportInput,
): Promise<ExportResult> {
  const rows = await db
    .select()
    .from(contentPiece)
    .where(and(eq(contentPiece.id, input.contentPieceId), eq(contentPiece.userId, userId)))
    .limit(1);

  if (!rows[0]) throw new Error('Content piece not found');

  const piece = rows[0];
  const slug = piece.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  let content: string;
  let filename: string;
  let mimeType: string;

  if (input.format === 'markdown') {
    content = `# ${piece.title}\n\n${piece.body ?? ''}`;
    if (piece.excerpt) content += `\n\n---\n_${piece.excerpt}_`;
    filename = `${slug}.md`;
    mimeType = 'text/markdown';
  } else if (input.format === 'html') {
    const bodyHtml = (piece.body ?? '')
      .replace(/^# (.+)$/m, '<h1>$1</h1>')
      .replace(/^## (.+)$/m, '<h2>$1</h2>')
      .replace(/^### (.+)$/m, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    content = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${piece.title}</title>
<style>body{font-family:sans-serif;max-width:720px;margin:40px auto;line-height:1.6}</style>
</head>
<body>
<h1>${piece.title}</h1>
${piece.excerpt ? `<p><em>${piece.excerpt}</em></p><hr/>` : ''}
<p>${bodyHtml}</p>
</body>
</html>`;
    filename = `${slug}.html`;
    mimeType = 'text/html';
  } else {
    content = `${piece.title}\n${'='.repeat(piece.title.length)}\n\n`;
    if (piece.excerpt) content += `${piece.excerpt}\n\n---\n\n`;
    content += piece.body ?? '';
    filename = `${slug}.txt`;
    mimeType = 'text/plain';
  }

  // Track the export
  await createRecord(userId, {
    contentPieceId: input.contentPieceId,
    channel: 'export',
    status: 'sent',
    metadata: { format: input.format, filename },
  });

  return { content, filename, mimeType };
}

// ── Webhook Distribution ──────────────────────────────────────────────────────

export async function sendWebhookDistribution(
  userId: string,
  input: WebhookInput,
): Promise<DistributionRecord> {
  const record = await createRecord(userId, {
    contentPieceId: input.contentPieceId,
    channel: 'webhook',
    metadata: { webhookUrl: input.webhookUrl },
  });

  try {
    const rows = await db
      .select()
      .from(contentPiece)
      .where(and(eq(contentPiece.id, input.contentPieceId), eq(contentPiece.userId, userId)))
      .limit(1);

    const piece = rows[0];
    const payload = input.payload ?? {
      id: piece?.id,
      title: piece?.title,
      contentType: piece?.contentType,
      body: piece?.body,
      excerpt: piece?.excerpt,
      status: piece?.status,
      channel: piece?.channel,
      publishedAt: new Date().toISOString(),
    };

    const response = await fetch(input.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });

    if (!response.ok) {
      return (await updateRecord(userId, record.id, {
        status: 'failed',
        errorMessage: `Webhook returned ${response.status}`,
      })) ?? record;
    }

    return (await updateRecord(userId, record.id, {
      status: 'sent',
      sentAt: new Date(),
      externalRef: response.headers.get('x-request-id') ?? undefined,
    })) ?? record;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook failed';
    return (await updateRecord(userId, record.id, {
      status: 'failed',
      errorMessage: msg,
    })) ?? record;
  }
}
