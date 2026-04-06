import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreatedSkillFiles } from './package-files';
import { buildSkillMarkdown, parseSkillMarkdown } from './parser';

test('buildSkillMarkdown generates canonical SKILL.md content', () => {
  const markdown = buildSkillMarkdown({
    name: 'email-drafter',
    description: 'Drafts concise emails',
    promptFragment: 'Use this skill for customer-facing email replies.',
    enabledTools: ['web_search'],
    license: 'Apache-2.0',
    compatibility: 'Requires outbound network access',
    metadata: {
      author: 'team-ai',
      version: '1.0.0',
    },
  });

  assert.match(markdown, /^---/);
  assert.match(markdown, /name: email-drafter/);
  assert.match(markdown, /description: "Drafts concise emails"/);
  assert.match(markdown, /license: "Apache-2.0"/);
  assert.match(markdown, /compatibility: "Requires outbound network access"/);
  assert.match(markdown, /allowed-tools: web_search/);
  assert.match(markdown, /metadata:\n  author: "team-ai"\n  version: "1.0.0"/);
  assert.match(markdown, /Use this skill for customer-facing email replies\.$/);
});

test('parseSkillMarkdown reads frontmatter and body', () => {
  const parsed = parseSkillMarkdown(`---\nname: support-agent\ndescription: \"Handle support inbox triage\"\ntrigger: /triage\n---\nReview the inbox, group issues, and propose next actions.`);

  assert.deepEqual(parsed, {
    name: 'support-agent',
    description: 'Handle support inbox triage',
    triggerType: 'slash',
    trigger: '/triage',
    body: 'Review the inbox, group issues, and propose next actions.',
  });
});

test('buildCreatedSkillFiles generates SKILL.md and normalizes bundled files', () => {
  const files = buildCreatedSkillFiles({
    name: 'skill-a',
    description: 'A package skill',
    promptFragment: 'Read references/REFERENCE.md when needed.',
    files: [
      { relativePath: './references\\REFERENCE.md', textContent: 'Reference body\r\nline 2' },
      { relativePath: 'SKILL.md', textContent: 'ignored duplicate entry' },
      { relativePath: '../escape.txt', textContent: 'should be rejected' },
    ],
  });

  assert.equal(files[0]?.relativePath, 'SKILL.md');
  assert.equal(files[0]?.fileKind, 'skill');
  assert.equal(files[1]?.relativePath, 'references/REFERENCE.md');
  assert.equal(files[1]?.fileKind, 'reference');
  assert.equal(files[1]?.textContent, 'Reference body\nline 2');
  assert.equal(files.length, 2);
});
