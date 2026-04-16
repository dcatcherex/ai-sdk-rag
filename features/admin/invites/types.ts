export type AdminUserInviteStatus = "invited" | "accepted" | "expired" | "cancelled";

export type AdminUserInviteRecord = {
  id: string;
  email: string;
  name: string | null;
  status: AdminUserInviteStatus;
  token: string;
  invitedByUserId: string | null;
  invitedByUserName: string | null;
  invitedByUserEmail: string | null;
  approvedOnAccept: boolean;
  initialCreditGrant: number;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  acceptedUserName: string | null;
  acceptedUserEmail: string | null;
  cancelledAt: Date | null;
  lastSentAt: Date | null;
  creditGrantedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminUserInviteListResult = {
  invites: AdminUserInviteRecord[];
  total: number;
  page: number;
  totalPages: number;
};

export type ClaimAdminInviteResult = {
  invite: AdminUserInviteRecord;
  alreadyAccepted: boolean;
  needsPasswordSetup: boolean;
};
