import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPackageManifest, guessSkillFileMediaType, inferSkillFileKind, normalizeReferencedPath } from './package-manifest';

test('normalizeReferencedPath normalizes safe package paths', () => {
  assert.equal(normalizeReferencedPath('./references\\guide.md'), 'references/guide.md');
  assert.equal(normalizeReferencedPath('assets/image.png'), 'assets/image.png');
});

test('normalizeReferencedPath rejects traversal and blocked roots', () => {
  assert.equal(normalizeReferencedPath('../secret.txt'), null);
  assert.equal(normalizeReferencedPath('references/../secret.txt'), null);
  assert.equal(normalizeReferencedPath('.git/config'), null);
  assert.equal(normalizeReferencedPath('node_modules/pkg/index.js'), null);
  assert.equal(normalizeReferencedPath('/absolute/path.txt'), null);
});

test('inferSkillFileKind classifies standard package paths', () => {
  assert.equal(inferSkillFileKind('SKILL.md'), 'skill');
  assert.equal(inferSkillFileKind('references/guide.md'), 'reference');
  assert.equal(inferSkillFileKind('assets/logo.png'), 'asset');
  assert.equal(inferSkillFileKind('scripts/setup.sh'), 'script');
  assert.equal(inferSkillFileKind('LICENSE.txt'), 'other');
});

test('guessSkillFileMediaType infers common media types', () => {
  assert.equal(guessSkillFileMediaType('references/guide.md'), 'text/markdown');
  assert.equal(guessSkillFileMediaType('assets/logo.svg'), 'image/svg+xml');
  assert.equal(guessSkillFileMediaType('scripts/setup.sh'), 'application/x-sh');
  assert.equal(guessSkillFileMediaType('unknown.bin'), null);
});

test('buildPackageManifest returns the documented manifest shape', () => {
  const manifest = buildPackageManifest([
    { relativePath: 'SKILL.md', fileKind: 'skill' },
    { relativePath: 'references/guide.md', fileKind: 'reference' },
    { relativePath: 'assets/logo.svg', fileKind: 'asset' },
    { relativePath: 'scripts/setup.sh', fileKind: 'script' },
    { relativePath: 'LICENSE.txt', fileKind: 'other' },
  ], {
    repo: 'owner/repo',
    repoRef: 'main',
    subdirPath: '.agents/skills/my-skill',
  });

  assert.deepEqual(manifest, {
    importedFileCount: 5,
    counts: {
      references: 1,
      assets: 1,
      scripts: 1,
      other: 1,
    },
    preservedAdditionalPaths: ['LICENSE.txt'],
    repo: 'owner/repo',
    repoRef: 'main',
    subdirPath: '.agents/skills/my-skill',
  });
});
