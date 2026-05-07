import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { TOOL_MANIFESTS } from '@/features/tools/registry/client';
import { caseWorkspaceManifest } from './manifest';
import { caseStatusSchema } from './schema';

test('case workspace manifest is registered in client and server registries', async () => {
  const serverRegistrySource = await readFile(
    path.join(process.cwd(), 'features/tools/registry/server.ts'),
    'utf8',
  );

  assert.equal(
    TOOL_MANIFESTS.some((manifest) => manifest.id === caseWorkspaceManifest.id),
    true,
  );
  assert.match(serverRegistrySource, /caseWorkspaceManifest/);
  assert.match(serverRegistrySource, /createCaseWorkspaceAgentTools/);
});

test('case workspace write tools require approval', async () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { createCaseWorkspaceAgentTools } = await import('./agent');
  const tools = createCaseWorkspaceAgentTools({
    userId: 'user-1',
    brandId: 'brand-1',
  });

  assert.equal(tools.create_contact.needsApproval, true);
  assert.equal(tools.create_case.needsApproval, true);
  assert.equal(tools.update_case.needsApproval, true);
  assert.equal(tools.add_case_note.needsApproval, true);
  assert.equal(tools.create_case_task.needsApproval, true);
});

test('case workspace read tools do not require approval', async () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { createCaseWorkspaceAgentTools } = await import('./agent');
  const tools = createCaseWorkspaceAgentTools({
    userId: 'user-1',
  });

  assert.equal(tools.get_case_context.needsApproval, undefined);
  assert.equal(tools.search_cases.needsApproval, undefined);
  assert.equal(tools.summarize_case.needsApproval, undefined);
});

test('case status schema rejects unknown values', () => {
  assert.equal(caseStatusSchema.safeParse('waiting').success, true);
  assert.equal(caseStatusSchema.safeParse('paused').success, false);
});
