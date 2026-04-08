import "server-only";

import { runs, tasks } from "@trigger.dev/sdk";
import { env } from "@/lib/env";
import type { SocialPostRecord } from "./types";
import type { publishScheduledSocialPostTask } from "@/trigger/content-marketing";

const PUBLISH_SCHEDULED_SOCIAL_POST_TASK_ID = "publish-scheduled-social-post";

function assertTriggerConfigured() {
  if (!env.TRIGGER_SECRET_KEY) {
    throw new Error("TRIGGER_SECRET_KEY is required to schedule social posts with Trigger.dev");
  }
}

export async function createScheduledPostRun(post: SocialPostRecord): Promise<string> {
  if (!post.scheduledAt) {
    throw new Error("Cannot schedule a post without scheduledAt");
  }

  assertTriggerConfigured();

  const handle = await tasks.trigger<typeof publishScheduledSocialPostTask>(
    PUBLISH_SCHEDULED_SOCIAL_POST_TASK_ID,
    {
      postId: post.id,
      userId: post.userId,
      scheduledAt: post.scheduledAt.toISOString(),
    },
  );

  return handle.id;
}

export async function cancelScheduledPostRun(runId: string | null | undefined): Promise<void> {
  if (!runId) {
    return;
  }

  assertTriggerConfigured();

  try {
    await runs.cancel(runId);
  } catch (error) {
    console.warn("[content-marketing] Failed to cancel scheduled run", runId, error);
  }
}
