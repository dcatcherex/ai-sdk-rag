import type { FlexCategory, FlexCatalogStatus, FlexTemplateType } from '@/db/schema/line-oa';

export type { FlexCategory, FlexCatalogStatus, FlexTemplateType };

export type FlexTemplateRecord = {
  id: string;
  name: string;
  description: string | null;
  category: FlexCategory;
  tags: string[];
  templateType: FlexTemplateType;
  richTemplateKey: string | null;
  flexPayload: Record<string, unknown>;
  altText: string;
  previewImageUrl: string | null;
  catalogStatus: FlexCatalogStatus;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FlexDraftRecord = {
  id: string;
  userId: string;
  channelId: string | null;
  name: string;
  altText: string;
  flexPayload: Record<string, unknown>;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveFlexDraftInput = {
  name: string;
  altText: string;
  flexPayload: Record<string, unknown>;
  channelId?: string | null;
  templateId?: string | null;
};

export type UpdateFlexDraftInput = {
  id: string;
  name?: string;
  altText?: string;
  flexPayload?: Record<string, unknown>;
};
