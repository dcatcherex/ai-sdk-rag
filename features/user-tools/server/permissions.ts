import type { userTool } from "@/db/schema";
import { isAgentExecutionSource } from "./share-resolution";

type UserToolRow = typeof userTool.$inferSelect;

export function canViewUserTool(params: {
  userId: string;
  tool: UserToolRow;
  shareRole?: string | null;
}): boolean {
  return params.tool.userId === params.userId || Boolean(params.shareRole);
}

export function canEditUserTool(params: {
  userId: string;
  tool: UserToolRow;
  shareRole?: string | null;
}): boolean {
  return params.tool.userId === params.userId || params.shareRole === "editor";
}

export function canRunUserTool(params: {
  userId: string;
  tool: UserToolRow;
  shareRole?: string | null;
  source: "manual" | "agent" | "api" | "test" | "line";
  isAttachedToAgent?: boolean;
}): boolean {
  if (!canViewUserTool(params)) return false;
  if (params.tool.status === "archived") return false;
  if (isAgentExecutionSource(params.source) && (!params.tool.supportsAgent || !params.isAttachedToAgent)) return false;
  if ((params.source === "manual" || params.source === "test") && !params.tool.supportsManualRun) return false;
  return true;
}

export function needsApprovalForUserTool(params: {
  tool: Pick<UserToolRow, "readOnly" | "requiresConfirmation">;
}): boolean {
  return !params.tool.readOnly || params.tool.requiresConfirmation;
}
