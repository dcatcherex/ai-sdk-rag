import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agent } from "./agents";
import { chatThread } from "./chat";

// ── LINE OA Integration ───────────────────────────────────────────────────────

/**
 * One row per LINE Official Account connected by a user.
 * channelSecret is used for webhook signature verification.
 * channelAccessToken is used for sending messages via LINE API.
 */
export const lineOaChannel = pgTable("line_oa_channel", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agent.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  lineChannelId: text("line_channel_id").notNull(),
  channelSecret: text("channel_secret").notNull(),
  channelAccessToken: text("channel_access_token").notNull(),
  status: text("status").notNull().default("active"),
  /** LINE platform menu ID to assign to a user after they register as a member. */
  memberRichMenuLineId: text("member_rich_menu_line_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("line_oa_channel_userId_idx").on(table.userId),
  index("line_oa_channel_lineChannelId_idx").on(table.lineChannelId),
]);

/**
 * Maps a LINE user (lineUserId) within a channel to a chatThread.
 * This gives each LINE user persistent conversation context.
 */
export const lineConversation = pgTable("line_conversation", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  /** For 1:1 chats: the LINE user ID. For group chats: the group ID (used as conversation key). */
  lineUserId: text("line_user_id").notNull(),
  threadId: text("thread_id").notNull().references(() => chatThread.id, { onDelete: "cascade" }),
  /** Populated for group-source events. Null for 1:1. */
  groupId: text("group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("line_conversation_channel_user_idx").on(table.channelId, table.lineUserId),
  index("line_conversation_channelId_idx").on(table.channelId),
  index("line_conversation_threadId_idx").on(table.threadId),
]);

export const lineOaChannelRelations = relations(lineOaChannel, ({ one, many }) => ({
  user: one(user, { fields: [lineOaChannel.userId], references: [user.id] }),
  agent: one(agent, { fields: [lineOaChannel.agentId], references: [agent.id] }),
  conversations: many(lineConversation),
  richMenus: many(lineRichMenu),
}));

export const lineConversationRelations = relations(lineConversation, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineConversation.channelId], references: [lineOaChannel.id] }),
  thread: one(chatThread, { fields: [lineConversation.threadId], references: [chatThread.id] }),
}));

// ── Rich Menu ─────────────────────────────────────────────────────────────────

export type RichMenuBounds = { x: number; y: number; width: number; height: number };

export type RichMenuAreaConfig = {
  label: string;
  emoji: string;
  bgColor: string;
  bounds?: RichMenuBounds;
  action: {
    type: "message" | "uri" | "postback" | "switch_agent";
    text?: string;
    uri?: string;
    data?: string;
    displayText?: string;
    agentId?: string; // used by switch_agent
  };
};

export const lineRichMenu = pgTable("line_rich_menu", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  lineMenuId: text("line_menu_id"),
  name: text("name").notNull(),
  chatBarText: text("chat_bar_text").notNull().default("เมนู"),
  areas: jsonb("areas").notNull().$type<RichMenuAreaConfig[]>().default([]),
  backgroundImageUrl: text("background_image_url"),
  isDefault: boolean("is_default").notNull().default(false),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("line_rich_menu_channelId_idx").on(table.channelId),
]);

// Tracks which rich menu is currently assigned to each LINE user
export const lineUserMenu = pgTable("line_user_menu", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  lineUserId: text("line_user_id").notNull(),
  lineMenuId: text("line_menu_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("line_user_menu_channel_user_idx").on(table.channelId, table.lineUserId),
]);

// Reusable rich menu templates — user-scoped, apply to any channel
export const lineRichMenuTemplate = pgTable("line_rich_menu_template", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  chatBarText: text("chat_bar_text").notNull().default("เมนู"),
  areas: jsonb("areas").notNull().$type<RichMenuAreaConfig[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("line_rich_menu_template_userId_idx").on(table.userId),
]);

export const lineRichMenuRelations = relations(lineRichMenu, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineRichMenu.channelId], references: [lineOaChannel.id] }),
}));

