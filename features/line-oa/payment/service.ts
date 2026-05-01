import { and, eq, gt, or } from 'drizzle-orm';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { linePaymentOrder, lineOaChannel, lineAccountLink } from '@/db/schema/line-oa';
import { addCredits } from '@/lib/credits';
import { CREDIT_PACKAGES, CreditPackage, getPackageById } from './packages';

const PROMPTPAY_ID = process.env.PROMPTPAY_ID ?? '';
const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY ?? '';
const ORDER_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Order creation ─────────────────────────────────────────────────────────────

export type CreateOrderResult =
  | { ok: true; orderId: string; qrDataUrl: string; pkg: CreditPackage }
  | { ok: false; error: string };

/**
 * Create a new pending payment order for a LINE user.
 * Generates the PromptPay QR code as a base64 PNG data URL.
 */
export async function createPaymentOrder(
  lineUserId: string,
  channelId: string,
  packageId: string,
): Promise<CreateOrderResult> {
  if (!PROMPTPAY_ID) {
    return { ok: false, error: 'ระบบชำระเงินยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล' };
  }

  const pkg = getPackageById(packageId);
  if (!pkg) return { ok: false, error: 'ไม่พบแพ็กเกจที่เลือก' };

  // Resolve app userId from lineAccountLink
  const linkRows = await db
    .select({ userId: lineAccountLink.userId })
    .from(lineAccountLink)
    .where(and(eq(lineAccountLink.channelId, channelId), eq(lineAccountLink.lineUserId, lineUserId)))
    .limit(1);

  if (!linkRows[0]) {
    return { ok: false, error: 'กรุณาสมัครสมาชิกก่อนเติมเครดิต พิมพ์ "สมัครสมาชิก"' };
  }

  const userId = linkRows[0].userId;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ORDER_TTL_MS);

  const orderId = crypto.randomUUID();

  await db.insert(linePaymentOrder).values({
    id: orderId,
    userId,
    channelId,
    lineUserId,
    packageId: pkg.id,
    amountThb: String(pkg.amountThb),
    credits: pkg.credits,
    status: 'pending',
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  // Generate PromptPay QR payload + PNG
  const payload: string = generatePayload(PROMPTPAY_ID, { amount: pkg.amountThb });
  const qrDataUrl: string = await QRCode.toDataURL(payload, {
    type: 'image/png',
    width: 600,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return { ok: true, orderId, qrDataUrl, pkg };
}

// ── Slip verification ──────────────────────────────────────────────────────────

export type VerifySlipResult =
  | { ok: true; orderId: string; credits: number; senderName: string }
  | { ok: false; error: string };

export async function hasPendingPaymentOrder(
  lineUserId: string,
  channelId: string,
): Promise<boolean> {
  const now = new Date();
  const orderRows = await db
    .select({ id: linePaymentOrder.id })
    .from(linePaymentOrder)
    .where(
      and(
        eq(linePaymentOrder.channelId, channelId),
        eq(linePaymentOrder.lineUserId, lineUserId),
        eq(linePaymentOrder.status, 'pending'),
        gt(linePaymentOrder.expiresAt, now),
      ),
    )
    .limit(1);

  return Boolean(orderRows[0]);
}

/**
 * Verify a slip image (base64 JPEG/PNG) against slipok.app.
 * Finds the latest pending order for this LINE user and marks it completed.
 */
export async function verifySlipAndCredit(
  lineUserId: string,
  channelId: string,
  slipBase64: string,
  mimeType: string,
): Promise<VerifySlipResult> {
  if (!SLIPOK_API_KEY) {
    return { ok: false, error: 'ระบบตรวจสอบสลิปยังไม่พร้อมใช้งาน' };
  }

  const now = new Date();

  // Find latest pending order for this user (not expired)
  const orderRows = await db
    .select()
    .from(linePaymentOrder)
    .where(
      and(
        eq(linePaymentOrder.channelId, channelId),
        eq(linePaymentOrder.lineUserId, lineUserId),
        eq(linePaymentOrder.status, 'pending'),
        gt(linePaymentOrder.expiresAt, now),
      ),
    )
    .limit(1);

  const order = orderRows[0];
  if (!order) {
    return {
      ok: false,
      error: 'ไม่พบคำสั่งซื้อที่รอชำระ กรุณาเลือกแพ็กเกจใหม่ พิมพ์ "เติมเครดิต"',
    };
  }

  // Mark as verifying to prevent duplicate processing
  await db
    .update(linePaymentOrder)
    .set({ status: 'verifying', updatedAt: now })
    .where(eq(linePaymentOrder.id, order.id));

  // Call slipok.app API
  let slipData: SlipokResponse;
  try {
    slipData = await callSlipok(slipBase64, mimeType, Number(order.amountThb));
  } catch (err) {
    // Revert to pending so user can retry
    await db
      .update(linePaymentOrder)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(linePaymentOrder.id, order.id));
    const msg = err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบสลิปได้';
    return { ok: false, error: msg };
  }

  if (!slipData.success) {
    await db
      .update(linePaymentOrder)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(linePaymentOrder.id, order.id));
    return { ok: false, error: slipData.message ?? 'สลิปไม่ถูกต้อง กรุณาลองใหม่' };
  }

  const senderName = slipData.data?.sender?.displayName ?? 'ไม่ระบุ';
  const slipRef = slipData.data?.transRef ?? '';

  // Check for duplicate transRef
  if (slipRef) {
    const dupRows = await db
      .select({ id: linePaymentOrder.id })
      .from(linePaymentOrder)
      .where(
        and(
          eq(linePaymentOrder.slipRef, slipRef),
          or(eq(linePaymentOrder.status, 'completed'), eq(linePaymentOrder.status, 'verifying')),
        ),
      )
      .limit(1);

    if (dupRows[0] && dupRows[0].id !== order.id) {
      await db
        .update(linePaymentOrder)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(linePaymentOrder.id, order.id));
      return { ok: false, error: 'สลิปนี้ถูกใช้งานแล้ว' };
    }
  }

  // Complete order + credit user atomically-ish
  await db
    .update(linePaymentOrder)
    .set({ status: 'completed', slipRef, senderName, updatedAt: new Date() })
    .where(eq(linePaymentOrder.id, order.id));

  await addCredits({
    userId: order.userId,
    amount: order.credits,
    type: 'topup',
    description: `LINE top-up: ${order.credits} credits (฿${order.amountThb})`,
  });

  return { ok: true, orderId: order.id, credits: order.credits, senderName };
}

