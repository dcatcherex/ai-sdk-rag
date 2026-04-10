import { headers } from 'next/headers';
import { and, eq, sql } from 'drizzle-orm';
import { generateText, stepCountIs } from 'ai';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { agent, user, userPreferences } from '@/db/schema';
import { db } from '@/lib/db';
import { chatModel, maxSteps } from '@/lib/ai';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';
import { createAgentTools } from '@/lib/agent-tools';
import { buildToolSet } from '@/lib/tools';
import { toolDisabledModels } from '@/features/chat/server/routing';
import { getSystemPrompt } from '@/lib/prompt';
import { getLineMessageContent, getLineProfile, pushLineText, replyLineText } from '@/lib/line';
import { analyzeLineAudio, analyzeLineFile, analyzeLineImage, type LineMediaAnalysis } from '@/lib/line-media-analysis';
import { uploadPublicObject } from '@/lib/r2';

export type SupportSenderType = 'customer' | 'ai' | 'agent';
export type SupportDirection = 'inbound' | 'outbound';
export type SupportConversationStatus = 'open' | 'closed';

export type SupportSession = {
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
  };
  ownerUserId: string;
};

export type SupportConversationListItem = {
  id: string;
  title: string | null;
  status: SupportConversationStatus;
  channel: 'line';
  contactId: string;
  externalId: string;
  displayName: string | null;
  pictureUrl: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedToImage: string | null;
  tags: string[];
  lastMessageAt: string;
  lastMessageBody: string | null;
  lastMessageDirection: SupportDirection | null;
  lastMessageSenderType: SupportSenderType | null;
};

export type SupportAssignableUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type SupportMessageItem = {
  id: string;
  direction: SupportDirection;
  senderType: SupportSenderType;
  body: string | null;
  externalMessageId: string | null;
  lineReplyToken: string | null;
  modelId: string | null;
  payload: unknown;
  sentAt: string | null;
  createdAt: string;
};

