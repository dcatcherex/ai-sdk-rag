/**
 * Curated LINE sticker selections for Vaja AI.
 * Brown & Cony "Hectic Daily Life" (package 11537) — widely recognized in Thailand.
 * All stickers are sendable via the Messaging API regardless of whether the recipient owns the pack.
 */

type Sticker = { packageId: string; stickerId: string };

/** Stickers for the follow-event welcome message */
export const WELCOME_STICKERS: Sticker[] = [
  { packageId: '11537', stickerId: '52002735' }, // Brown waving hello
  { packageId: '11537', stickerId: '52002736' }, // Cony jumping
  { packageId: '11537', stickerId: '52002738' }, // Brown excited
];

/** Stickers for occasional short friendly replies */
export const FRIENDLY_STICKERS: Sticker[] = [
  { packageId: '11537', stickerId: '52002744' }, // Brown thumbs up
  { packageId: '11537', stickerId: '52002748' }, // Cony celebrating
  { packageId: '11537', stickerId: '52002753' }, // Brown happy stars
  { packageId: '11537', stickerId: '52002743' }, // Cony heart eyes
];

export function pickRandom(stickers: Sticker[]): Sticker {
  return stickers[Math.floor(Math.random() * stickers.length)]!;
}

/**
 * Returns true ~20% of the time for short, conclusive AI replies.
 * Used to add a friendly sticker without being intrusive.
 */
export function shouldAddFriendlySticker(replyText: string): boolean {
  if (replyText.length > 80) return false;
  if (replyText.includes('?') || replyText.includes('？')) return false;
  if (replyText.includes('❌') || replyText.includes('ข้อผิดพลาด')) return false;
  return Math.random() < 0.2;
}
