import { tool as aiTool, type ToolSet } from "ai";
import { z } from "zod";

import type { ToolExecutionResult } from "@/features/tools/registry/types";
import type {
  UserToolDefinition,
  UserToolExecutionConfig,
  UserToolField,
  UserToolSource,
  UserToolVersionDefinition,
} from "../types";
import { executeWebhookUserTool } from "./executors/webhook";
import { executeWorkflowUserTool } from "./executors/workflow";
import {
  recordUserToolRunError,
  recordUserToolRunStart,
  recordUserToolRunSuccess,
} from "./history";
import { canRunUserTool, needsApprovalForUserTool } from "./permissions";
import {
  getRunnableUserToolsForAgent,
  getUserToolActiveVersion,
  getUserToolById,
} from "./queries";

function buildFieldSchema(field: UserToolField) {
  let schema: z.ZodType<unknown>;
  switch (field.type) {
    case "long_text":
    case "text":
      schema = z.string();
      break;
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "enum":
      schema = z.string().refine((value) => (field.options ?? []).includes(value), {
        message: "Invalid option",
      });
      break;
    case "date":
      schema = z.string();
      break;
    case "json":
      schema = z.unknown();
      break;
  }

  if (!field.required) {
    schema = schema.optional();
  }
  return schema;
}

export function buildUserToolInputSchema(fields: UserToolField[]) {
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const field of fields) {
    shape[field.key] = buildFieldSchema(field);
  }
  return z.object(shape);
}

function buildUserToolAgentName(toolDef: UserToolDefinition) {
  const suffix = toolDef.id.slice(-6).replace(/[^a-zA-Z0-9]/g, "");
  const normalizedSlug = toolDef.slug.replace(/[^a-z0-9]+/g, "_");
  return `user_tool_${normalizedSlug}_${suffix}`;
}

function buildUserToolDescription(toolDef: UserToolDefinition, fields: UserToolField[]) {
  const fieldSummary = fields.length > 0
    ? `Inputs: ${fields.map((field) => `${field.label} (${field.key})`).join(", ")}.`
    : "This tool accepts structured JSON input.";
  return `${toolDef.description ?? toolDef.name} ${fieldSummary}`.trim();
}

async function executeUserToolVersion(params: {
  toolDef: UserToolDefinition;
  version: UserToolVersionDefinition;
  input: Record<string, unknown>;
  userId: string;
  source: UserToolSource;
  threadId?: string | null;
}): Promise<ToolExecutionResult> {
  const runId = await recordUserToolRunStart({
    toolSlug: `user-tool/${params.toolDef.slug}`,
    userId: params.userId,
    threadId: params.threadId,
    source: params.source,
    inputJson: params.input,
  });

  try {
    const config = params.version.configJson as UserToolExecutionConfig;
    let result: ToolExecutionResult;
    if (config.type === "webhook") {
      result = await executeWebhookUserTool({
        tool: params.toolDef,
        versionId: params.version.id,
        versionNumber: params.version.version,
        inputFields: params.version.inputSchemaJson,
        webhook: config.webhook,
        input: params.input,
        runId,
      });
    } else {
      result = await executeWorkflowUserTool({
        tool: params.toolDef,
        workflow: config.workflow,
        input: params.input,
        runId,
        userId: params.userId,
      });
    }

    await recordUserToolRunSuccess({
      runId,
      outputJson: {
        tool: result.tool,
        title: result.title,
        summary: result.summary ?? null,
        data: result.data as Record<string, unknown> | null,
        artifacts: result.artifacts ?? [],
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tool execution error";
    await recordUserToolRunError({ runId, errorMessage: message });
    throw error;
  }
}

export async function executeUserToolById(params: {
  toolId: string;
  userId: string;
  source: UserToolSource;
  input: Record<string, unknown>;
  confirmed?: boolean;
  threadId?: string | null;
  agentId?: string | null;
}) {
  const row = await getUserToolById(params.toolId, params.userId);
  if (!row) throw new Error("Tool not found");

  const toolDef = row.tool as UserToolDefinition;
  const canRun = canRunUserTool({
    userId: params.userId,
    tool: toolDef,
    shareRole: row.shareRole,
    source: params.source,
    isAttachedToAgent: Boolean(params.agentId),
  });
  if (!canRun) throw new Error("Tool cannot be run in this context.");
  if ((params.source === "manual" || params.source === "test") && needsApprovalForUserTool({ tool: toolDef }) && !params.confirmed) {
    throw new Error("Confirmation is required before running this tool.");
  }

  const versionRow = await getUserToolActiveVersion(params.toolId, toolDef.activeVersion);
  if (!versionRow) throw new Error("Tool does not have an active version.");

  const parsedInput = buildUserToolInputSchema(versionRow.inputSchemaJson as UserToolField[]).parse(params.input);
  return executeUserToolVersion({
    toolDef,
    version: versionRow as UserToolVersionDefinition,
    input: parsedInput,
    userId: params.userId,
    source: params.source,
    threadId: params.threadId,
  });
}

export async function buildUserCreatedToolSet(params: {
  userId: string;
  agentId?: string | null;
  source: "manual" | "agent" | "line";
  threadId?: string;
}): Promise<ToolSet> {
  if (!params.agentId) return {};

  const eligible = await getRunnableUserToolsForAgent(params.agentId, params.userId);
  if (eligible.length === 0) return {};

  const versionRows = await Promise.all(
    eligible.map(({ tool }) => getUserToolActiveVersion(tool.id, tool.activeVersion)),
  );

  const result: ToolSet = {};
  eligible.forEach(({ tool: toolRow, shareRole }, index) => {
    const version = versionRows[index];
    if (!version) return;
    if (!canRunUserTool({
      userId: params.userId,
      tool: toolRow,
      shareRole,
      source: params.source,
      isAttachedToAgent: true,
    })) {
      return;
    }

    const fields = version.inputSchemaJson as UserToolField[];
    const toolDef = toolRow as UserToolDefinition;
    const toolName = buildUserToolAgentName(toolDef);
    result[toolName] = aiTool({
      description: buildUserToolDescription(toolDef, fields),
      inputSchema: buildUserToolInputSchema(fields),
      needsApproval: needsApprovalForUserTool({ tool: toolRow }),
      async execute(input) {
        const executed = await executeUserToolVersion({
          toolDef,
          version: version as UserToolVersionDefinition,
          input,
          userId: params.userId,
          source: params.source,
          threadId: params.threadId ?? null,
        });
        return executed;
      },
    });
  });

  return result;
}
