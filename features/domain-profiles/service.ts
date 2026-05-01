import {
  mapDomainEntityRelationRow,
  mapDomainEntityRow,
  mapDomainProfileRow,
} from "./server/shared";
import {
  getOwnedEntityRow,
  getOwnedProfileRow,
  getOwnedRelationRow,
  listDomainEntitiesForProfile,
  listDomainProfilesForOwner,
} from "./server/queries";
import {
  deleteDomainEntityRelation,
  insertDomainEntity,
  insertDomainEntityRelation,
  insertDomainProfile,
  migrateDomainProfilesToUser,
  patchDomainEntity,
  patchDomainProfile,
} from "./server/mutations";

import type {
  CreateDomainEntityInput,
  CreateDomainProfileInput,
  DomainEntityDto,
  DomainEntityRelationDto,
  DomainProfileDto,
  DomainProfileOwnerContext,
  LinkDomainEntitiesInput,
  ListDomainEntitiesFilters,
  ListDomainProfilesFilters,
  ResolveRelevantDomainContextInput,
  ResolvedDomainContext,
  UpdateDomainEntityInput,
  UpdateDomainProfileInput,
} from "./types";

function assertOwnerContext(owner: DomainProfileOwnerContext) {
  if (owner.userId) {
    return;
  }

  if (!owner.lineUserId || !owner.channelId) {
    throw new Error("Domain profile owner context is missing identity");
  }
}

function assertNonEmpty(value: string, label: string) {
  if (value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
}

function normalizeProfileInput(input: CreateDomainProfileInput | UpdateDomainProfileInput) {
  if (input.domain !== undefined) {
    assertNonEmpty(input.domain, "domain");
  }

  if (input.name !== undefined) {
    assertNonEmpty(input.name, "name");
  }
}

function normalizeEntityInput(input: CreateDomainEntityInput | UpdateDomainEntityInput) {
  if (input.entityType !== undefined) {
    assertNonEmpty(input.entityType, "entityType");
  }

  if (input.name !== undefined) {
    assertNonEmpty(input.name, "name");
  }
}

function collectSearchableStrings(data: Record<string, unknown>): string[] {
  return Object.entries(data).flatMap(([key, value]) => {
    const values = [key];

    if (typeof value === "string" && value.trim()) {
      values.push(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      values.push(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          values.push(item);
        }
      }
    } else if (value && typeof value === "object") {
      for (const nestedValue of Object.values(value as Record<string, unknown>)) {
        if (typeof nestedValue === "string" && nestedValue.trim()) {
          values.push(nestedValue);
        } else if (
          typeof nestedValue === "number" ||
          typeof nestedValue === "boolean"
        ) {
          values.push(String(nestedValue));
        }
      }
    }

    return values;
  });
}

function selectBestMatchingProfile(
  profiles: DomainProfileDto[],
  userMessage?: string,
): DomainProfileDto | null {
  if (profiles.length === 0) {
    return null;
  }

  if (profiles.length === 1) {
    return profiles[0]!;
  }

  const query = userMessage?.trim().toLowerCase();
  if (!query) {
    return null;
  }

  let best: { profile: DomainProfileDto; score: number } | null = null;

  for (const profile of profiles) {
    const searchable = [
      profile.domain,
      profile.name,
      profile.description ?? "",
      ...collectSearchableStrings(profile.data),
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    const score = searchable.reduce((sum, candidate) => {
      if (query.includes(candidate)) {
        return sum + Math.max(4, candidate.length);
      }

      if (candidate.includes(query)) {
        return sum + Math.max(2, query.length);
      }

      return sum;
    }, 0);

    if (!best || score > best.score) {
      best = { profile, score };
    }
  }

  return best && best.score > 0 ? best.profile : null;
}

export async function createDomainProfile(
  input: CreateDomainProfileInput,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);
  normalizeProfileInput(input);

  const row = await insertDomainProfile(input, owner);
  if (!row) {
    throw new Error("Failed to create domain profile");
  }

  return mapDomainProfileRow(row);
}

export async function updateDomainProfile(
  profileId: string,
  patch: UpdateDomainProfileInput,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);
  normalizeProfileInput(patch);

  const existing = await getOwnedProfileRow(profileId, owner);
  if (!existing) {
    return null;
  }

  const row = await patchDomainProfile(profileId, patch);
  return row ? mapDomainProfileRow(row) : null;
}

export async function getDomainProfile(
  profileId: string,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);

  const row = await getOwnedProfileRow(profileId, owner);
  return row ? mapDomainProfileRow(row) : null;
}

export async function listDomainProfiles(
  owner: DomainProfileOwnerContext,
  filters?: ListDomainProfilesFilters,
) {
  assertOwnerContext(owner);
  return listDomainProfilesForOwner(owner, filters);
}

