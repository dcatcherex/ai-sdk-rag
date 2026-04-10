export type LineOaChannel = {
  id: string;
  name: string;
  lineChannelId: string;
  agentId: string | null;
  agentName: string | null;
  imageUrl: string | null;
  status: 'active' | 'inactive';
  memberRichMenuLineId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateLineOaChannelInput = {
  name: string;
  lineChannelId: string;
  channelSecret: string;
  channelAccessToken: string;
  agentId?: string | null;
  imageUrl?: string | null;
  status?: 'active' | 'inactive';
};

export type UpdateLineOaChannelInput = Partial<CreateLineOaChannelInput> & {
  memberRichMenuLineId?: string | null;
};
