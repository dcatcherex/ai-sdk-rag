import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildActiveSkillsBlock,
  buildAvailableSkillsCatalog,
  resolveActivatedSkills,
} from './activation';
import { getResolvedSkillResourcesForPrompt } from './resources';
import type { Skill, SkillFile } from '../types';

const baseSkill = (overrides: Partial<Skill>): Skill => ({
  id: 'skill-1',
  userId: 'user-1',
  name: 'email-writer',
  description: 'Write polished customer emails',
  triggerType: 'keyword',
  trigger: 'email',
  promptFragment: 'Write a clear and concise email.',
  enabledTools: [],
  sourceUrl: null,
  sourceId: null,
  skillKind: 'inline',
  activationMode: 'rule',
  entryFilePath: 'SKILL.md',
  installedRef: null,
  installedCommitSha: null,
  upstreamCommitSha: null,
  syncStatus: 'local',
  pinnedToInstalledVersion: false,
  hasBundledFiles: false,
  packageManifest: null,
  lastSyncCheckedAt: null,
  lastSyncedAt: null,
  imageUrl: null,
  isPublic: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const baseFile = (overrides: Partial<SkillFile>): SkillFile => ({
  id: 'file-1',
  skillId: 'skill-1',
  relativePath: 'SKILL.md',
  fileKind: 'skill',
  mediaType: 'text/markdown',
  textContent: 'content',
  sizeBytes: 10,
  checksum: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

test('buildAvailableSkillsCatalog lists only model-discoverable attached skills', () => {
  const catalog = buildAvailableSkillsCatalog([
    baseSkill({
      id: 'rule-skill',
      name: 'rule-skill',
      activationMode: 'rule',
    }),
    baseSkill({
      id: 'package-skill',
      name: 'package-skill',
      skillKind: 'package',
      activationMode: 'model',
      entryFilePath: '.agents/SKILL.md',
      description: 'Handle invoices & receipts',
    }),
  ]);

  assert.match(catalog, /package-skill/);
  assert.match(catalog, /<entry_file>\.agents\/SKILL\.md<\/entry_file>/);
  assert.doesNotMatch(catalog, /rule-skill/);
});

test('resolveActivatedSkills uses full package entry file content on activation', () => {
  const skill = baseSkill({
    id: 'package-skill',
    name: 'package-skill',
    skillKind: 'package',
    activationMode: 'model',
    promptFragment: 'Fallback body',
  });

  const activated = resolveActivatedSkills(
    [skill],
    'Please help draft an email reply',
    {
      'package-skill': [
        baseFile({
          skillId: 'package-skill',
          textContent: '---\nname: package-skill\ndescription: Email workflow\n---\nRead references/checklist.md before writing.',
        }),
      ],
    },
  );

  assert.equal(activated.length, 1);
  assert.equal(activated[0]?.activationSource, 'model');
  assert.match(activated[0]?.instructionContent ?? '', /references\/checklist\.md/);

  const block = buildActiveSkillsBlock(activated);
  assert.match(block, /Instruction file: SKILL\.md/);
  assert.match(block, /name: package-skill/);
});

test('getResolvedSkillResourcesForPrompt prefers explicitly referenced non-script files', () => {
  const skill = baseSkill({
    id: 'package-skill',
    name: 'package-skill',
    skillKind: 'package',
    activationMode: 'model',
  });

  const activated = resolveActivatedSkills(
    [skill],
    'Need help writing an email',
    {
      'package-skill': [
        baseFile({
          skillId: 'package-skill',
          textContent: '---\nname: package-skill\ndescription: Email workflow\n---\nRead references/checklist.md and scripts/send.ts.',
        }),
        baseFile({
          id: 'ref-1',
          skillId: 'package-skill',
          relativePath: 'references/checklist.md',
          fileKind: 'reference',
          textContent: 'Checklist content',
        }),
        baseFile({
          id: 'script-1',
          skillId: 'package-skill',
          relativePath: 'scripts/send.ts',
          fileKind: 'script',
          textContent: 'console.log("send");',
        }),
      ],
    },
  );

  const resources = getResolvedSkillResourcesForPrompt(activated, 'Need help writing an email', {
    'package-skill': [
      baseFile({
        skillId: 'package-skill',
        textContent: '---\nname: package-skill\ndescription: Email workflow\n---\nRead references/checklist.md and scripts/send.ts.',
      }),
      baseFile({
        id: 'ref-1',
        skillId: 'package-skill',
        relativePath: 'references/checklist.md',
        fileKind: 'reference',
        textContent: 'Checklist content',
      }),
      baseFile({
        id: 'script-1',
        skillId: 'package-skill',
        relativePath: 'scripts/send.ts',
        fileKind: 'script',
        textContent: 'console.log("send");',
      }),
    ],
  });

  assert.match(resources, /references\/checklist\.md/);
  assert.match(resources, /Checklist content/);
  assert.doesNotMatch(resources, /scripts\/send\.ts/);
});
