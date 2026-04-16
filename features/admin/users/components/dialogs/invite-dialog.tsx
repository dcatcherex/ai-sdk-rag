'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { UsersMutations } from '../../hooks/use-users-mutations';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: UsersMutations;
}

export function InviteDialog({ open, onOpenChange, mutations }: InviteDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('0');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [approvedOnAccept, setApprovedOnAccept] = useState(true);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail('');
      setName('');
      setCredits('0');
      setExpiresInDays('7');
      setApprovedOnAccept(true);
    }
  }, [open]);

  // Close on success
  useEffect(() => {
    if (mutations.createInvite.isSuccess) {
      onOpenChange(false);
    }
  }, [mutations.createInvite.isSuccess, onOpenChange]);

  const handleSubmit = () => {
    mutations.createInvite.mutate({
      email,
      name: name || undefined,
      approvedOnAccept,
      initialCreditGrant: Number(credits || '0'),
      expiresInDays: Number(expiresInDays || '7'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Send an admin-managed invite that the user can accept with their existing auth method.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name (optional)</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Initial credits</label>
              <Input
                type="number"
                min={0}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Expires in days</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="7"
              />
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={approvedOnAccept}
              onCheckedChange={(v) => setApprovedOnAccept(v === true)}
            />
            Auto-approve this user when they accept the invite
          </label>
          {mutations.createInvite.isError ? (
            <p className="text-sm text-destructive">
              {mutations.createInvite.error?.message ?? 'Failed to send invite'}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutations.createInvite.isPending || !email.trim()}
          >
            {mutations.createInvite.isPending ? 'Sending...' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
