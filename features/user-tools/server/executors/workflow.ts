import { z } from "zod";

import type { ToolExecutionResult } from "@/features/tools/registry/types";
import {
  createCalendarEntry,
  createCampaignBrief,
} from "@/features/content-calendar/service";
import { createPost } from "@/features/content-marketing/service";
import type {
  CalendarChannel,
  CalendarEntryContentType,
  CalendarEntryStatus,
  CampaignStatus,
} from "@/features/content-calendar/types";
import type {
  PlatformOverrides,
  PostMedia,
  SocialPlatform,
} from "@/features/content-marketing/types";
import type {
  UserToolDefinition,
  UserToolWorkflowStep,
  UserToolWorkflowConfig,
} from "../../types";
import { recordUserToolArtifacts } from "../history";

const campaignBriefStepSchema = z.object({
  brandId: z.string().min(1).nullable().optional(),
  title: z.string().min(1),
  goal: z.string().nullable().optional(),
  offer: z.string().nullable().optional(),
  keyMessage: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  channels: z.array(z.string()).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

const calendarEntryStepSchema = z.object({
  brandId: z.string().min(1).nullable().optional(),
  campaignId: z.string().min(1).nullable().optional(),
  contentPieceId: z.string().min(1).nullable().optional(),
  title: z.string().min(1),
  contentType: z.enum(["blog_post", "newsletter", "social", "email", "ad_copy", "other"]),
  channel: z.enum(["instagram", "facebook", "linkedin", "email", "blog", "other"]).nullable().optional(),
  status: z.enum(["idea", "briefed", "drafting", "review", "approved", "scheduled", "published", "repurposed"]).optional(),
  plannedDate: z.string().min(1),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

const socialPostStepSchema = z.object({
  caption: z.string().min(1),
  platforms: z.array(z.enum(["instagram", "facebook", "tiktok"])).min(1),
  platformOverrides: z.record(z.enum(["instagram", "facebook", "tiktok"]), z.object({
    caption: z.string().optional(),
  })).optional(),
  media: z.array(z.object({
    r2Key: z.string(),
    url: z.string().url(),
    mimeType: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    sizeBytes: z.number().optional(),
  })).optional(),
  scheduledAt: z.string().datetime().optional(),
  brandId: z.string().min(1).optional(),
  campaignId: z.string().min(1).optional(),
});

type WorkflowContext = {
  input: Record<string, unknown>;
  steps: Record<string, unknown>;
};

type PersistableArtifact = {
  kind: string;
  format: string;
  storageUrl?: string | null;
  payloadJson?: Record<string, unknown> | null;
};

export function buildWorkflowStepId(step: UserToolWorkflowStep, index: number) {
  return step.id?.trim() || `step_${index + 1}`;
}

function getValueAtPath(source: unknown, path: string): unknown {
  if (!path) {
    return source;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, source);
}

function resolveExpression(expression: string, context: WorkflowContext) {
  const trimmed = expression.trim();
  if (!trimmed.startsWith("input.") && !trimmed.startsWith("steps.")) {
    return undefined;
  }

  const [root, ...rest] = trimmed.split(".");
  const rootValue = root === "input" ? context.input : context.steps;
  return getValueAtPath(rootValue, rest.join("."));
}

export function resolveWorkflowTemplateValue(value: unknown, context: WorkflowContext): unknown {
  if (typeof value === "string") {
    const wholeMatch = value.match(/^\{\{\s*(.+?)\s*\}\}$/);
    if (wholeMatch) {
      return resolveExpression(wholeMatch[1] ?? "", context);
    }

    return value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expression: string) => {
      const resolved = resolveExpression(expression, context);
      if (resolved === null || resolved === undefined) {
        return "";
      }
      return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveWorkflowTemplateValue(item, context));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, resolveWorkflowTemplateValue(nested, context)]),
    );
  }

  return value;
}

