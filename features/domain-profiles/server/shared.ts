import type {
  DomainEntityDto,
  DomainEntityRelationDto,
  DomainProfileDto,
} from "../types";

import {
  domainEntity,
  domainEntityRelation,
  domainProfile,
} from "@/db/schema";

export function mapDomainProfileRow(
  row: typeof domainProfile.$inferSelect,
): DomainProfileDto {
  return {
    id: row.id,
    userId: row.userId ?? null,
    lineUserId: row.lineUserId ?? null,
    channelId: row.channelId ?? null,
    brandId: row.brandId ?? null,
    domain: row.domain,
    name: row.name,
    description: row.description ?? null,
    locale: row.locale,
    status: row.status,
    data: row.data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapDomainEntityRow(
  row: typeof domainEntity.$inferSelect,
): DomainEntityDto {
  return {
    id: row.id,
    profileId: row.profileId,
    entityType: row.entityType,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    data: row.data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapDomainEntityRelationRow(
  row: typeof domainEntityRelation.$inferSelect,
): DomainEntityRelationDto {
  return {
    id: row.id,
    profileId: row.profileId,
    fromEntityId: row.fromEntityId,
    toEntityId: row.toEntityId,
    relationType: row.relationType,
    data: row.data,
    createdAt: row.createdAt,
  };
}
