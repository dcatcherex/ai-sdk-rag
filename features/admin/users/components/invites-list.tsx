'use client';

import { RefreshCwIcon, XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '../lib/formatters';
import { InviteStatusBadge } from './status-badges';
import { getInviteAuditSummary } from './invite-audit';
import type { AdminInvite, InviteStatusFilter } from '../types';
import type { UsersMutations } from '../hooks/use-users-mutations';

interface InvitesListProps {
  invites: AdminInvite[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  statusFilter: InviteStatusFilter;
  mutations: UsersMutations;
  onStatusFilterChange: (status: InviteStatusFilter) => void;
  onPageChange: (page: number) => void;
}

const STATUS_OPTIONS: InviteStatusFilter[] = ['all', 'invited', 'accepted', 'expired', 'cancelled'];

export function InvitesList({
  invites,
  total,
  page,
  totalPages,
  isLoading,
  statusFilter,
  mutations,
  onStatusFilterChange,
  onPageChange,
}: InvitesListProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Invites</h2>
        <p className="text-sm text-muted-foreground">
          Track pending, accepted, expired, and cancelled admin invites.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange(status)}
          >
            {status === 'all' ? 'All invites' : status[0]!.toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">Invitee</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">Audit</TableHead>
              <TableHead className="font-semibold text-foreground">Credits</TableHead>
              <TableHead className="font-semibold text-foreground">Expires</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading invites...
                </TableCell>
              </TableRow>
            ) : invites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No invites found
                </TableCell>
              </TableRow>
            ) : (
              invites.map((invite) => {
                const auditSummary = getInviteAuditSummary(invite);
                return (
                  <TableRow key={invite.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{invite.name || 'Unnamed invite'}</div>
                      <div className="text-sm text-muted-foreground">{invite.email}</div>
                    </TableCell>
                    <TableCell>
                      <InviteStatusBadge status={invite.status} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{auditSummary.title}</div>
                      <div className="text-xs text-muted-foreground">{auditSummary.subtitle}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{invite.initialCreditGrant}</div>
                      <div className="text-xs text-muted-foreground">
                        {invite.approvedOnAccept ? 'Auto-approve on accept' : 'Approval remains pending'}
                        {invite.creditGrantedAt ? ` | Granted ${formatDate(invite.creditGrantedAt)}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invite.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={invite.status !== 'invited' || mutations.resendInvite.isPending}
                          onClick={() => mutations.resendInvite.mutate(invite.id)}
                        >
                          <RefreshCwIcon className="size-3.5" />
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={invite.status !== 'invited' || mutations.cancelInvite.isPending}
                          onClick={() => mutations.cancelInvite.mutate(invite.id)}
                        >
                          <XCircleIcon className="size-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} ({total} invites)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