type SupportContactRecord = {
  id: string;
  externalId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

type SupportConversationRecord = {
  id: string;
  contactId: string;
  externalId: string;
  displayName: string | null;
  pictureUrl: string | null;
  title: string | null;
  status: SupportConversationStatus;
  assignedToUserId?: string | null;
  tags?: string[];
};

type SupportMessageRow = {
  id: string;
  direction: SupportDirection;
  senderType: SupportSenderType;
  body: string | null;
  externalMessageId: string | null;
  lineReplyToken: string | null;
  modelId: string | null;
  payload: unknown;
  sentAt: Date | string | null;
  createdAt: Date | string;
};

type SupportConversationListRow = {
  id: string;
  title: string | null;
  status: SupportConversationStatus;
  channel: 'line';
  contactId: string;
  externalId: string;
  displayName: string | null;
  pictureUrl: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedToImage: string | null;
  tags: unknown;
  lastMessageAt: Date | string;
  lastMessageBody: string | null;
  lastMessageDirection: SupportDirection | null;
  lastMessageSenderType: SupportSenderType | null;
};

type SupportCountRow = {
  count: number | string;
};

type SupportLineMediaPayload = {
  kind: 'line-media';
  messageType: 'image' | 'video' | 'audio' | 'file';
  url?: string;
  r2Key?: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  durationMs?: number;
  error?: 'download_failed';
  analysis?: LineMediaAnalysis;
};

type SupportLineLocationPayload = {
  kind: 'line-location';
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  mapUrl: string;
};

type SupportLineStickerPayload = {
  kind: 'line-sticker';
  packageId: string;
  stickerId: string;
  stickerResourceType: string;
  keywords: string[];
  text?: string;
};

type SupportLineContentPayload =
  | SupportLineMediaPayload
  | SupportLineLocationPayload
  | SupportLineStickerPayload;

type SupportLineInboundPayload = {
  webhookEventId: string | null;
  isRedelivery: boolean;
  timestamp: number;
  source: { userId?: string };
  content?: SupportLineContentPayload;
};

type LineInboundMessage = {
  id?: string;
  type?: string;
  text?: string;
  duration?: number;
  fileName?: string;
  fileSize?: string;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  packageId?: string;
  stickerId?: string;
  stickerResourceType?: string;
  keywords?: string[];
};

const getSupportOwnerUserId = (): string => process.env.LINE_OA_OWNER_USER_ID?.trim() ?? '';
const getDefaultSupportAgentId = (): string | null => process.env.LINE_OA_DEFAULT_AGENT_ID?.trim() || null;
export const isLineAutoReplyEnabled = (): boolean => process.env.LINE_OA_AUTO_REPLY === 'true';

const toIsoString = (value: Date | string | null): string | null => {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const getSupportOwnerUserIdOrThrow = (): string => {
  const ownerUserId = getSupportOwnerUserId();
  if (!ownerUserId) {
    throw new Error('LINE_OA_OWNER_USER_ID is not configured');
  }
  return ownerUserId;
};

const getLineMediaMimeType = (messageType: SupportLineMediaPayload['messageType']): string => {
  if (messageType === 'image') {
    return 'image/jpeg';
  }
  if (messageType === 'video') {
    return 'video/mp4';
  }
  if (messageType === 'audio') {
    return 'audio/m4a';
  }
  return 'application/octet-stream';
};

const getLineMediaExtension = (messageType: SupportLineMediaPayload['messageType']): string => {
  if (messageType === 'image') {
    return 'jpg';
  }
  if (messageType === 'video') {
    return 'mp4';
  }
  if (messageType === 'audio') {
    return 'm4a';
  }
  return 'bin';
};

const getLineInboundPayload = (payload: unknown): SupportLineInboundPayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload as SupportLineInboundPayload;
};

const getSupportMessageContextText = (message: Pick<SupportMessageRow, 'body' | 'payload'>): string | null => {
  const parts: string[] = [];
  if (message.body?.trim()) {
    parts.push(message.body.trim());
  }

  const payload = getLineInboundPayload(message.payload);
  const content = payload?.content;
  if (!content) {
    return parts.length > 0 ? parts.join('\n') : null;
  }

  if (content.kind === 'line-media' && content.analysis) {
    if (content.analysis.summary.trim()) {
      parts.push(`Attachment summary: ${content.analysis.summary.trim()}`);
    }
    if (content.analysis.extractedText.trim()) {
      const extracted = content.analysis.extractedText.trim();
      parts.push(`Attachment extracted text: ${extracted.length > 4000 ? `${extracted.slice(0, 4000)}…` : extracted}`);
    }
  } else if (content.kind === 'line-location') {
    parts.push(`Location: ${content.title} - ${content.address}`);
  } else if (content.kind === 'line-sticker') {
    const stickerBits = [content.text, content.keywords.join(', ')].filter((value) => Boolean(value?.trim()));
    if (stickerBits.length > 0) {
      parts.push(`Sticker details: ${stickerBits.join(' | ')}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : null;
};

const getLineMessageSummary = (
  message: LineInboundMessage,
  content?: SupportLineContentPayload,
): string | null => {
  if (content?.kind === 'line-media' && content.analysis?.summary?.trim()) {
    return content.analysis.summary.trim();
  }
  if (message.type === 'text') {
    return message.text?.trim() || null;
  }
  if (message.type === 'image') {
    return '[Image]';
  }
  if (message.type === 'video') {
    return '[Video]';
  }
  if (message.type === 'audio') {
    return '[Audio]';
  }
  if (message.type === 'file') {
    return message.fileName ? `[File] ${message.fileName}` : '[File]';
  }
  if (message.type === 'location') {
    return message.title ? `[Location] ${message.title}` : '[Location]';
  }
  if (message.type === 'sticker') {
    return message.text ? `[Sticker] ${message.text}` : '[Sticker]';
  }
  return message.type ? `[${message.type}]` : null;
};

const buildLineContentPayload = async (
  ownerUserId: string,
  message: LineInboundMessage,
): Promise<SupportLineContentPayload | undefined> => {
  if (!message.id || !message.type) {
    return undefined;
  }

  if (message.type === 'location') {
    if (
      typeof message.title !== 'string' ||
      typeof message.address !== 'string' ||
      typeof message.latitude !== 'number' ||
      typeof message.longitude !== 'number'
    ) {
      return undefined;
    }

    return {
      kind: 'line-location',
      title: message.title,
      address: message.address,
      latitude: message.latitude,
      longitude: message.longitude,
      mapUrl: `https://www.google.com/maps?q=${message.latitude},${message.longitude}`,
    };
  }

  if (message.type === 'sticker') {
    if (!message.packageId || !message.stickerId || !message.stickerResourceType) {
      return undefined;
    }

    return {
      kind: 'line-sticker',
      packageId: message.packageId,
      stickerId: message.stickerId,
      stickerResourceType: message.stickerResourceType,
      keywords: message.keywords ?? [],
      ...(message.text ? { text: message.text } : {}),
    };
  }

  if (
    message.type !== 'image' &&
    message.type !== 'video' &&
    message.type !== 'audio' &&
    message.type !== 'file'
  ) {
    return undefined;
  }

  const extension = getLineMediaExtension(message.type);
  const mimeType = getLineMediaMimeType(message.type);
  const fileName = message.type === 'file'
    ? (message.fileName ?? `line-file-${message.id}`)
    : `line-${message.type}-${message.id}.${extension}`;

  try {
    const buffer = await getLineMessageContent(message.id);
    const upload = await uploadPublicObject({
      key: `support-line/${ownerUserId}/${message.id}/${nanoid(6)}.${extension}`,
      body: buffer,
      contentType: mimeType,
    });

    let analysis: LineMediaAnalysis | null = null;
    try {
      if (message.type === 'image') {
        analysis = await analyzeLineImage({ fileBytes: buffer, mimeType, fileName });
      } else if (message.type === 'audio') {
        analysis = await analyzeLineAudio({ fileBytes: buffer, mimeType });
      } else if (message.type === 'file') {
        analysis = await analyzeLineFile({ fileBytes: buffer, fileName });
      }
    } catch {
      analysis = null;
    }

    return {
      kind: 'line-media',
      messageType: message.type,
      url: upload.url,
      r2Key: upload.key,
      fileName,
      mimeType,
      sizeBytes: buffer.byteLength,
      ...(typeof message.duration === 'number' ? { durationMs: message.duration } : {}),
      ...(analysis ? { analysis } : {}),
    };
  } catch {
    return {
      kind: 'line-media',
      messageType: message.type,
      fileName,
      mimeType,
      ...(typeof message.duration === 'number' ? { durationMs: message.duration } : {}),
      error: 'download_failed',
    };
  }
};

export const requireSupportSession = async (): Promise<
  | { ok: true; value: SupportSession }
  | { ok: false; response: Response }
> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const ownerUserId = getSupportOwnerUserId();
  if (!ownerUserId) {
    return {
      ok: false,
      response: Response.json({ error: 'LINE OA support is not configured' }, { status: 500 }),
    };
  }

  if (session.user.id !== ownerUserId && !isAdminEmail(session.user.email)) {
    return {
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    value: {
      session: session as SupportSession['session'],
      ownerUserId,
    },
  };
};

const fetchSupportConversation = async (
  ownerUserId: string,
  conversationId: string,
): Promise<SupportConversationRecord | null> => {
  const result = await db.execute(sql`
    SELECT
      c.id,
      c.contact_id AS "contactId",
      c.title,
      c.status,
      contact.external_id AS "externalId",
      contact.display_name AS "displayName",
      contact.picture_url AS "pictureUrl",
      c.assigned_to_user_id AS "assignedToUserId",
      c.tags AS "tags"
    FROM support_conversation c
    INNER JOIN support_contact contact ON contact.id = c.contact_id
    WHERE c.id = ${conversationId} AND c.owner_user_id = ${ownerUserId}
    LIMIT 1
  `);

  const row = (result.rows as SupportConversationRecord[])[0];
  return row ?? null;
};

const fetchRecentSupportMessages = async (
  conversationId: string,
  limit = 16,
): Promise<SupportMessageRow[]> => {
  const result = await db.execute(sql`
    SELECT
      id,
      direction,
      sender_type AS "senderType",
      body,
      external_message_id AS "externalMessageId",
      line_reply_token AS "lineReplyToken",
      model_id AS "modelId",
      payload,
      sent_at AS "sentAt",
      created_at AS "createdAt"
    FROM support_message
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return [...(result.rows as SupportMessageRow[])].reverse();
};

const upsertSupportContact = async (ownerUserId: string, lineUserId: string): Promise<SupportContactRecord> => {
  const profile = await getLineProfile(lineUserId).catch(() => null);
  const result = await db.execute(sql`
    INSERT INTO support_contact (
      id,
      owner_user_id,
      channel,
      external_id,
      display_name,
      picture_url,
      last_seen_at,
      created_at,
      updated_at
    )
    VALUES (
      ${nanoid()},
      ${ownerUserId},
      ${'line'},
      ${lineUserId},
      ${profile?.displayName ?? null},
      ${profile?.pictureUrl ?? null},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (owner_user_id, channel, external_id)
    DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, support_contact.display_name),
      picture_url = COALESCE(EXCLUDED.picture_url, support_contact.picture_url),
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING id, external_id AS "externalId", display_name AS "displayName", picture_url AS "pictureUrl"
  `);

  const row = (result.rows as SupportContactRecord[])[0];
  if (!row) {
    throw new Error('Failed to upsert support contact');
  }
  return row;
};

const ensureSupportConversation = async (
  ownerUserId: string,
  contact: SupportContactRecord,
): Promise<SupportConversationRecord> => {
  const title = contact.displayName ? `LINE: ${contact.displayName}` : `LINE: ${contact.externalId}`;
  const result = await db.execute(sql`
    INSERT INTO support_conversation (
      id,
      owner_user_id,
      contact_id,
      channel,
      status,
      title,
      last_message_at,
      created_at,
      updated_at
    )
    VALUES (
      ${nanoid()},
      ${ownerUserId},
      ${contact.id},
      ${'line'},
      ${'open'},
      ${title},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (owner_user_id, contact_id, channel)
    DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = NOW()
    RETURNING id, contact_id AS "contactId", title, status, assigned_to_user_id AS "assignedToUserId", tags
  `);

  const row = (result.rows as Array<Pick<SupportConversationRecord, 'id' | 'contactId' | 'title' | 'status' | 'assignedToUserId' | 'tags'>>)[0];
  if (!row) {
    throw new Error('Failed to ensure support conversation');
  }
  return {
    ...row,
    externalId: contact.externalId,
    displayName: contact.displayName,
    pictureUrl: contact.pictureUrl,
  };
};

const insertInboundSupportMessage = async (options: {
  ownerUserId: string;
  conversationId: string;
  contactId: string;
  externalMessageId: string;
  body: string | null;
  lineReplyToken?: string;
  payload: unknown;
}): Promise<boolean> => {
  const { ownerUserId, conversationId, contactId, externalMessageId, body, lineReplyToken, payload } = options;
  const result = await db.execute(sql`
    INSERT INTO support_message (
      id,
      owner_user_id,
      conversation_id,
      contact_id,
      direction,
      sender_type,
      body,
      external_message_id,
      line_reply_token,
      payload,
      sent_at,
      created_at
    )
    VALUES (
      ${nanoid()},
      ${ownerUserId},
      ${conversationId},
      ${contactId},
      ${'inbound'},
      ${'customer'},
      ${body},
      ${externalMessageId},
      ${lineReplyToken ?? null},
      ${JSON.stringify(payload)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (external_message_id) DO NOTHING
    RETURNING id
  `);

  const inserted = (result.rows as Array<{ id: string }>).length > 0;
  if (inserted) {
    await db.execute(sql`
      UPDATE support_conversation
      SET last_message_at = NOW(), last_inbound_at = NOW(), updated_at = NOW()
      WHERE id = ${conversationId}
    `);
  }
  return inserted;
};

const insertOutboundSupportMessage = async (options: {
  ownerUserId: string;
  conversationId: string;
  contactId: string;
  senderType: Exclude<SupportSenderType, 'customer'>;
  body: string;
  modelId?: string | null;
  payload: unknown;
}): Promise<string> => {
  const { ownerUserId, conversationId, contactId, senderType, body, modelId, payload } = options;
  const messageId = nanoid();
  await db.execute(sql`
    INSERT INTO support_message (
      id,
      owner_user_id,
      conversation_id,
      contact_id,
      direction,
      sender_type,
      body,
      model_id,
      payload,
      sent_at,
      created_at
    )
    VALUES (
      ${messageId},
      ${ownerUserId},
      ${conversationId},
      ${contactId},
      ${'outbound'},
      ${senderType},
      ${body},
      ${modelId ?? null},
      ${JSON.stringify(payload)}::jsonb,
      NOW(),
      NOW()
    )
  `);

  await db.execute(sql`
    UPDATE support_conversation
    SET last_message_at = NOW(), last_outbound_at = NOW(), updated_at = NOW()
    WHERE id = ${conversationId}
  `);

  return messageId;
};

export const listSupportConversations = async (options: {
  ownerUserId: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SupportConversationListItem[]; total: number }> => {
  const { ownerUserId, search, limit = 30, offset = 0 } = options;
  const normalizedSearch = search?.trim() ?? '';
  const pattern = `%${normalizedSearch}%`;

  const whereClause = normalizedSearch
    ? sql`WHERE c.owner_user_id = ${ownerUserId} AND (contact.display_name ILIKE ${pattern} OR contact.external_id ILIKE ${pattern} OR COALESCE(c.title, '') ILIKE ${pattern})`
    : sql`WHERE c.owner_user_id = ${ownerUserId}`;

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM support_conversation c
    INNER JOIN support_contact contact ON contact.id = c.contact_id
    ${whereClause}
  `);

  const listResult = await db.execute(sql`
    SELECT
      c.id,
      c.title,
      c.status,
      c.channel,
      c.contact_id AS "contactId",
      contact.external_id AS "externalId",
      contact.display_name AS "displayName",
      contact.picture_url AS "pictureUrl",
      c.assigned_to_user_id AS "assignedToUserId",
      assigned_user.name AS "assignedToName",
      assigned_user.image AS "assignedToImage",
      COALESCE(c.tags, '[]'::jsonb) AS tags,
      c.last_message_at AS "lastMessageAt",
      latest.body AS "lastMessageBody",
      latest.direction AS "lastMessageDirection",
      latest.sender_type AS "lastMessageSenderType"
    FROM support_conversation c
    INNER JOIN support_contact contact ON contact.id = c.contact_id
    LEFT JOIN "user" assigned_user ON assigned_user.id = c.assigned_to_user_id
    LEFT JOIN LATERAL (
      SELECT body, direction, sender_type
      FROM support_message sm
      WHERE sm.conversation_id = c.id
      ORDER BY sm.created_at DESC
      LIMIT 1
    ) latest ON TRUE
    ${whereClause}
    ORDER BY c.last_message_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = listResult.rows as SupportConversationListRow[];
  const items = rows.map((row) => ({
    ...row,
    tags: parseSupportTags(row.tags),
    lastMessageAt: toIsoString(row.lastMessageAt) ?? new Date(0).toISOString(),
  }));

  return {
    items,
    total: Number((countResult.rows as SupportCountRow[])[0]?.count ?? 0),
  };
};

export const listSupportAssignableUsers = async (): Promise<SupportAssignableUser[]> => {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(user)
    .where(eq(user.approved, true));

  return [...rows].sort((left, right) => left.name.localeCompare(right.name));
};

export const updateSupportConversationMetadata = async (options: {
  ownerUserId: string;
  conversationId: string;
  assignedToUserId: string | null;
  tags: string[];
}): Promise<void> => {
  const { ownerUserId, conversationId, assignedToUserId, tags } = options;
  const normalizedTags = normalizeSupportTags(tags);

  let normalizedAssignedToUserId: string | null = null;
  if (assignedToUserId) {
    const assignee = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, assignedToUserId), eq(user.approved, true)))
      .limit(1);

    if (!assignee[0]?.id) {
      throw new Error('Assignee not found');
    }

    normalizedAssignedToUserId = assignee[0].id;
  }

  const result = await db.execute(sql`
    UPDATE support_conversation
    SET
      assigned_to_user_id = ${normalizedAssignedToUserId},
      tags = ${JSON.stringify(normalizedTags)}::jsonb,
      updated_at = NOW()
    WHERE id = ${conversationId} AND owner_user_id = ${ownerUserId}
    RETURNING id
  `);

  if ((result.rows as Array<{ id: string }>).length === 0) {
    throw new Error('Conversation not found');
  }
};

const normalizeSupportTags = (tags: string[]): string[] => {
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim().slice(0, 32);
    if (!trimmed) {
      continue;
    }

    if (normalized.some((value) => value.toLowerCase() === trimmed.toLowerCase())) {
      continue;
    }

    normalized.push(trimmed);
    if (normalized.length >= 12) {
      break;
    }
  }

  return normalized;
};

const parseSupportTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeSupportTags(value.filter((item): item is string => typeof item === 'string'));
};

export const listSupportMessages = async (
  ownerUserId: string,
  conversationId: string,
): Promise<SupportMessageItem[]> => {
  const conversation = await fetchSupportConversation(ownerUserId, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const rows = await fetchRecentSupportMessages(conversationId, 200);
  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    senderType: row.senderType,
    body: row.body,
    externalMessageId: row.externalMessageId,
    lineReplyToken: row.lineReplyToken,
    modelId: row.modelId,
    payload: row.payload,
    sentAt: toIsoString(row.sentAt),
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
  }));
};

export const generateSupportReply = async (options: {
  ownerUserId: string;
  conversationId: string;
}): Promise<{ text: string; modelId: string }> => {
  const { ownerUserId, conversationId } = options;
  const conversation = await fetchSupportConversation(ownerUserId, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const messages = await fetchRecentSupportMessages(conversationId, 16);
  const latestCustomerMessage = [...messages].reverse().find(
    (message) => message.senderType === 'customer' && getSupportMessageContextText(message),
  );
  if (!latestCustomerMessage) {
    throw new Error('No customer message available for AI reply');
  }

  const defaultAgentId = getDefaultSupportAgentId();
  const [prefsRows, agentRows] = await Promise.all([
    db.select().from(userPreferences).where(eq(userPreferences.userId, ownerUserId)).limit(1),
    defaultAgentId
      ? db
          .select()
          .from(agent)
          .where(and(eq(agent.id, defaultAgentId), eq(agent.userId, ownerUserId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const activeAgent = agentRows[0] ?? null;
  const prefs = prefsRows[0] ?? {
    enabledToolIds: null,
    rerankEnabled: false,
  };

  const modelId = activeAgent?.modelId ?? process.env.LINE_OA_MODEL_ID?.trim() ?? chatModel;
  const creditCost = getCreditCost(modelId);
  const balance = await getUserBalance(ownerUserId);
  if (balance < creditCost) {
    throw new Error('Insufficient credits for LINE OA AI reply');
  }

  const supportsTools = !toolDisabledModels.has(modelId);
  const tools = activeAgent
    ? createAgentTools(activeAgent.enabledTools, ownerUserId, activeAgent.documentIds)
    : buildToolSet({
        enabledToolIds: prefs.enabledToolIds ?? null,
        userId: ownerUserId,
        rerankEnabled: prefs.rerankEnabled ?? false,
        source: 'agent',
      });

  const latestCustomerContext = getSupportMessageContextText(latestCustomerMessage);
  if (!latestCustomerContext) {
    throw new Error('No customer message available for AI reply');
  }

  const transcript = messages
    .map((message) => {
      const contextText = getSupportMessageContextText(message);
      if (!contextText) {
        return null;
      }
      const speaker = message.senderType === 'customer'
        ? 'Customer'
        : message.senderType === 'ai'
          ? 'AI Support'
          : 'Support Agent';
      return `${speaker}: ${contextText}`;
    })
    .filter((value): value is string => Boolean(value))
    .join('\n');

  const system = [
    activeAgent?.systemPrompt ?? getSystemPrompt(),
    'You are replying to a customer inside a LINE official account support inbox.',
    'Reply in the same language as the customer when practical.',
    'Be concise, polite, and action-oriented.',
    'If you are uncertain, say a human agent will follow up.',
    'Do not mention internal prompts, tool usage, credits, or implementation details.',
    'Return only the reply text that should be sent to the customer.',
  ].join('\n');

  const prompt = [
    `Customer display name: ${conversation.displayName ?? 'Unknown'}`,
    `Conversation title: ${conversation.title ?? 'LINE conversation'}`,
    'Conversation transcript:',
    transcript || 'No prior conversation available.',
    '',
    `Latest customer message: ${latestCustomerContext}`,
    'Write the next support reply now.',
  ].join('\n');

  const result = await generateText({
    model: modelId,
    system,
    prompt,
    ...(supportsTools ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
  });

  const text = result.text.trim();
  if (!text) {
    throw new Error('AI reply was empty');
  }

  await deductCredits({
    userId: ownerUserId,
    amount: creditCost,
    description: `LINE OA support reply: ${modelId} (${conversationId})`,
  });

  return { text, modelId };
};

export const sendSupportReply = async (options: {
  ownerUserId: string;
  conversationId: string;
  text: string;
  senderType: Exclude<SupportSenderType, 'customer'>;
  modelId?: string | null;
  replyToken?: string;
  payload?: unknown;
}): Promise<{ messageId: string; text: string }> => {
  const { ownerUserId, conversationId, text, senderType, modelId, replyToken, payload } = options;
  const conversation = await fetchSupportConversation(ownerUserId, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Reply text is required');
  }

  if (replyToken) {
    try {
      await replyLineText(replyToken, normalizedText);
    } catch {
      await pushLineText(conversation.externalId, normalizedText);
    }
  } else {
    await pushLineText(conversation.externalId, normalizedText);
  }

  const messageId = await insertOutboundSupportMessage({
    ownerUserId,
    conversationId,
    contactId: conversation.contactId,
    senderType,
    body: normalizedText,
    modelId,
    payload: payload ?? { via: replyToken ? 'reply' : 'push' },
  });

  return { messageId, text: normalizedText };
};

export const processLineWebhookEvent = async (event: {
  type: string;
  timestamp: number;
  replyToken?: string;
  source: { userId?: string };
  message?: LineInboundMessage;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
}): Promise<void> => {
  const ownerUserId = getSupportOwnerUserIdOrThrow();
  const lineUserId = event.source.userId;
  if (!lineUserId) {
    return;
  }

  const contact = await upsertSupportContact(ownerUserId, lineUserId);
  const conversation = await ensureSupportConversation(ownerUserId, contact);

  if (event.type === 'follow') {
    return;
  }

  if (event.type !== 'message' || !event.message?.id || !event.message.type) {
    return;
  }

  const content = await buildLineContentPayload(ownerUserId, event.message);
  const summary = getLineMessageSummary(event.message, content);

  const inserted = await insertInboundSupportMessage({
    ownerUserId,
    conversationId: conversation.id,
    contactId: contact.id,
    externalMessageId: event.message.id,
    body: summary,
    lineReplyToken: event.replyToken,
    payload: {
      webhookEventId: event.webhookEventId ?? null,
      isRedelivery: event.deliveryContext?.isRedelivery ?? false,
      timestamp: event.timestamp,
      source: event.source,
      ...(content ? { content } : {}),
    } satisfies SupportLineInboundPayload,
  });

  if (
    !inserted ||
    !isLineAutoReplyEnabled() ||
    event.message.type !== 'text' ||
    !event.message.text?.trim()
  ) {
    return;
  }

  const aiReply = await generateSupportReply({
    ownerUserId,
    conversationId: conversation.id,
  });

  await sendSupportReply({
    ownerUserId,
    conversationId: conversation.id,
    text: aiReply.text,
    senderType: 'ai',
    modelId: aiReply.modelId,
    replyToken: event.replyToken,
    payload: {
      mode: 'auto',
      modelId: aiReply.modelId,
    },
  });
};