// ── slipok.app API ─────────────────────────────────────────────────────────────

interface SlipokResponse {
  success: boolean;
  message?: string;
  data?: {
    transRef?: string;
    amount?: number;
    sender?: { displayName?: string; account?: { value?: string } };
    receiver?: { displayName?: string; account?: { value?: string } };
  };
}

async function callSlipok(
  imageBase64: string,
  mimeType: string,
  expectedAmountThb: number,
): Promise<SlipokResponse> {
  // slipok.app expects multipart/form-data with 'files' field
  const binaryStr = atob(imageBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const ext = mimeType.includes('png') ? 'slip.png' : 'slip.jpg';
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append('files', blob, ext);
  formData.append('log', 'true');
  formData.append('amount', String(expectedAmountThb));

  const res = await fetch('https://api.slipok.com/api/line/apikey/v3', {
    method: 'POST',
    headers: { 'x-authorization': SLIPOK_API_KEY },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`slipok error: ${text}`);
  }

  return res.json() as Promise<SlipokResponse>;
}

// ── QR image upload to R2 for LINE image message ───────────────────────────────

/**
 * Upload QR PNG to R2 and return a public URL suitable for LINE image message.
 */
export async function uploadQrToR2(qrDataUrl: string, orderId: string): Promise<string> {
  const { uploadPublicObject } = await import('@/lib/r2');
  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const key = `payments/qr/${orderId}.png`;
  const result = await uploadPublicObject({ key, body: buffer, contentType: 'image/png', cacheControl: 'public, max-age=1800' });
  return result.url;
}

// ── LINE message helpers ───────────────────────────────────────────────────────

/**
 * Send the PromptPay QR as a LINE image message followed by instructions.
 */
export async function sendPaymentQr(
  lineClient: messagingApi.MessagingApiClient,
  lineUserId: string,
  pkg: CreditPackage,
  qrDataUrl: string,
  orderId: string,
): Promise<void> {
  const qrUrl = await uploadQrToR2(qrDataUrl, orderId);

  await lineClient.pushMessage({
    to: lineUserId,
    messages: [
      {
        type: 'image',
        originalContentUrl: qrUrl,
        previewImageUrl: qrUrl,
      },
      {
        type: 'text',
        text: [
          `💳 แพ็กเกจ: ${pkg.label}`,
          ``,
          `1. สแกน QR Code ด้านบนด้วยแอปธนาคาร`,
          `2. ชำระเงินจำนวน ฿${pkg.amountThb.toLocaleString()}`,
          `3. ถ่ายรูปสลิปและส่งมาในแชทนี้`,
          ``,
          `⏱ QR Code หมดอายุใน 30 นาที`,
        ].join('\n'),
      },
    ],
  });
}