function toArtifactUrl(kind: UserToolWorkflowStep["kind"], recordId: string) {
  switch (kind) {
    case "create_campaign_brief":
      return `/content-calendar?campaignId=${encodeURIComponent(recordId)}`;
    case "create_calendar_entry":
      return `/content-calendar?entryId=${encodeURIComponent(recordId)}`;
    case "create_social_post":
      return `/content`;
  }
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function createArtifactForStep(params: {
  step: UserToolWorkflowStep;
  stepId: string;
  record: Record<string, unknown>;
}) {
  const recordId = params.record.id;
  if (typeof recordId !== "string" || recordId.length === 0) {
    return null;
  }

  const label = params.step.artifactLabel
    ?? params.stepId.replace(/_/g, " ");
  const url = toArtifactUrl(params.step.kind, recordId);
  return {
    uiArtifact: {
      type: "link" as const,
      label,
      url,
    },
    persistedArtifact: {
      kind: params.step.kind,
      format: "json",
      storageUrl: url,
      payloadJson: params.record,
    } satisfies PersistableArtifact,
  };
}

async function executeWorkflowStep(params: {
  step: UserToolWorkflowStep;
  resolvedInput: Record<string, unknown>;
  userId: string;
}) {
  switch (params.step.kind) {
    case "create_campaign_brief": {
      const parsed = campaignBriefStepSchema.parse(params.resolvedInput);
      return createCampaignBrief(params.userId, {
        brandId: parsed.brandId ?? undefined,
        title: parsed.title,
        goal: parsed.goal ?? undefined,
        offer: parsed.offer ?? undefined,
        keyMessage: parsed.keyMessage ?? undefined,
        cta: parsed.cta ?? undefined,
        channels: parsed.channels,
        startDate: parsed.startDate ?? undefined,
        endDate: parsed.endDate ?? undefined,
        status: parsed.status as CampaignStatus | undefined,
      });
    }
    case "create_calendar_entry": {
      const parsed = calendarEntryStepSchema.parse(params.resolvedInput);
      return createCalendarEntry(params.userId, {
        brandId: parsed.brandId ?? undefined,
        campaignId: parsed.campaignId ?? undefined,
        contentPieceId: parsed.contentPieceId ?? undefined,
        title: parsed.title,
        contentType: parsed.contentType as CalendarEntryContentType,
        channel: parsed.channel as CalendarChannel | undefined,
        status: parsed.status as CalendarEntryStatus | undefined,
        plannedDate: parsed.plannedDate,
        notes: parsed.notes ?? undefined,
        color: parsed.color ?? undefined,
      });
    }
    case "create_social_post": {
      const parsed = socialPostStepSchema.parse(params.resolvedInput);
      return createPost({
        userId: params.userId,
        caption: parsed.caption,
        platforms: parsed.platforms as SocialPlatform[],
        platformOverrides: parsed.platformOverrides as PlatformOverrides | undefined,
        media: parsed.media as PostMedia[] | undefined,
        scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : undefined,
        brandId: parsed.brandId,
        campaignId: parsed.campaignId,
      });
    }
  }
}

export async function executeWorkflowUserTool(params: {
  tool: UserToolDefinition;
  workflow: UserToolWorkflowConfig;
  input: Record<string, unknown>;
  runId: string;
  userId: string;
}): Promise<ToolExecutionResult> {
  const context: WorkflowContext = {
    input: params.input,
    steps: {},
  };
  const stepResults: Array<{
    id: string;
    kind: UserToolWorkflowStep["kind"];
    record: Record<string, unknown>;
  }> = [];
  const persistedArtifacts: PersistableArtifact[] = [];
  const uiArtifacts: NonNullable<ToolExecutionResult["artifacts"]> = [];

  for (const [index, step] of params.workflow.steps.entries()) {
    const stepId = buildWorkflowStepId(step, index);
    const resolvedInput = resolveWorkflowTemplateValue(step.input, context);
    if (!resolvedInput || typeof resolvedInput !== "object" || Array.isArray(resolvedInput)) {
      throw new Error(`Workflow step "${stepId}" must resolve to an object input.`);
    }

    const record = toPlainRecord(
      await executeWorkflowStep({
        step,
        resolvedInput: resolvedInput as Record<string, unknown>,
        userId: params.userId,
      }),
    );

    context.steps[stepId] = record;
    stepResults.push({
      id: stepId,
      kind: step.kind,
      record,
    });

    if (step.persistArtifact !== false) {
      const artifact = createArtifactForStep({ step, stepId, record });
      if (artifact) {
        uiArtifacts.push(artifact.uiArtifact);
        persistedArtifacts.push(artifact.persistedArtifact);
      }
    }
  }

  if (persistedArtifacts.length > 0) {
    await recordUserToolArtifacts({
      runId: params.runId,
      artifacts: persistedArtifacts,
    });
  }

  return {
    tool: `user-tool/${params.tool.slug}`,
    runId: params.runId,
    title: params.tool.name,
    summary: `Workflow completed ${stepResults.length} step${stepResults.length === 1 ? "" : "s"}.`,
    data: {
      steps: stepResults,
      createdCount: stepResults.length,
    },
    artifacts: uiArtifacts,
    createdAt: new Date().toISOString(),
  };
}
