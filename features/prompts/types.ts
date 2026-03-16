export type Prompt = {
  id: string;
  userId: string | null;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  isBuiltIn: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePromptInput = {
  title: string;
  content: string;
  category: string;
  tags: string[];
  isPublic: boolean;
};

export type UpdatePromptInput = {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
};
