import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAgentUserToolAttachments,
  validateAttachableUserTools,
} from "./attachment-validation";

test("normalizeAgentUserToolAttachments removes duplicate tool ids", () => {
  const normalized = normalizeAgentUserToolAttachments([
    { userToolId: "tool-1", priority: 0 },
    { userToolId: "tool-2", priority: 1 },
    { userToolId: "tool-1", priority: 2 },
  ]);

  assert.deepEqual(normalized, [
    { userToolId: "tool-1", priority: 0 },
    { userToolId: "tool-2", priority: 1 },
  ]);
});

test("validateAttachableUserTools rejects missing tool ids", () => {
  assert.throws(
    () =>
      validateAttachableUserTools(
        [{ userToolId: "tool-1" }, { userToolId: "tool-2" }],
        [{ id: "tool-1", supportsAgent: true, status: "active" }],
      ),
    /unavailable/i,
  );
});

test("validateAttachableUserTools rejects archived or non-agent tools", () => {
  assert.throws(
    () =>
      validateAttachableUserTools(
        [{ userToolId: "tool-1" }],
        [{ id: "tool-1", supportsAgent: false, status: "active" }],
      ),
    /agent-enabled/i,
  );

  assert.throws(
    () =>
      validateAttachableUserTools(
        [{ userToolId: "tool-2" }],
        [{ id: "tool-2", supportsAgent: true, status: "archived" }],
      ),
    /agent-enabled/i,
  );
});
