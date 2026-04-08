import { task, wait } from "@trigger.dev/sdk";
import { getPost, publishPost } from "@/features/content-marketing/service";

export const publishScheduledSocialPostTask = task({
  id: "publish-scheduled-social-post",
  run: async (
    payload: { postId: string; userId: string; scheduledAt: string },
    { ctx },
  ) => {
    await wait.until({ date: new Date(payload.scheduledAt) });

    const post = await getPost(payload.postId, payload.userId);
    if (!post) {
      return { ok: false, skipped: true, reason: "post-not-found" as const };
    }

    if (post.status !== "scheduled" || !post.scheduledAt) {
      return { ok: false, skipped: true, reason: "post-no-longer-scheduled" as const };
    }

    if (post.scheduledRunId !== ctx.run.id) {
      return { ok: false, skipped: true, reason: "superseded-by-newer-run" as const };
    }

    const results = await publishPost({
      postId: payload.postId,
      userId: payload.userId,
      triggerRunId: ctx.run.id,
    });

    return { ok: true, skipped: false, results };
  },
});
