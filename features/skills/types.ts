export type SkillTriggerType = 'slash' | 'keyword' | 'always';

export type Skill = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  triggerType: SkillTriggerType;
  /** The slash command (e.g. '/email') or keyword. Null when triggerType is 'always'. */
  trigger: string | null;
  promptFragment: string;
  enabledTools: string[];
  sourceUrl: string | null;
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateSkillInput = {
  name: string;
  description?: string;
  triggerType: SkillTriggerType;
  trigger?: string | null;
  promptFragment: string;
  enabledTools?: string[];
  sourceUrl?: string | null;
  isPublic?: boolean;
};

export type UpdateSkillInput = Partial<CreateSkillInput>;

export type ImportSkillInput = {
  /** GitHub URL to a SKILL.md file or raw content URL */
  url: string;
};

export type SkillWithOwner = Skill & {
  ownerName?: string;
};
