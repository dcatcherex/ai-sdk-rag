import { and, eq } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { lineOaChannel, lineRichMenu, lineUserMenu } from '@/db/schema';
import { buildLineRichMenuPayload } from './builder';
import { generateRichMenuImage } from './image';

/**
 * Deploy a rich menu config to LINE:
 *  1. Generate image
 *  2. Create rich menu on LINE
 *  3. Upload image
 *  4. Optionally set as default for all users
 *  5. Update DB status + lineMenuId
 */
export async function deployRichMenu(
  richMenuDbId: string,
  userId: string,
): Promise<{ lineMenuId: string }> {
  // Load menu + channel in parallel
  const [menuRows, channelRows] = await Promise.all([
    db
      .select()
      .from(lineRichMenu)
      .where(eq(lineRichMenu.id, richMenuDbId))
      .limit(1),
    db
      .select({ accessToken: lineOaChannel.channelAccessToken, userId: lineOaChannel.userId })
      .from(lineOaChannel)
      .innerJoin(lineRichMenu, eq(lineRichMenu.channelId, lineOaChannel.id))
      .where(eq(lineRichMenu.id, richMenuDbId))
      .limit(1),
  ]);

  const menu = menuRows[0];
  const channel = channelRows[0];
  if (!menu || !channel) throw new Error('Menu or channel not found');
  if (channel.userId !== userId) throw new Error('Unauthorized');

  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: channel.accessToken,
  });
  const lineBlobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: channel.accessToken,
  });

  // Build LINE API payload
  const payload = buildLineRichMenuPayload(menu.areas, menu.chatBarText, menu.name);

  // Create menu on LINE
  const { richMenuId: lineMenuId } = await lineClient.createRichMenu(payload);

  // Use custom uploaded image if present, otherwise auto-generate
  let imageBlob: Blob;
  if (menu.backgroundImageUrl) {
    const response = await fetch(menu.backgroundImageUrl);
    if (!response.ok) throw new Error('Failed to fetch custom background image');
    const contentType = response.headers.get('content-type') ?? 'image/png';
    imageBlob = new Blob([await response.arrayBuffer()], { type: contentType });
  } else {
    const imageBuffer = await generateRichMenuImage(menu.areas);
    imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  }
  await lineBlobClient.setRichMenuImage(lineMenuId, imageBlob);

  // Update DB
  await db
    .update(lineRichMenu)
    .set({ lineMenuId, status: 'active', updatedAt: new Date() })
    .where(eq(lineRichMenu.id, richMenuDbId));

  return { lineMenuId };
}

/**
 * Set this menu as the default for all users on the channel.
 * Clears the previous default flag in DB.
 */
export async function setDefaultRichMenu(
  richMenuDbId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({
      lineMenuId: lineRichMenu.lineMenuId,
      channelId: lineRichMenu.channelId,
      accessToken: lineOaChannel.channelAccessToken,
      channelUserId: lineOaChannel.userId,
    })
    .from(lineRichMenu)
    .innerJoin(lineOaChannel, eq(lineRichMenu.channelId, lineOaChannel.id))
    .where(eq(lineRichMenu.id, richMenuDbId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error('Menu not found');
  if (row.channelUserId !== userId) throw new Error('Unauthorized');
  if (!row.lineMenuId) throw new Error('Menu not deployed yet — deploy first');

  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: row.accessToken,
  });

  await lineClient.setDefaultRichMenu(row.lineMenuId);

  // Update isDefault flag: clear others, set this one
  await db
    .update(lineRichMenu)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(lineRichMenu.channelId, row.channelId));

  await db
    .update(lineRichMenu)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(lineRichMenu.id, richMenuDbId));
}

/**
 * Assign a specific rich menu to a LINE user (per-user switching).
 */
export async function setUserRichMenu(
  lineUserId: string,
  lineMenuId: string,
  channelId: string,
  channelAccessToken: string,
): Promise<void> {
  const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken });
  await lineClient.linkRichMenuIdToUser(lineUserId, lineMenuId);

  // Upsert user menu record
  const existing = await db
    .select()
    .from(lineUserMenu)
    .where(and(eq(lineUserMenu.channelId, channelId), eq(lineUserMenu.lineUserId, lineUserId)))
    .limit(1);

  const now = new Date();
  if (existing.length > 0) {
    await db
      .update(lineUserMenu)
      .set({ lineMenuId, updatedAt: now })
      .where(and(eq(lineUserMenu.channelId, channelId), eq(lineUserMenu.lineUserId, lineUserId)));
  } else {
    await db.insert(lineUserMenu).values({
      id: crypto.randomUUID(),
      channelId,
      lineUserId,
      lineMenuId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Delete a deployed menu from LINE and update our DB.
 */
export async function deleteDeployedRichMenu(
  richMenuDbId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({
      lineMenuId: lineRichMenu.lineMenuId,
      accessToken: lineOaChannel.channelAccessToken,
      channelUserId: lineOaChannel.userId,
    })
    .from(lineRichMenu)
    .innerJoin(lineOaChannel, eq(lineRichMenu.channelId, lineOaChannel.id))
    .where(eq(lineRichMenu.id, richMenuDbId))
    .limit(1);

  const row = rows[0];
  if (!row) return;
  if (row.channelUserId !== userId) throw new Error('Unauthorized');

  // Delete from LINE if deployed
  if (row.lineMenuId) {
    const lineClient = new messagingApi.MessagingApiClient({
      channelAccessToken: row.accessToken,
    });
    await lineClient.deleteRichMenu(row.lineMenuId).catch(() => {
      // Ignore if already deleted on LINE side
    });
  }

  await db.delete(lineRichMenu).where(eq(lineRichMenu.id, richMenuDbId));
}
