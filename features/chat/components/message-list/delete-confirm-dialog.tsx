import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PendingDelete } from './types';

type DeleteConfirmDialogProps = {
  pendingDelete: PendingDelete | null;
  onConfirm: (messageId: string, partnerMessageId?: string) => void;
  onCancel: () => void;
};

export const DeleteConfirmDialog = ({ pendingDelete, onConfirm, onCancel }: DeleteConfirmDialogProps) => (
  <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this exchange?</AlertDialogTitle>
        <AlertDialogDescription>
          {pendingDelete?.partnerMessageId
            ? 'This will permanently remove the message and its paired response.'
            : 'This will permanently remove this message.'}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="bg-red-500 hover:bg-red-600 text-white"
          onClick={() => {
            if (pendingDelete) {
              onConfirm(pendingDelete.messageId, pendingDelete.partnerMessageId);
            }
          }}
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
