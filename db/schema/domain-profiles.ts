import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { brand } from "./brands";
import { user } from "./auth";

export const domainProfile = pgTable("domain_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  lineUserId: text("line_user_id"),
  channelId: text("channel_id"),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  locale: text("locale").notNull().default("th-TH"),
  status: text("status").notNull().default("active"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("domain_profile_userId_idx").on(table.userId),
  index("domain_profile_lineUserId_channelId_idx").on(table.lineUserId, table.channelId),
  index("domain_profile_brandId_idx").on(table.brandId),
  index("domain_profile_domain_idx").on(table.domain),
  index("domain_profile_status_idx").on(table.status),
]);

export const domainEntity = pgTable("domain_entity", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => domainProfile.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("domain_entity_profileId_idx").on(table.profileId),
  index("domain_entity_profileId_entityType_idx").on(table.profileId, table.entityType),
  index("domain_entity_status_idx").on(table.status),
]);

export const domainEntityRelation = pgTable("domain_entity_relation", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => domainProfile.id, { onDelete: "cascade" }),
  fromEntityId: text("from_entity_id").notNull().references(() => domainEntity.id, { onDelete: "cascade" }),
  toEntityId: text("to_entity_id").notNull().references(() => domainEntity.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("domain_entity_relation_profileId_idx").on(table.profileId),
  index("domain_entity_relation_fromEntityId_idx").on(table.fromEntityId),
  index("domain_entity_relation_toEntityId_idx").on(table.toEntityId),
  index("domain_entity_relation_relationType_idx").on(table.relationType),
]);

export const domainProfileRelations = relations(domainProfile, ({ one, many }) => ({
  user: one(user, { fields: [domainProfile.userId], references: [user.id] }),
  brand: one(brand, { fields: [domainProfile.brandId], references: [brand.id] }),
  entities: many(domainEntity),
  relations: many(domainEntityRelation),
}));

export const domainEntityRelations = relations(domainEntity, ({ one, many }) => ({
  profile: one(domainProfile, { fields: [domainEntity.profileId], references: [domainProfile.id] }),
  outgoingRelations: many(domainEntityRelation, { relationName: "domain_entity_relation_from" }),
  incomingRelations: many(domainEntityRelation, { relationName: "domain_entity_relation_to" }),
}));

export const domainEntityRelationRelations = relations(domainEntityRelation, ({ one }) => ({
  profile: one(domainProfile, { fields: [domainEntityRelation.profileId], references: [domainProfile.id] }),
  fromEntity: one(domainEntity, {
    fields: [domainEntityRelation.fromEntityId],
    references: [domainEntity.id],
    relationName: "domain_entity_relation_from",
  }),
  toEntity: one(domainEntity, {
    fields: [domainEntityRelation.toEntityId],
    references: [domainEntity.id],
    relationName: "domain_entity_relation_to",
  }),
}));
