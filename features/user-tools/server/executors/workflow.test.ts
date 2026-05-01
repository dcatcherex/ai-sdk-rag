import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkflowStepId,
  resolveWorkflowTemplateValue,
} from "./workflow";

test("resolveWorkflowTemplateValue preserves object values for full-template expressions", () => {
  const resolved = resolveWorkflowTemplateValue(
    {
      campaignId: "{{steps.campaign.id}}",
      channels: "{{steps.campaign.channels}}",
      nested: {
        goal: "{{input.goal}}",
      },
    },
    {
      input: {
        goal: "Drive enrollments",
      },
      steps: {
        campaign: {
          id: "camp_123",
          channels: ["instagram", "facebook"],
        },
      },
    },
  );

  assert.deepEqual(resolved, {
    campaignId: "camp_123",
    channels: ["instagram", "facebook"],
    nested: {
      goal: "Drive enrollments",
    },
  });
});

test("buildWorkflowStepId falls back to ordered ids", () => {
  assert.equal(
    buildWorkflowStepId(
      {
        kind: "create_calendar_entry",
        input: {},
      },
      1,
    ),
    "step_2",
  );
});
