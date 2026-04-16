export type SortBy = 'joined' | 'lastActive' | 'runs' | 'creditsUsed' | 'balance';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  approved: boolean;
  balance: number;
  createdAt: string;
  lastActiveAt: string | null;
  totalRuns: number;
  creditsUsed: number;
};

export type UsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
};

export type AdminInviteStatus = 'invited' | 'accepted' | 'expired' | 'cancelled';

export type AdminInvite = {
  id: string;
  email: string;
  name: string | null;
  status: AdminInviteStatus;
  invitedByUserName: string | null;
  invitedByUserEmail: string | null;
  approvedOnAccept: boolean;
  initialCreditGrant: number;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedUserName: string | null;
  acceptedUserEmail: string | null;
  cancelledAt: string | null;
  lastSentAt: string | null;
  creditGrantedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvitesResponse = {
  invites: AdminInvite[];
  total: number;
  page: number;
  totalPages: number;
};

export type InviteStatusFilter = 'all' | AdminInviteStatus;

export type RunEntry = {
  id: string;
  type: 'chat' | 'tool' | 'workspace';
  status: string;
  label: string;
  detail: string | null;
  createdAt: string;
};

export type Transaction = {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string | null;
  createdAt: string;
};

export type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    balance: number;
  };
  stats: {
    totalRuns: number;
    creditsUsed: number;
    lastActiveAt: string | null;
  };
  recentRuns: RunEntry[];
  recentTransactions: Transaction[];
};

export type GrantCreditsInput = {
  userId: string;
  amount: number;
  description?: string;
};

export type CreateInviteInput = {
  email: string;
  name?: string;
  approvedOnAccept: boolean;
  initialCreditGrant: number;
  expiresInDays: number;
};

export type UpdateApprovalInput = {
  userId: string;
  approved: boolean;
};
