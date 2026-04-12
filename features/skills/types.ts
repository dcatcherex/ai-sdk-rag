export type SkillTriggerType = 'slash' | 'keyword' | 'always';
export type SkillKind = 'inline' | 'package';
export type SkillActivationMode = 'rule' | 'model';
export type SkillSyncStatus = 'local' | 'synced' | 'update_available' | 'diverged' | 'error';
export type SkillFileKind = 'skill' | 'reference' | 'asset' | 'script' | 'other';
export type CatalogScope = 'personal' | 'system';
export type CatalogStatus = 'draft' | 'published' | 'archived';
export type CloneBehavior = 'locked' | 'editable_copy';
export type UpdatePolicy = 'none' | 'notify' | 'auto_for_locked';

export type SkillPackageManifest = {
  importedFileCount: number;
  counts: {
    references: number;
    assets: number;
    scripts: number;
    other: number;
  };
  preservedAdditionalPaths: string[];
  repo?: string;
  repoRef?: string;
  subdirPath?: string;
};

export type SkillFile = {
  id: string;
  skillId: string;
  relativePath: string;
  fileKind: SkillFileKind;
  mediaType: string | null;
  textContent: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateSkillFileInput = {
  relativePath: string;
  textContent: string;
};

export type SkillSource = {
  id: string;
  sourceType: string;
  canonicalUrl: string;
  repoOwner: string | null;
  repoName: string | null;
  repoRef: string | null;
  subdirPath: string | null;
  defaultEntryPath: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type Skill = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  triggerType: SkillTriggerType;
  trigger: string | null;
  promptFragment: string;
  enabledTools: string[];
  sourceUrl: string | null;
  sourceId: string | null;
  skillKind: SkillKind;
  activationMode: SkillActivationMode;
  entryFilePath: string;
  installedRef: string | null;
  installedCommitSha: string | null;
  upstreamCommitSha: string | null;
  syncStatus: SkillSyncStatus;
  pinnedToInstalledVersion: boolean;
  hasBundledFiles: boolean;
  packageManifest: SkillPackageManifest | null;
  lastSyncCheckedAt: string | Date | null;
  lastSyncedAt: string | Date | null;
  imageUrl: string | null;
  isPublic: boolean;
  isTemplate: boolean;
  templateId: string | null;
  catalogScope: CatalogScope;
  catalogStatus: CatalogStatus;
  managedByAdmin: boolean;
  cloneBehavior: CloneBehavior;
  updatePolicy: UpdatePolicy;
  lockedFields: string[];
  version: number;
  sourceTemplateVersion: number | null;
  publishedAt: string | Date | null;
  archivedAt: string | Date | null;
  changelog: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SkillDetail = Skill & {
  files: SkillFile[];
  source: SkillSource | null;
};

export type AgentSkillAttachmentInput = {
  skillId: string;
  isEnabled?: boolean;
  activationModeOverride?: SkillActivationMode | null;
  triggerTypeOverride?: SkillTriggerType | null;
  triggerOverride?: string | null;
  priority?: number;
  notes?: string | null;
};

export type AgentSkillAttachment = {
  id: string;
  agentId: string;
  skillId: string;
  isEnabled: boolean;
  activationModeOverride: SkillActivationMode | null;
  triggerTypeOverride: SkillTriggerType | null;
  triggerOverride: string | null;
  priority: number;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  skill?: Skill;
};

export type CreateSkillInput = {
  name: string;
  description: string;
  activationMode?: SkillActivationMode;
  triggerType?: SkillTriggerType;
  trigger?: string | null;
  promptFragment: string;
  enabledTools?: string[];
  sourceUrl?: string | null;
  skillKind?: SkillKind;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  files?: CreateSkillFileInput[];
  imageUrl?: string | null;
  isPublic?: boolean;
};

export type UpdateSkillInput = Partial<CreateSkillInput>;

export type ImportSkillInput = {
  url: string;
};

export type SkillWithOwner = Skill & {
  ownerName?: string;
};

export type SkillSyncCheckResult = {
  status: SkillSyncStatus;
  installedCommitSha: string | null;
  upstreamCommitSha: string | null;
  changedFiles: string[];
  checkedAt: string | Date;
};

export type SkillSyncApplyResult = SkillSyncCheckResult & {
  skill: Skill;
};
