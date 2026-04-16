'use client';

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
import { useState, useEffect } from 'react';
import type { UsersMutations } from '../../hooks/use-users-mutations';

interface GrantCreditsDialogProps {
  target: { id: string; name: string; email: string; balance: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: UsersMutations;
}

export function GrantCreditsDialog({
  target,
  open,
  onOpenChange,
  mutations,
}: GrantCreditsDialogProps) {
  const [amount, setAmount] = useState('100');
  const [description, setDescription] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setAmount('100');
      setDescription('');
    }
  }, [open]);

  // Close dialog on success
  useEffect(() => {
    if (mutations.grantCredits.isSuccess) {
      onOpenChange(false);
    }
  }, [mutations.grantCredits.isSuccess, onOpenChange]);

  const handleGrant = () => {
    if (!target) return;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;
    mutations.grantCredits.mutate({
      userId: target.id,
      amount: numAmount,
      description: description || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Credits</DialogTitle>
          <DialogDescription>
            Grant credits to <strong>{target?.name}</strong> ({target?.email}). Current balance:{' '}
            <strong>{target?.balance}</strong> credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount</label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly top-up"
            />
          </div>
          {mutations.grantCredits.isError ? (
            <p className="text-sm text-destructive">
              {mutations.grantCredits.error?.message ?? 'Something went wrong'}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGrant}
            disabled={mutations.grantCredits.isPending || !Number(amount)}
          >
            {mutations.grantCredits.isPending ? 'Granting...' : `Grant ${amount || 0} credits`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
