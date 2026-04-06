import type { SkillFile } from '../types';

export function calculateChangedFilePaths(localFiles: SkillFile[], remoteFiles: Array<{
  relativePath: string;
  fileKind: string;
  mediaType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
}>): string[] {
  const localByPath = new Map(localFiles.map((file) => [file.relativePath, file]));
  const remoteByPath = new Map(remoteFiles.map((file) => [file.relativePath, file]));
  const allPaths = [...new Set([...localByPath.keys(), ...remoteByPath.keys()])];

  return allPaths
    .filter((path) => {
      const local = localByPath.get(path);
      const remote = remoteByPath.get(path);
      if (!local || !remote) return true;
      if (local.fileKind !== remote.fileKind) return true;
      if (local.mediaType !== remote.mediaType) return true;
      if (local.sizeBytes !== remote.sizeBytes) return true;
      if (local.checksum && remote.checksum) {
        return local.checksum !== remote.checksum;
      }
      return false;
    })
    .sort((a, b) => a.localeCompare(b));
}
