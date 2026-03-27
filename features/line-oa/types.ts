export type LineOaChannel = {
  id: string;
  name: string;
  lineChannelId: string;
  agentId: string | null;
  agentName: string | null;
  status: 'active' | 'inactive';
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateLineOaChannelInput = {
  name: string;
  lineChannelId: string;
  channelSecret: string;
  channelAccessToken: string;
  agentId?: string | null;
  status?: 'active' | 'inactive';
};

export type UpdateLineOaChannelInput = Partial<CreateLineOaChannelInput>;
