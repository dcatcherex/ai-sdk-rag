import {
  Client,
  validateSignature,
  type Profile,
  type TextMessage,
  type WebhookEvent,
  type WebhookRequestBody,
} from '@line/bot-sdk';

export type LineProfile = Profile;
export type LineTextMessage = TextMessage;
export type LineWebhookEvent = WebhookEvent;
export type LineWebhookPayload = WebhookRequestBody;

const MAX_LINE_TEXT_LENGTH = 5000;

const getLineChannelSecret = (): string => process.env.LINE_CHANNEL_SECRET?.trim() ?? '';
const getLineChannelAccessToken = (): string => process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? '';

let lineClient: Client | null = null;

export const isLineConfigured = (): boolean =>
  getLineChannelSecret().length > 0 && getLineChannelAccessToken().length > 0;

export const normalizeLineText = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_LINE_TEXT_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_LINE_TEXT_LENGTH - 1)}…`;
};

export const verifyLineSignature = (rawBody: string, signatureHeader: string | null): boolean => {
  const secret = getLineChannelSecret();
  if (!secret || !signatureHeader) {
    return false;
  }

  return validateSignature(rawBody, secret, signatureHeader);
};

export const getLineClient = (): Client => {
  if (lineClient) {
    return lineClient;
  }

  const channelAccessToken = getLineChannelAccessToken();
  const channelSecret = getLineChannelSecret();
  if (!channelAccessToken || !channelSecret) {
    throw new Error('LINE channel credentials are not configured');
  }

  lineClient = new Client({
    channelAccessToken,
    channelSecret,
  });

  return lineClient;
};

export const getLineProfile = async (userId: string): Promise<LineProfile> =>
  getLineClient().getProfile(userId);

export const replyLineText = async (replyToken: string, text: string): Promise<void> => {
  const message: LineTextMessage = {
    type: 'text',
    text: normalizeLineText(text),
  };
  await getLineClient().replyMessage(replyToken, message);
};

export const pushLineText = async (to: string, text: string): Promise<void> => {
  const message: LineTextMessage = {
    type: 'text',
    text: normalizeLineText(text),
  };
  await getLineClient().pushMessage(to, message);
};

export const getLineMessageContent = async (messageId: string): Promise<Buffer> => {
  const stream = await getLineClient().getMessageContent(messageId);
  const chunks: Uint8Array[] = [];

  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
};
