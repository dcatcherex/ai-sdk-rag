export type WorkspaceMemberRole = 'admin' | 'writer' | 'editor' | 'reviewer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type WorkspaceMember = {
  id: string;
  brandId: string;
  userId: string;
  role: WorkspaceMemberRole;
  invitedBy: string | null;
  joinedAt: Date | null;
  createdAt: Date;
  // populated by join:
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
};

export type ApprovalRequest = {
  id: string;
  contentPieceId: string;
  brandId: string | null;
  requesterId: string;
  assigneeId: string | null;
  status: ApprovalStatus;
  dueAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  // populated by join:
  contentPieceTitle?: string;
  requesterName?: string;
  assigneeName?: string | null;
};

export type ContentComment = {
  id: string;
  contentPieceId: string;
  userId: string;
  parentId: string | null;
  body: string;
  resolved: boolean;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName?: string;
  userImage?: string | null;
  replies?: ContentComment[];
};
