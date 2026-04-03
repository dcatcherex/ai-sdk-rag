export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived';
export type CalendarEntryStatus = 'idea' | 'briefed' | 'drafting' | 'review' | 'approved' | 'scheduled' | 'published' | 'repurposed';
export type CalendarEntryContentType = 'blog_post' | 'newsletter' | 'social' | 'email' | 'ad_copy' | 'other';
export type CalendarChannel = 'instagram' | 'facebook' | 'linkedin' | 'email' | 'blog' | 'other';

export type CampaignBrief = {
  id: string;
  userId: string;
  brandId: string | null;
  title: string;
  goal: string | null;
  offer: string | null;
  keyMessage: string | null;
  cta: string | null;
  channels: string[];
  startDate: string | null;
  endDate: string | null;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CalendarEntry = {
  id: string;
  userId: string;
  brandId: string | null;
  campaignId: string | null;
  contentPieceId: string | null;
  title: string;
  contentType: CalendarEntryContentType;
  channel: CalendarChannel | null;
  status: CalendarEntryStatus;
  plannedDate: string;
  notes: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};
