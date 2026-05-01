import { and, desc, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import {
  domainEntity,
  domainEntityRelation,
  domainProfile,
} from "@/db/schema";
import { db } from "@/lib/db";

import type {
  DomainProfileOwnerContext,
  ListDomainEntitiesFilters,
  ListDomainProfilesFilters,
} from "../types";
import {
  mapDomainEntityRelationRow,
  mapDomainEntityRow,
  mapDomainProfileRow,
} from "./shared";

function buildProfileOwnershipWhere(owner: DomainProfileOwnerContext) {
  if (owner.userId) {
    return eq(domainProfile.userId, owner.userId);
  }

  const { lineUserId, channelId } = owner;

  return and(
    eq(domainProfile.lineUserId, lineUserId!),
    eq(domainProfile.channelId, channelId!),
  );
}

function buildOptionalProfileFilters(filters?: ListDomainProfilesFilters) {
  const clauses: SQL[] = [];

  if (filters?.domain) {
    clauses.push(eq(domainProfile.domain, filters.domain));
  }

  if (filters?.status) {
    clauses.push(eq(domainProfile.status, filters.status));
  }

  return clauses;
}

function buildOptionalEntityFilters(filters?: ListDomainEntitiesFilters) {
  const clauses: SQL[] = [];

  if (filters?.entityType) {
    clauses.push(eq(domainEntity.entityType, filters.entityType));
  }

  if (filters?.status) {
    clauses.push(eq(domainEntity.status, filters.status));
  }

  return clauses;
}

export async function getOwnedProfileRow(
  profileId: string,
  owner: DomainProfileOwnerContext,
) {
  const [row] = await db
    .select()
    .from(domainProfile)
    .where(and(eq(domainProfile.id, profileId), buildProfileOwnershipWhere(owner)))
    .limit(1);

  return row ?? null;
}

export async function getOwnedEntityRow(
  entityId: string,
  owner: DomainProfileOwnerContext,
) {
  const [row] = await db
    .select({
      entity: domainEntity,
      profile: domainProfile,
    })
    .from(domainEntity)
    .innerJoin(domainProfile, eq(domainEntity.profileId, domainProfile.id))
    .where(and(eq(domainEntity.id, entityId), buildProfileOwnershipWhere(owner)))
    .limit(1);

  return row ?? null;
}

export async function getOwnedRelationRow(
  relationId: string,
  owner: DomainProfileOwnerContext,
) {
  const [row] = await db
    .select({
      relation: domainEntityRelation,
      profile: domainProfile,
    })
    .from(domainEntityRelation)
    .innerJoin(domainProfile, eq(domainEntityRelation.profileId, domainProfile.id))
    .where(and(eq(domainEntityRelation.id, relationId), buildProfileOwnershipWhere(owner)))
    .limit(1);

  return row ?? null;
}

export async function listDomainProfilesForOwner(
  owner: DomainProfileOwnerContext,
  filters?: ListDomainProfilesFilters,
) {
  const rows = await db
    .select()
    .from(domainProfile)
    .where(and(buildProfileOwnershipWhere(owner), ...buildOptionalProfileFilters(filters)))
    .orderBy(desc(domainProfile.updatedAt))
    .limit(filters?.limit ?? 25);

  return rows.map(mapDomainProfileRow);
}

export async function listDomainEntitiesForProfile(
  profileId: string,
  owner: DomainProfileOwnerContext,
  filters?: ListDomainEntitiesFilters,
) {
  const profile = await getOwnedProfileRow(profileId, owner);
  if (!profile) {
    return null;
  }

  const rows = await db
    .select()
    .from(domainEntity)
    .where(and(eq(domainEntity.profileId, profileId), ...buildOptionalEntityFilters(filters)))
    .orderBy(desc(domainEntity.updatedAt))
    .limit(filters?.limit ?? 50);

  return rows.map(mapDomainEntityRow);
}

export async function listRelationsForProfile(profileId: string) {
  const rows = await db
    .select()
    .from(domainEntityRelation)
    .where(eq(domainEntityRelation.profileId, profileId))
    .orderBy(desc(domainEntityRelation.createdAt));

  return rows.map(mapDomainEntityRelationRow);
}

export async function listEntitiesByIds(entityIds: string[]) {
  if (entityIds.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(domainEntity)
    .where(inArray(domainEntity.id, entityIds));

  return rows.map(mapDomainEntityRow);
}
