import type { AgentUserToolAttachmentInput } from "../types";

type AttachableUserToolSummary = {
  id: string;
  supportsAgent: boolean;
  status: string;
};

export function normalizeAgentUserToolAttachments(
  attachments: AgentUserToolAttachmentInput[],
): AgentUserToolAttachmentInput[] {
  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    if (seen.has(attachment.userToolId)) return false;
    seen.add(attachment.userToolId);
    return true;
  });
}

export function validateAttachableUserTools(
  attachments: AgentUserToolAttachmentInput[],
  tools: AttachableUserToolSummary[],
) {
  if (attachments.length === 0) {
    return;
  }

  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  const missingToolIds = attachments
    .map((attachment) => attachment.userToolId)
    .filter((toolId) => !toolById.has(toolId));
  if (missingToolIds.length > 0) {
    throw new Error("One or more selected custom tools are unavailable.");
  }

  const invalidTool = attachments
    .map((attachment) => toolById.get(attachment.userToolId))
    .find((tool) => tool && (!tool.supportsAgent || tool.status === "archived"));
  if (invalidTool) {
    throw new Error("Only active, agent-enabled custom tools can be attached to an agent.");
  }
}