export const lineUserMenuRelations = relations(lineUserMenu, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineUserMenu.channelId], references: [lineOaChannel.id] }),
}));

// ─── Broadcast / Narrowcast ────────────────────────────────────────────────

export type BroadcastMessageType = "text" | "flex";
export type BroadcastTargetType = "all" | "followers";
export type BroadcastStatus = "draft" | "sending" | "sent" | "partial" | "failed";

export const lineBroadcast = pgTable("line_broadcast", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetType: text("target_type").notNull().default("all").$type<BroadcastTargetType>(),
  messageType: text("message_type").notNull().default("text").$type<BroadcastMessageType>(),
  messageText: text("message_text"),
  messagePayload: jsonb("message_payload").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("draft").$type<BroadcastStatus>(),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count"),
  customAggregationUnit: text("custom_aggregation_unit"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("line_broadcast_channelId_idx").on(table.channelId),
]);

export const lineBroadcastRelations = relations(lineBroadcast, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineBroadcast.channelId], references: [lineOaChannel.id] }),
}));

// ─── Audience Groups ──────────────────────────────────────────────────────────

/**
 * LINE audience group created for narrowcast targeting.
 * One audience = a named list of LINE user IDs uploaded to LINE platform.
 */
export const lineAudience = pgTable("line_audience", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** LINE-side audience group ID (returned by LINE API on creation) */
  lineAudienceGroupId: text("line_audience_group_id"),
  audienceCount: integer("audience_count").notNull().default(0),
  /** creating | ready | expired | error */
  status: text("status").notNull().default("creating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("line_audience_channelId_idx").on(table.channelId),
]);

export const lineAudienceUser = pgTable("line_audience_user", {
  id: text("id").primaryKey(),
  audienceId: text("audience_id").notNull().references(() => lineAudience.id, { onDelete: "cascade" }),
  lineUserId: text("line_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("line_audience_user_audience_line_user_idx").on(table.audienceId, table.lineUserId),
]);

export const lineAudienceRelations = relations(lineAudience, ({ one, many }) => ({
  channel: one(lineOaChannel, { fields: [lineAudience.channelId], references: [lineOaChannel.id] }),
  users: many(lineAudienceUser),
}));

export const lineAudienceUserRelations = relations(lineAudienceUser, ({ one }) => ({
  audience: one(lineAudience, { fields: [lineAudienceUser.audienceId], references: [lineAudience.id] }),
}));

// ─── Account Linking ───────────────────────────────────────────────────────

/**
 * Short-lived token generated by the app user in the dashboard.
 * The LINE user sends this token in chat to claim ownership.
 */
export const lineAccountLinkToken = pgTable("line_account_link_token", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("line_account_link_token_userId_idx").on(table.userId),
  index("line_account_link_token_channelId_idx").on(table.channelId),
]);

/**
 * Permanent link between an app user account and a LINE user ID on a given channel.
 */
export const lineAccountLink = pgTable("line_account_link", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  lineUserId: text("line_user_id").notNull(),
  displayName: text("display_name"),
  pictureUrl: text("picture_url"),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("line_account_link_channel_line_user_idx").on(table.channelId, table.lineUserId),
  index("line_account_link_userId_idx").on(table.userId),
  index("line_account_link_channelId_idx").on(table.channelId),
]);

export const lineAccountLinkRelations = relations(lineAccountLink, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineAccountLink.channelId], references: [lineOaChannel.id] }),
  user: one(user, { fields: [lineAccountLink.userId], references: [user.id] }),
}));

/**
 * Tracks which agent is currently active for each LINE user within a channel.
 * Applies to ALL users (linked and anonymous). Updated when user taps a
 * "Switch Agent" rich menu button. Falls back to channel default when null.
 */
export const lineUserAgentSession = pgTable("line_user_agent_session", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  lineUserId: text("line_user_id").notNull(),
  activeAgentId: text("active_agent_id").references(() => agent.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("line_user_agent_session_channel_user_idx").on(table.channelId, table.lineUserId),
  index("line_user_agent_session_channelId_idx").on(table.channelId),
]);

