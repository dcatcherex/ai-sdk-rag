export type DomainProfileStatus = "active" | "archived";
export type DomainEntityStatus = "active" | "archived";

export type DomainProfileOwnerContext =
  | {
      userId: string;
      lineUserId?: string | null;
      channelId?: string | null;
      brandId?: string | null;
    }
  | {
      userId?: never;
      lineUserId: string;
      channelId: string;
      brandId?: string | null;
    };

export type DomainProfileData = Record<string, unknown>;

export type DomainProfileDto = {
  id: string;
  userId: string | null;
  lineUserId: string | null;
  channelId: string | null;
  brandId: string | null;
  domain: string;
  name: string;
  description: string | null;
  locale: string;
  status: string;
  data: DomainProfileData;
  createdAt: Date;
  updatedAt: Date;
};

export type DomainEntityDto = {
  id: string;
  profileId: string;
  entityType: string;
  name: string;
  description: string | null;
  status: string;
  data: DomainProfileData;
  createdAt: Date;
  updatedAt: Date;
};

export type DomainEntityRelationDto = {
  id: string;
  profileId: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  data: DomainProfileData;
  createdAt: Date;
};

export type CreateDomainProfileInput = {
  domain: string;
  name: string;
  description?: string | null;
  locale?: string;
  status?: DomainProfileStatus;
  brandId?: string | null;
  data?: DomainProfileData;
};

export type UpdateDomainProfileInput = {
  domain?: string;
  name?: string;
  description?: string | null;
  locale?: string;
  status?: DomainProfileStatus;
  brandId?: string | null;
  data?: DomainProfileData;
};

export type ListDomainProfilesFilters = {
  domain?: string;
  status?: string;
  limit?: number;
};

export type CreateDomainEntityInput = {
  entityType: string;
  name: string;
  description?: string | null;
  status?: DomainEntityStatus;
  data?: DomainProfileData;
};

export type UpdateDomainEntityInput = {
  entityType?: string;
  name?: string;
  description?: string | null;
  status?: DomainEntityStatus;
  data?: DomainProfileData;
};

export type ListDomainEntitiesFilters = {
  entityType?: string;
  status?: string;
  limit?: number;
};

export type LinkDomainEntitiesInput = {
  profileId: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  data?: DomainProfileData;
};

export type ResolveRelevantDomainContextInput = {
  profileId?: string;
  entityId?: string;
  domain?: string;
  entityType?: string;
  userMessage?: string;
  profileLimit?: number;
  entityLimit?: number;
};

export type ResolvedDomainContext = {
  profile: DomainProfileDto;
  entities: DomainEntityDto[];
};
