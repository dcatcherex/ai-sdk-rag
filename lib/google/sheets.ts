import { ensureGoogleAccessToken, ensureGoogleScopes } from '@/lib/google/oauth';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function googleSheetsFetch<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [SHEETS_SCOPE]);

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets API failed: ${await res.text()}`);
  }

  return (await res.json()) as T;
}

export async function readSheetRange(
  userId: string,
  spreadsheetId: string,
  range: string,
) {
  return googleSheetsFetch<{
    range: string;
    majorDimension?: string;
    values?: string[][];
  }>(userId, `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
}

export async function appendSheetValues(
  userId: string,
  spreadsheetId: string,
  range: string,
  values: Array<Array<string | number | boolean | null>>,
) {
  return googleSheetsFetch<{
    updates?: {
      updatedRange?: string;
      updatedRows?: number;
      updatedColumns?: number;
      updatedCells?: number;
    };
  }>(
    userId,
    `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  );
}

export async function updateSheetValues(
  userId: string,
  spreadsheetId: string,
  range: string,
  values: Array<Array<string | number | boolean | null>>,
) {
  return googleSheetsFetch<{
    updatedRange?: string;
    updatedRows?: number;
    updatedColumns?: number;
    updatedCells?: number;
  }>(
    userId,
    `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  );
}

export async function createSheetTab(
  userId: string,
  spreadsheetId: string,
  title: string,
) {
  return googleSheetsFetch<{
    replies?: Array<{
      addSheet?: {
        properties?: { sheetId?: number; title?: string };
      };
    }>;
  }>(
    userId,
    `${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title },
            },
          },
        ],
      }),
    },
  );
}

export async function createSpreadsheet(
  userId: string,
  input: { title: string; folderId?: string; headers?: string[] },
) {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [SHEETS_SCOPE, DRIVE_FILE_SCOPE]);

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.title,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: input.folderId ? [input.folderId] : undefined,
      }),
    },
  );

  if (!createRes.ok) {
    throw new Error(`Google spreadsheet creation failed: ${await createRes.text()}`);
  }

  const created = (await createRes.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    parents?: string[];
  };

  if (input.headers && input.headers.length > 0) {
    await updateSheetValues(userId, created.id, 'Sheet1!1:1', [input.headers]);
  }

  return {
    spreadsheetId: created.id,
    title: created.name,
    mimeType: created.mimeType,
    webViewLink: created.webViewLink ?? null,
    folderId: created.parents?.[0] ?? input.folderId ?? null,
    headers: input.headers ?? [],
  };
}
