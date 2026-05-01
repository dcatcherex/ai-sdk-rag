import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

import { TOOL_MANIFESTS } from "@/features/tools/registry/client";
import { domainProfilesManifest } from "./manifest";

test("domain profiles manifest is registered in client and server registries", async () => {
  const serverRegistrySource = await readFile(
    path.join(process.cwd(), "features/tools/registry/server.ts"),
    "utf8",
  );

  assert.equal(
    TOOL_MANIFESTS.some((manifest) => manifest.id === domainProfilesManifest.id),
    true,
  );
  assert.match(serverRegistrySource, /domainProfilesManifest/);
  assert.match(serverRegistrySource, /createDomainProfilesAgentTools/);
});

test("domain profile mutation tools require approval", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
  const { createDomainProfilesAgentTools } = await import("./agent");
  const tools = createDomainProfilesAgentTools({
    userId: "user-1",
    brandId: "brand-1",
  });

  assert.equal(tools.create_profile.needsApproval, true);
  assert.equal(tools.update_profile.needsApproval, true);
  assert.equal(tools.create_entity.needsApproval, true);
  assert.equal(tools.update_entity.needsApproval, true);
});

test("domain profile read tools do not require approval", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
  const { createDomainProfilesAgentTools } = await import("./agent");
  const tools = createDomainProfilesAgentTools({
    userId: "user-1",
  });

  assert.equal(tools.find_entities.needsApproval, undefined);
  assert.equal(tools.get_profile_context.needsApproval, undefined);
});
