import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function readSource(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

test('case workspace routes validate payloads with zod before mutating', async () => {
  const contactsRoute = await readSource('app/api/case-workspace/contacts/route.ts');
  const casesRoute = await readSource('app/api/case-workspace/cases/route.ts');
  const caseRoute = await readSource('app/api/case-workspace/cases/[caseId]/route.ts');
  const tasksRoute = await readSource('app/api/case-workspace/cases/[caseId]/tasks/route.ts');
  const notesRoute = await readSource('app/api/case-workspace/cases/[caseId]/notes/route.ts');
  const profilesRoute = await readSource('app/api/case-workspace/profiles/route.ts');
  const assignmentRoute = await readSource('app/api/case-workspace/cases/[caseId]/assignment/route.ts');
  const exportRoute = await readSource('app/api/case-workspace/profiles/[profileId]/export/route.ts');
  const dashboardRoute = await readSource('app/api/case-workspace/profiles/[profileId]/dashboard/route.ts');

  assert.match(contactsRoute, /createContactInputSchema\.safeParse\(body\)/);
  assert.match(contactsRoute, /profileId is required/);
  assert.match(casesRoute, /searchCasesInputSchema\.safeParse\(body\)/);
  assert.match(casesRoute, /createCaseInputSchema\.safeParse\(body\)/);
  assert.match(caseRoute, /updateCaseInputSchema\.safeParse\(body\)/);
  assert.match(tasksRoute, /createTaskInputSchema\.safeParse\(body\)/);
  assert.match(tasksRoute, /updateTaskInputSchema\.safeParse\(body\?\.patch \?\? body\)/);
  assert.match(tasksRoute, /taskId is required/);
  assert.match(notesRoute, /createTimelineNoteInputSchema\.safeParse\(body\)/);
  assert.match(profilesRoute, /createWorkspaceProfileInputSchema\.safeParse\(body\)/);
  assert.match(assignmentRoute, /assignCaseInputSchema\.safeParse\(body\)/);
  assert.match(exportRoute, /exportCaseWorkspaceInputSchema\.safeParse\(\{/);
  assert.match(dashboardRoute, /getCaseWorkspaceDashboard\(profileId, \{ userId: auth\.user\.id \}\)/);
  assert.match(contactsRoute, /status: 400/);
  assert.match(casesRoute, /status: 400/);
  assert.match(caseRoute, /status: 400/);
  assert.match(tasksRoute, /status: 400/);
  assert.match(notesRoute, /status: 400/);
  assert.match(profilesRoute, /status: 400/);
  assert.match(assignmentRoute, /status: 400/);
  assert.match(exportRoute, /status: 400/);
});

test('case workspace hooks invalidate the expected query keys after mutations', async () => {
  const source = await readSource('features/case-workspace/hooks/use-case-workspace.ts');

  assert.match(source, /invalidateQueries\(\{ queryKey: caseWorkspaceKeys\.profiles \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: caseWorkspaceKeys\.contacts\(input\.profileId\) \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: caseWorkspaceKeys\.caseContext\(caseId\) \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: caseWorkspaceKeys\.tasks\(caseId\) \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: caseWorkspaceKeys\.timeline\(caseId\) \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: caseWorkspaceKeys\.dashboard\(input\.profileId\) \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: \['case-workspace', 'dashboard'\] \}\)/);
  assert.match(source, /invalidateQueries\(\{ queryKey: \['case-workspace', 'cases'\] \}\)/);
});
