'use client';

import { useEffect, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { UsersMutations } from '../../hooks/use-users-mutations';

interface DeleteUserDialogProps {
  target: { id: string; name: string; email: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: UsersMutations;
}

export function DeleteUserDialog({
  target,
  open,
  onOpenChange,
  mutations,
}: DeleteUserDialogProps) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  useEffect(() => {
    if (mutations.deleteUser.isSuccess) onOpenChange(false);
  }, [mutations.deleteUser.isSuccess, onOpenChange]);

  const handleDelete = () => {
    if (!target || !confirmed) return;
    mutations.deleteUser.mutate(target.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlertIcon className="size-4" />
            Delete user
          </DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{target?.name}</strong> ({target?.email}) and all
            their data — sessions, credits, chat history, and more. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-destructive"
          />
          <span className="text-sm">
            I understand this is permanent and cannot be undone.
          </span>
        </label>

        {mutations.deleteUser.isError ? (
          <p className="text-sm text-destructive">
            {mutations.deleteUser.error?.message ?? 'Something went wrong'}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || mutations.deleteUser.isPending}
            onClick={handleDelete}
          >
            {mutations.deleteUser.isPending ? 'Deleting...' : 'Delete user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
