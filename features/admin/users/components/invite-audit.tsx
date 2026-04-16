'use client';

import { formatDate } from '../lib/formatters';
import type { AdminInvite } from '../types';

export function getInviteAuditSummary(invite: AdminInvite): { title: string; subtitle: string } {
  if (invite.status === 'accepted') {
    return {
      title: `Accepted ${formatDate(invite.acceptedAt)}`,
      subtitle: invite.acceptedUserEmail ?? invite.acceptedUserName ?? 'Accepted account',
    };
  }
  if (invite.status === 'cancelled') {
    return {
      title: `Cancelled ${formatDate(invite.cancelledAt)}`,
      subtitle: invite.invitedByUserEmail ?? invite.invitedByUserName ?? 'Admin action',
    };
  }
  if (invite.status === 'expired') {
    return {
      title: `Expired ${formatDate(invite.expiresAt)}`,
      subtitle: invite.lastSentAt
        ? `Last sent ${formatDate(invite.lastSentAt)}`
        : `Created ${formatDate(invite.createdAt)}`,
    };
  }
  return {
    title: `Sent ${formatDate(invite.lastSentAt || invite.createdAt)}`,
    subtitle: invite.invitedByUserEmail ?? invite.invitedByUserName ?? 'Admin action',
  };
}
