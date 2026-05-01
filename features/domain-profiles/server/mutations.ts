import { and, eq } from "drizzle-orm";

import {
  domainEntity,
  domainEntityRelation,
  domainProfile,
} from "@/db/schema";
import { db } from "@/lib/db";

import type {
  CreateDomainEntityInput,
  CreateDomainProfileInput,
  DomainProfileOwnerContext,
  LinkDomainEntitiesInput,
  UpdateDomainEntityInput,
  UpdateDomainProfileInput,
} from "../types";

function normalizeOwnerColumns(owner: DomainProfileOwnerContext) {
  if (owner.userId) {
    return {
      userId: owner.userId,
      lineUserId: null,
      channelId: null,
    };
  }

  return {
    userId: null,
    lineUserId: owner.lineUserId,
    channelId: owner.channelId,
  };
}

export async function insertDomainProfile(
  input: CreateDomainProfileInput,
  owner: DomainProfileOwnerContext,
) {
  const [row] = await db
    .insert(domainProfile)
    .values({
      id: crypto.randomUUID(),
      ...normalizeOwnerColumns(owner),
      brandId: input.brandId ?? owner.brandId ?? null,
      domain: input.domain,
      name: input.name,
      description: input.description ?? null,
      locale: input.locale ?? "th-TH",
      status: input.status ?? "active",
      data: input.data ?? {},
    })
    .returning();

  return row ?? null;
}

export async function patchDomainProfile(
  profileId: string,
  input: UpdateDomainProfileInput,
) {
  const [row] = await db
    .update(domainProfile)
    .set({
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.brandId !== undefined ? { brandId: input.brandId ?? null } : {}),
      ...(input.data !== undefined ? { data: input.data } : {}),
    })
    .where(eq(domainProfile.id, profileId))
    .returning();

  return row ?? null;
}

export async function insertDomainEntity(
  profileId: string,
  input: CreateDomainEntityInput,
) {
  const [row] = await db
    .insert(domainEntity)
    .values({
      id: crypto.randomUUID(),
      profileId,
      entityType: input.entityType,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "active",
      data: input.data ?? {},
    })
    .returning();

  return row ?? null;
}

export async function patchDomainEntity(
  entityId: string,
  input: UpdateDomainEntityInput,
) {
  const [row] = await db
    .update(domainEntity)
    .set({
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.data !== undefined ? { data: input.data } : {}),
    })
    .where(eq(domainEntity.id, entityId))
    .returning();

  return row ?? null;
}

export async function insertDomainEntityRelation(
  input: LinkDomainEntitiesInput,
) {
  const [row] = await db
    .insert(domainEntityRelation)
    .values({
      id: crypto.randomUUID(),
      profileId: input.profileId,
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      relationType: input.relationType,
      data: input.data ?? {},
    })
    .returning();

  return row ?? null;
}

export async function deleteDomainEntityRelation(relationId: string) {
  const [row] = await db
    .delete(domainEntityRelation)
    .where(eq(domainEntityRelation.id, relationId))
    .returning();

  return row ?? null;
}

export async function migrateDomainProfilesToUser(
  lineUserId: string,
  channelId: string,
  userId: string,
) {
  const result = await db
    .update(domainProfile)
    .set({
      userId,
      lineUserId: null,
      channelId: null,
    })
    .where(
      and(
        eq(domainProfile.lineUserId, lineUserId),
        eq(domainProfile.channelId, channelId),
      ),
    )
    .returning({ id: domainProfile.id });

  return result.map((row) => row.id);
}
