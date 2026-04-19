import JSZip from 'jszip';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agentSkill, agentSkillFile } from '@/db/schema';
import { buildSkillMarkdown } from './parser';
import type { CreateSkillInput } from '../types';

export type SkillExportResult = {
  filename: string;
  /** true = zip blob, false = plain SKILL.md text */
  isZip: boolean;
  data: Uint8Array | string;
};

export async function exportSkill(skillId: string): Promise<SkillExportResult> {
  const [row] = await db.select().from(agentSkill).where(eq(agentSkill.id, skillId)).limit(1);
  if (!row) throw new Error('Skill not found');

  const fileRows = await db.select().from(agentSkillFile).where(eq(agentSkillFile.skillId, skillId));

  const skillInput: CreateSkillInput = {
    name: row.name,
    description: row.description ?? '',
    triggerType: row.triggerType as CreateSkillInput['triggerType'],
    trigger: row.trigger ?? '',
    promptFragment: row.promptFragment,
    enabledTools: row.enabledTools,
    activationMode: row.activationMode as CreateSkillInput['activationMode'],
  };

  const skillMd = buildSkillMarkdown(skillInput);
  const safeName = row.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

  // Text files from bundled files, excluding the SKILL.md entry itself
  const bundledFiles = fileRows.filter(
    (f) => f.relativePath !== row.entryFilePath && f.textContent !== null,
  );

  if (bundledFiles.length === 0) {
    return {
      filename: `${safeName}.skill.md`,
      isZip: false,
      data: skillMd,
    };
  }

  const zip = new JSZip();
  const folder = zip.folder(safeName)!;
  folder.file('SKILL.md', skillMd);

  for (const file of bundledFiles) {
    if (file.textContent) {
      folder.file(file.relativePath, file.textContent);
    }
  }

  const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  return {
    filename: `${safeName}.zip`,
    isZip: true,
    data: blob,
  };
}
