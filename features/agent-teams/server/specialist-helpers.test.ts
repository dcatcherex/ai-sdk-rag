import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentTeamMemberWithAgent } from '../types';
import {
  buildContextBlock,
  buildSpecialistPrompt,
  generateStepSummary,
  inferArtifactType,
  type StepContext,
} from './specialist-helpers';

// ── buildContextBlock ─────────────────────────────────────────────────────────

test('buildContextBlock returns empty string for empty prior steps', () => {
  assert.equal(buildContextBlock([]), '');
});

test('buildContextBlock wraps steps in team_context XML', () => {
  const steps: StepContext[] = [
    { agentName: 'Researcher', displayRole: null, summary: 'Found key data.', artifactType: 'research_brief' },
  ];
  const result = buildContextBlock(steps);
  assert.match(result, /<team_context>/);
  assert.match(result, /<\/team_context>/);
  assert.match(result, /Found key data\./);
});

test('buildContextBlock uses displayRole over agentName when set', () => {
  const steps: StepContext[] = [
    { agentName: 'Agent A', displayRole: 'Senior Researcher', summary: 'Summary.', artifactType: 'research_brief' },
  ];
  const result = buildContextBlock(steps);
  assert.match(result, /Senior Researcher/);
  assert.doesNotMatch(result, /Agent A/);
});

test('buildContextBlock includes all prior steps', () => {
  const steps: StepContext[] = [
    { agentName: 'A', displayRole: null, summary: 'First output.', artifactType: 'research_brief' },
    { agentName: 'B', displayRole: null, summary: 'Second output.', artifactType: 'ad_copy' },
  ];
  const result = buildContextBlock(steps);
  assert.match(result, /First output\./);
  assert.match(result, /Second output\./);
});

// ── buildSpecialistPrompt ─────────────────────────────────────────────────────

const makeMinimalMember = (overrides: Partial<{
  handoffInstructions: string | null;
  tags: string[];
  displayRole: string | null;
  agent: { name: string; modelId: string | null; systemPrompt: string | null; description: string | null };
}> = {}): AgentTeamMemberWithAgent => ({
  id: 'member_1',
  agentId: 'agent_1',
  teamId: 'team_1',
  role: 'specialist' as const,
  position: 0,
  displayRole: overrides.displayRole ?? null,
  handoffInstructions: overrides.handoffInstructions ?? null,
  tags: overrides.tags ?? [],
  createdAt: new Date(),
  agent: {
    id: 'agent_1',
    name: overrides.agent?.name ?? 'Writer',
    modelId: overrides.agent?.modelId ?? null,
    systemPrompt: overrides.agent?.systemPrompt ?? '',
    description: overrides.agent?.description ?? null,
    userId: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    structuredBehavior: null,
    enabledTools: [],
    documentIds: [],
    skillIds: [],
    brandId: null,
    brandMode: 'optional',
    brandAccessPolicy: 'any_accessible',
    requiresBrandForRun: false,
    fallbackBehavior: 'ask_or_continue',
    imageUrl: null,
    isPublic: false,
    starterTasks: [],
    isTemplate: false,
    templateId: null,
    isDefault: false,
    catalogScope: 'personal',
    catalogStatus: 'draft',
    managedByAdmin: false,
    cloneBehavior: 'editable_copy',
    updatePolicy: 'notify',
    lockedFields: [],
    version: 1,
    sourceTemplateVersion: null,
    publishedAt: null,
    archivedAt: null,
    changelog: null,
    mcpServers: [],
  } as unknown as AgentTeamMemberWithAgent['agent'],
});

test('buildSpecialistPrompt with empty priorSteps produces valid prompt', () => {
  const member = makeMinimalMember();
  const result = buildSpecialistPrompt({ userPrompt: 'Write a blog post.', member, priorSteps: [] });
  assert.match(result, /Write a blog post\./);
  assert.doesNotMatch(result, /<team_context>/);
});

test('buildSpecialistPrompt with priorSteps includes summaries', () => {
  const member = makeMinimalMember();
  const priorSteps: StepContext[] = [
    { agentName: 'Researcher', displayRole: null, summary: 'Key finding: X.', artifactType: 'research_brief' },
  ];
  const result = buildSpecialistPrompt({ userPrompt: 'Write a blog post.', member, priorSteps });
  assert.match(result, /Key finding: X\./);
  assert.match(result, /<team_context>/);
  assert.match(result, /Write a blog post\./);
});

test('buildSpecialistPrompt includes handoff instructions when set', () => {
  const member = makeMinimalMember({ handoffInstructions: 'Focus on tone.' });
  const result = buildSpecialistPrompt({ userPrompt: 'Write.', member, priorSteps: [] });
  assert.match(result, /Focus on tone\./);
  assert.match(result, /<handoff_instructions>/);
});

// ── generateStepSummary ───────────────────────────────────────────────────────

test('generateStepSummary returns empty string for empty input', () => {
  assert.equal(generateStepSummary(''), '');
});

test('generateStepSummary returns full text when within limit', () => {
  const short = 'Hello world.';
  assert.equal(generateStepSummary(short), short);
});

test('generateStepSummary truncates at sentence boundary for long input', () => {
  // Sentence boundary at ~70 chars so it passes the > 50 guard.
  const long = 'x'.repeat(60) + ' ends the sentence. ' + 'x'.repeat(400);
  const result = generateStepSummary(long);
  assert.ok(result.length <= 400);
  assert.match(result, /sentence\./);
});

test('generateStepSummary appends ellipsis when no sentence boundary found', () => {
  const noBreaks = 'x'.repeat(500);
  const result = generateStepSummary(noBreaks);
  assert.match(result, /…$/);
});

// ── inferArtifactType ─────────────────────────────────────────────────────────

test('inferArtifactType returns research_brief for research tags', () => {
  const member = makeMinimalMember({ tags: ['research', 'data'] });
  assert.equal(inferArtifactType(member), 'research_brief');
});

test('inferArtifactType returns ad_copy for copywriting tags', () => {
  const member = makeMinimalMember({ tags: ['copy', 'headline'] });
  assert.equal(inferArtifactType(member), 'ad_copy');
});

test('inferArtifactType returns other when no tags match', () => {
  const member = makeMinimalMember({ tags: ['xyz', 'abc'] });
  assert.equal(inferArtifactType(member), 'other');
});

test('inferArtifactType matches on agent name when tags are empty', () => {
  const member = makeMinimalMember({ tags: [], agent: { name: 'Strategy Planner', modelId: null, systemPrompt: null, description: null } });
  assert.equal(inferArtifactType(member), 'strategy');
});
