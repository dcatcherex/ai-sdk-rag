import assert from "node:assert/strict";
import test from "node:test";

import { canRunUserTool } from "./permissions";
import {
  isAgentExecutionSource,
  resolveEffectiveUserToolShareRole,
} from "./share-resolution";

test("resolveEffectiveUserToolShareRole prefers editor over runner", () => {
  assert.equal(resolveEffectiveUserToolShareRole("runner", "editor"), "editor");
  assert.equal(resolveEffectiveUserToolShareRole("runner", null, "runner"), "runner");
  assert.equal(resolveEffectiveUserToolShareRole(undefined, null), null);
});

test("isAgentExecutionSource treats line runs like agent runs", () => {
  assert.equal(isAgentExecutionSource("agent"), true);
  assert.equal(isAgentExecutionSource("line"), true);
  assert.equal(isAgentExecutionSource("manual"), false);
});

test("canRunUserTool requires supportsAgent for line execution", () => {
  const baseTool: Parameters<typeof canRunUserTool>[0]["tool"] = {
    id: "tool-1",
    userId: "owner-1",
    name: "Tool",
    slug: "tool",
    description: null,
    icon: "Wrench",
    category: "utilities",
    executionType: "webhook",
    visibility: "private",
    status: "active",
    readOnly: true,
    requiresConfirmation: false,
    supportsAgent: false,
    supportsManualRun: true,
    latestVersion: 1,
    activeVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert.equal(
    canRunUserTool({
      userId: "owner-1",
      tool: baseTool,
      source: "line",
      isAttachedToAgent: true,
    }),
    false,
  );

  assert.equal(
    canRunUserTool({
      userId: "owner-1",
      tool: { ...baseTool, supportsAgent: true },
      source: "line",
      isAttachedToAgent: true,
    }),
    true,
  );
});
