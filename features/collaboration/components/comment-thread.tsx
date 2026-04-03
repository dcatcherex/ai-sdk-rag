'use client';

import { useState } from 'react';
import { CheckCircleIcon, Trash2Icon, CornerDownRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  useContentComments,
  useAddComment,
  useResolveComment,
  useDeleteComment,
} from '../hooks/use-collaboration';
import type { ContentComment } from '../types';

type Props = {
  contentPieceId: string;
  currentUserId: string;
};

function formatTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AvatarInitials({ name }: { name?: string }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';
  return (
    <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
}: {
  comment: ContentComment;
  currentUserId: string;
  onReply: (parentId: string) => void;
}) {
  const resolveMutation = useResolveComment();
  const deleteMutation = useDeleteComment();

  return (
    <div className={`flex gap-2.5 ${comment.parentId ? 'ml-8 mt-1' : ''}`}>
      {comment.parentId && (
        <CornerDownRightIcon className="size-3.5 text-muted-foreground shrink-0 mt-1.5" />
      )}
      <AvatarInitials name={comment.userName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{comment.userName ?? 'Unknown'}</span>
          <span className="text-[10px] text-muted-foreground">{formatTime(comment.createdAt)}</span>
          {comment.resolved && (
            <span className="text-[10px] text-emerald-600 font-medium">resolved</span>
          )}
        </div>
        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{comment.body}</p>
        <div className="flex items-center gap-2 mt-1">
          {!comment.parentId && !comment.resolved && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onReply(comment.id)}
            >
              Reply
            </button>
          )}
          {!comment.resolved && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-emerald-600 transition-colors flex items-center gap-0.5"
              onClick={() => resolveMutation.mutate(comment.id)}
              disabled={resolveMutation.isPending}
            >
              <CheckCircleIcon className="size-3" />
              Resolve
            </button>
          )}
          {comment.userId === currentUserId && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5"
              onClick={() => deleteMutation.mutate(comment.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2Icon className="size-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentThread({ contentPieceId, currentUserId }: Props) {
  const { data: comments = [], isLoading } = useContentComments(contentPieceId);
  const addMutation = useAddComment(contentPieceId);

  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
  };

  const handleSubmit = () => {
    if (!body.trim()) return;
    addMutation.mutate(
      { body: body.trim(), parentId: replyTo },
      {
        onSuccess: () => {
          setBody('');
          setReplyTo(null);
        },
      },
    );
  };

  // Build threaded view: top-level first, then group replies under parents
  const topLevel = (comments as ContentComment[]).filter((c) => !c.parentId);
  const repliesByParent = (comments as ContentComment[]).reduce(
    (acc, c) => {
      if (c.parentId) {
        acc[c.parentId] = acc[c.parentId] ?? [];
        acc[c.parentId].push(c);
      }
      return acc;
    },
    {} as Record<string, ContentComment[]>,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        Comments
        {(comments as ContentComment[]).length > 0 && (
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
            ({(comments as ContentComment[]).length})
          </span>
        )}
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                onReply={handleReply}
              />
              {(repliesByParent[comment.id] ?? []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onReply={handleReply}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* New comment / reply */}
      <div className="space-y-2 pt-1">
        {replyTo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CornerDownRightIcon className="size-3" />
            <span>Replying to comment</span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setReplyTo(null)}
            >
              Cancel
            </button>
          </div>
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
          rows={3}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={addMutation.isPending || !body.trim()}
          >
            {addMutation.isPending ? 'Posting…' : replyTo ? 'Post Reply' : 'Post Comment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