export async function createDomainEntity(
  profileId: string,
  input: CreateDomainEntityInput,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);
  normalizeEntityInput(input);

  const profile = await getOwnedProfileRow(profileId, owner);
  if (!profile) {
    throw new Error("Domain profile not found");
  }

  const row = await insertDomainEntity(profileId, input);
  if (!row) {
    throw new Error("Failed to create domain entity");
  }

  return mapDomainEntityRow(row);
}

export async function updateDomainEntity(
  entityId: string,
  patch: UpdateDomainEntityInput,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);
  normalizeEntityInput(patch);

  const existing = await getOwnedEntityRow(entityId, owner);
  if (!existing) {
    return null;
  }

  const row = await patchDomainEntity(entityId, patch);
  return row ? mapDomainEntityRow(row) : null;
}

export async function getDomainEntity(
  entityId: string,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);

  const row = await getOwnedEntityRow(entityId, owner);
  return row ? mapDomainEntityRow(row.entity) : null;
}

export async function listDomainEntities(
  profileId: string,
  owner: DomainProfileOwnerContext,
  filters?: ListDomainEntitiesFilters,
) {
  assertOwnerContext(owner);
  return listDomainEntitiesForProfile(profileId, owner, filters);
}

export async function linkDomainEntities(
  input: LinkDomainEntitiesInput,
  owner: DomainProfileOwnerContext,
): Promise<DomainEntityRelationDto> {
  assertOwnerContext(owner);
  assertNonEmpty(input.relationType, "relationType");

  const profile = await getOwnedProfileRow(input.profileId, owner);
  if (!profile) {
    throw new Error("Domain profile not found");
  }

  const fromEntity = await getOwnedEntityRow(input.fromEntityId, owner);
  const toEntity = await getOwnedEntityRow(input.toEntityId, owner);
  if (!fromEntity || !toEntity) {
    throw new Error("One or more domain entities were not found");
  }

  if (
    fromEntity.entity.profileId !== input.profileId ||
    toEntity.entity.profileId !== input.profileId
  ) {
    throw new Error("Domain entity relation must stay within one profile");
  }

  const row = await insertDomainEntityRelation(input);
  if (!row) {
    throw new Error("Failed to create domain entity relation");
  }

  return mapDomainEntityRelationRow(row);
}

export async function unlinkDomainEntities(
  relationId: string,
  owner: DomainProfileOwnerContext,
) {
  assertOwnerContext(owner);

  const existing = await getOwnedRelationRow(relationId, owner);
  if (!existing) {
    return null;
  }

  const row = await deleteDomainEntityRelation(relationId);
  return row ? mapDomainEntityRelationRow(row) : null;
}

export async function resolveRelevantDomainContext(
  input: ResolveRelevantDomainContextInput,
  owner: DomainProfileOwnerContext,
): Promise<ResolvedDomainContext | null> {
  assertOwnerContext(owner);

  if (input.entityId) {
    const entity = await getOwnedEntityRow(input.entityId, owner);
    if (!entity) {
      return null;
    }

    const entities = await listDomainEntitiesForProfile(entity.entity.profileId, owner, {
      entityType: input.entityType,
      limit: input.entityLimit ?? 10,
    });

    return {
      profile: mapDomainProfileRow(entity.profile),
      entities: entities ?? [],
    };
  }

  if (input.profileId) {
    const profile = await getOwnedProfileRow(input.profileId, owner);
    if (!profile) {
      return null;
    }

    const entities = await listDomainEntitiesForProfile(profile.id, owner, {
      entityType: input.entityType,
      limit: input.entityLimit ?? 10,
    });

    return {
      profile: mapDomainProfileRow(profile),
      entities: entities ?? [],
    };
  }

  const profiles = await listDomainProfilesForOwner(owner, {
    domain: input.domain,
    limit: input.profileLimit ?? 10,
  });
  const profile = selectBestMatchingProfile(profiles, input.userMessage);

  if (!profile) {
    return null;
  }

  const entities = await listDomainEntitiesForProfile(profile.id, owner, {
    entityType: input.entityType,
    limit: input.entityLimit ?? 10,
  });

  return {
    profile,
    entities: entities ?? [],
  };
}

export async function migrateLineProfilesToUser(
  lineUserId: string,
  channelId: string,
  userId: string,
) {
  return migrateDomainProfilesToUser(lineUserId, channelId, userId);
}

export type {
  CreateDomainEntityInput,
  CreateDomainProfileInput,
  DomainEntityDto,
  DomainEntityRelationDto,
  DomainProfileDto,
  DomainProfileOwnerContext,
  LinkDomainEntitiesInput,
  ListDomainEntitiesFilters,
  ListDomainProfilesFilters,
  ResolveRelevantDomainContextInput,
  ResolvedDomainContext,
  UpdateDomainEntityInput,
  UpdateDomainProfileInput,
} from "./types";
