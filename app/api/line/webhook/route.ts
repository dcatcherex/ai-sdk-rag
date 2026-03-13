import { isLineConfigured, verifyLineSignature, type LineWebhookPayload } from '@/lib/line';
import { processLineWebhookEvent } from '@/lib/support';

export async function POST(req: Request) {
  if (!isLineConfigured()) {
    return Response.json({ error: 'LINE is not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature');
  if (!verifyLineSignature(rawBody, signature)) {
    return Response.json({ error: 'Invalid LINE signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as LineWebhookPayload;
  const events = payload.events ?? [];

  for (const event of events) {
    const message = 'message' in event ? event.message : undefined;
    const replyToken = 'replyToken' in event ? event.replyToken : undefined;
    try {
      await processLineWebhookEvent({
        type: event.type,
        timestamp: event.timestamp,
        replyToken,
        source: { userId: event.source.userId },
        message,
        webhookEventId: event.webhookEventId,
        deliveryContext: event.deliveryContext,
      });
    } catch (error) {
      console.error('Failed to process LINE webhook event', error);
    }
  }

  return Response.json({ ok: true });
}
