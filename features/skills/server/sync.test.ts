import assert from 'node:assert/strict';
import test from 'node:test';
import type { SkillFile } from '../types';
import { calculateChangedFilePaths } from './sync-shared';

const file = (overrides: Partial<SkillFile>): SkillFile => ({
  id: 'file-1',
  skillId: 'skill-1',
  relativePath: 'SKILL.md',
  fileKind: 'skill',
  mediaType: 'text/markdown',
  textContent: null,
  sizeBytes: 12,
  checksum: 'abc',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

test('calculateChangedFilePaths reports added, removed, and modified files', () => {
  const changed = calculateChangedFilePaths(
    [
      file({ relativePath: 'SKILL.md', checksum: 'same' }),
      file({ relativePath: 'references/old.md', fileKind: 'reference', checksum: 'old' }),
      file({ relativePath: 'assets/logo.svg', fileKind: 'asset', checksum: null, sizeBytes: 80, mediaType: 'image/svg+xml' }),
    ],
    [
      { relativePath: 'SKILL.md', fileKind: 'skill', mediaType: 'text/markdown', sizeBytes: 12, checksum: 'same' },
      { relativePath: 'references/new.md', fileKind: 'reference', mediaType: 'text/markdown', sizeBytes: 20, checksum: 'new' },
      { relativePath: 'assets/logo.svg', fileKind: 'asset', mediaType: 'image/svg+xml', sizeBytes: 96, checksum: null },
    ],
  );

  assert.deepEqual(changed, ['assets/logo.svg', 'references/new.md', 'references/old.md']);
});

test('calculateChangedFilePaths ignores identical snapshots', () => {
  const changed = calculateChangedFilePaths(
    [file({ relativePath: 'SKILL.md', checksum: 'same' })],
    [{ relativePath: 'SKILL.md', fileKind: 'skill', mediaType: 'text/markdown', sizeBytes: 12, checksum: 'same' }],
  );

  assert.deepEqual(changed, []);
});
