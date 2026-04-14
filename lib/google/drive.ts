import { ensureGoogleAccessToken, ensureGoogleScopes } from '@/lib/google/oauth';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function googleDriveFetch<T>(userId: string, url: string, init?: RequestInit): Promise<T> {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [DRIVE_FILE_SCOPE]);

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Google Drive API failed: ${await res.text()}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export async function listDriveFiles(
  userId: string,
  input: { folderId?: string; query?: string; limit?: number },
) {
  const params = new URLSearchParams({
    pageSize: String(input.limit ?? 20),
    fields: 'files(id,name,mimeType,webViewLink,createdTime,parents)',
  });

  const queryParts: string[] = ["trashed = false"];
  if (input.folderId) {
    queryParts.push(`'${input.folderId.replace(/'/g, "\\'")}' in parents`);
  }
  if (input.query) {
    queryParts.push(`name contains '${input.query.replace(/'/g, "\\'")}'`);
  }
  params.set('q', queryParts.join(' and '));

  return googleDriveFetch<{
    files?: Array<{
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      createdTime?: string;
      parents?: string[];
    }>;
  }>(userId, `https://www.googleapis.com/drive/v3/files?${params.toString()}`);
}

export async function createDriveFolder(
  userId: string,
  input: { name: string; parentFolderId?: string },
) {
  return googleDriveFetch<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
  }>(userId, 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: input.parentFolderId ? [input.parentFolderId] : undefined,
    }),
  });
}

export async function uploadDriveFile(
  userId: string,
  input: {
    fileName: string;
    mimeType: string;
    fileBuffer: Buffer;
    folderId?: string;
  },
) {
  const boundary = `vaja-${Date.now()}`;
  const metadata = JSON.stringify({
    name: input.fileName,
    parents: input.folderId ? [input.folderId] : undefined,
  });

  const preamble =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${input.mimeType}\r\n\r\n`;
  const ending = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(preamble, 'utf8'),
    input.fileBuffer,
    Buffer.from(ending, 'utf8'),
  ]);

  return googleDriveFetch<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    webContentLink?: string;
  }>(
    userId,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
}