export const lineUserAgentSessionRelations = relations(lineUserAgentSession, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineUserAgentSession.channelId], references: [lineOaChannel.id] }),
  agent: one(agent, { fields: [lineUserAgentSession.activeAgentId], references: [agent.id] }),
}));

// ─── Channel Analytics ──────────────────────────────────────────────────────

/**
 * Daily aggregate stats per LINE OA channel.
 * Upserted after every processed message event.
 */
export const lineChannelDailyStat = pgTable("line_channel_daily_stat", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  date: text("date").notNull(),           // YYYY-MM-DD
  messageCount: integer("message_count").notNull().default(0),
  uniqueUsers: integer("unique_users").notNull().default(0),
  toolCallCount: integer("tool_call_count").notNull().default(0),
  imagesSent: integer("images_sent").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("line_channel_daily_stat_channel_date_idx").on(table.channelId, table.date),
  index("line_channel_daily_stat_channelId_idx").on(table.channelId),
]);

/**
 * One row per (channel, date, lineUserId) — used to compute uniqueUsers accurately.
 */
export const lineChannelDailyUser = pgTable("line_channel_daily_user", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  lineUserId: text("line_user_id").notNull(),
}, (table) => [
  uniqueIndex("line_channel_daily_user_uniq_idx").on(table.channelId, table.date, table.lineUserId),
]);

export const lineChannelDailyStatRelations = relations(lineChannelDailyStat, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineChannelDailyStat.channelId], references: [lineOaChannel.id] }),
}));

export const lineChannelDailyUserRelations = relations(lineChannelDailyUser, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineChannelDailyUser.channelId], references: [lineOaChannel.id] }),
}));

// ── LINE Payment Orders ────────────────────────────────────────────────────────

/**
 * One row per PromptPay top-up initiated by a LINE user.
 * Flow: createOrder → user pays → sends slip → slipok verifies → completePayment
 */
export const linePaymentOrder = pgTable("line_payment_order", {
  id: text("id").primaryKey(),
  /** App user who owns this order (from lineAccountLink) */
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  /** LINE user who initiated the order */
  lineUserId: text("line_user_id").notNull(),
  /** Which package was selected (matches CREDIT_PACKAGES id) */
  packageId: text("package_id").notNull(),
  /** Amount in Thai Baht (e.g., "100.00") */
  amountThb: numeric("amount_thb", { precision: 10, scale: 2 }).notNull(),
  /** Credits to be granted on success */
  credits: integer("credits").notNull(),
  /** pending | verifying | completed | failed | expired */
  status: text("status").notNull().default("pending"),
  /** slipok.app transaction reference (populated on verify) */
  slipRef: text("slip_ref"),
  /** Sender name returned by slipok (for display) */
  senderName: text("sender_name"),
  /** Order expires after 30 minutes */
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("line_payment_order_userId_idx").on(table.userId),
  index("line_payment_order_channelId_lineUserId_idx").on(table.channelId, table.lineUserId),
  index("line_payment_order_status_idx").on(table.status),
]);

export const linePaymentOrderRelations = relations(linePaymentOrder, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [linePaymentOrder.channelId], references: [lineOaChannel.id] }),
}));

// ── LINE Beacon Devices ────────────────────────────────────────────────────────

/**
 * Registered LINE Beacon hardware devices linked to a channel.
 * When a user enters beacon range, LINE fires a 'beacon' webhook event with the hwid.
 */
export const lineBeaconDevice = pgTable("line_beacon_device", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => lineOaChannel.id, { onDelete: "cascade" }),
  /** Hardware ID stamped on the physical beacon unit */
  hwid: text("hwid").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** Optional message pushed to the user when they enter beacon range */
  enterMessage: text("enter_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("line_beacon_device_channel_hwid_idx").on(table.channelId, table.hwid),
  index("line_beacon_device_channelId_idx").on(table.channelId),
]);

export const lineBeaconDeviceRelations = relations(lineBeaconDevice, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineBeaconDevice.channelId], references: [lineOaChannel.id] }),
}));
