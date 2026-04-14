import { ensureGoogleAccessToken, ensureGoogleScopes } from '@/lib/google/oauth';

const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';

type DocRequest = Record<string, unknown>;

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; rows: string[][] };

function normalizeMarkdown(markdown: string) {
  return markdown.replace(/\r\n/g, '\n').trim();
}

function isTableLine(line: string) {
  return line.includes('|');
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function markdownToBlocks(markdown: string): MarkdownBlock[] {
  const lines = normalizeMarkdown(markdown).split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1]!.length as 1 | 2 | 3,
        text: headingMatch[2]!.trim(),
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = (lines[index] ?? '').trim();
        const match = itemLine.match(/^[-*]\s+(.*)$/);
        if (!match) break;
        items.push(match[1]!.trim());
        index += 1;
      }
      if (items.length > 0) {
        blocks.push({ type: 'bullets', items });
        continue;
      }
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = (lines[index] ?? '').trim();
        const match = itemLine.match(/^\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(match[1]!.trim());
        index += 1;
      }
      if (items.length > 0) {
        blocks.push({ type: 'numbered', items });
        continue;
      }
    }

    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (index < lines.length) {
        const tableLine = (lines[index] ?? '').trim();
        if (!tableLine || !isTableLine(tableLine)) break;
        tableLines.push(tableLine);
        index += 1;
      }

      const rows = tableLines
        .filter((tableLine) => !isTableSeparator(tableLine))
        .map(parseTableRow)
        .filter((row) => row.length > 0);

      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
        continue;
      }
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index] ?? '';
      const trimmed = candidate.trim();
      if (!trimmed) break;
      if (/^(#{1,3})\s+/.test(trimmed)) break;
      if (/^[-*]\s+/.test(trimmed)) break;
      if (/^\d+\.\s+/.test(trimmed)) break;
      if (isTableLine(trimmed)) break;
      paragraphLines.push(trimmed);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paragraphLines.join(' '),
      });
      continue;
    }

    index += 1;
  }

  return blocks;
}

function buildInsertTextRequest(index: number, text: string): DocRequest {
  return {
    insertText: {
      location: { index },
      text,
    },
  };
}

function buildHeadingRequests(
  index: number,
  text: string,
  level: 1 | 2 | 3,
) {
  const content = `${text}\n`;
  return {
    requests: [
      buildInsertTextRequest(index, content),
      {
        updateParagraphStyle: {
          range: {
            startIndex: index,
            endIndex: index + content.length,
          },
          paragraphStyle: {
            namedStyleType:
              level === 1 ? 'HEADING_1' : level === 2 ? 'HEADING_2' : 'HEADING_3',
          },
          fields: 'namedStyleType',
        },
      },
    ] satisfies DocRequest[],
    nextIndex: index + content.length,
  };
}

function buildParagraphRequests(index: number, text: string) {
  const content = `${text}\n`;
  return {
    requests: [buildInsertTextRequest(index, content)] satisfies DocRequest[],
    nextIndex: index + content.length,
  };
}

function buildListRequests(
  index: number,
  items: string[],
  preset: 'BULLET_DISC_CIRCLE_SQUARE' | 'NUMBERED_DECIMAL_ALPHA_ROMAN',
) {
  const content = `${items.join('\n')}\n`;
  return {
    requests: [
      buildInsertTextRequest(index, content),
      {
        createParagraphBullets: {
          range: {
            startIndex: index,
            endIndex: index + content.length,
          },
          bulletPreset: preset,
        },
      },
    ] satisfies DocRequest[],
    nextIndex: index + content.length,
  };
}

function buildTableRequests(index: number, rows: string[][]) {
  const widths = rows.reduce<number[]>((acc, row) => {
    row.forEach((cell, cellIndex) => {
      const current = acc[cellIndex] ?? 0;
      acc[cellIndex] = Math.max(current, cell.length);
    });
    return acc;
  }, []);

  const tableText = rows
    .map((row) =>
      row
        .map((cell, cellIndex) => cell.padEnd(widths[cellIndex] ?? cell.length, ' '))
        .join(' | '),
    )
    .join('\n');

  return buildParagraphRequests(index, tableText);
}

function buildMarkdownRequests(markdown: string, startIndex = 1) {
  const blocks = markdownToBlocks(markdown);
  const requests: DocRequest[] = [];
  let index = startIndex;

  for (const block of blocks) {
    let built:
      | ReturnType<typeof buildHeadingRequests>
      | ReturnType<typeof buildParagraphRequests>
      | ReturnType<typeof buildListRequests>;

    if (block.type === 'heading') {
      built = buildHeadingRequests(index, block.text, block.level);
    } else if (block.type === 'paragraph') {
      built = buildParagraphRequests(index, block.text);
    } else if (block.type === 'bullets') {
      built = buildListRequests(index, block.items, 'BULLET_DISC_CIRCLE_SQUARE');
    } else if (block.type === 'numbered') {
      built = buildListRequests(index, block.items, 'NUMBERED_DECIMAL_ALPHA_ROMAN');
    } else {
      built = buildTableRequests(index, block.rows);
    }

    requests.push(...built.requests);
    index = built.nextIndex;

    requests.push(buildInsertTextRequest(index, '\n'));
    index += 1;
  }

  return requests;
}

async function googleDocsFetch<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [DOCS_SCOPE]);

  const res = await fetch(`https://docs.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Google Docs API failed: ${await res.text()}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

async function createDriveBackedGoogleDoc(
  userId: string,
  input: { title: string; folderId?: string },
) {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [DOCS_SCOPE, DRIVE_FILE_SCOPE]);

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.title,
        mimeType: GOOGLE_DOC_MIME_TYPE,
        parents: input.folderId ? [input.folderId] : undefined,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Doc creation failed: ${await res.text()}`);
  }

  return (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    parents?: string[];
  };
}

async function copyGoogleDocTemplate(
  userId: string,
  input: { templateDocumentId: string; title: string; folderId?: string },
) {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [DOCS_SCOPE, DRIVE_FILE_SCOPE]);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.templateDocumentId)}/copy?fields=id,name,mimeType,webViewLink,parents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.title,
        parents: input.folderId ? [input.folderId] : undefined,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Doc template copy failed: ${await res.text()}`);
  }

  return (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    parents?: string[];
  };
}

export async function batchUpdateGoogleDoc(
  userId: string,
  documentId: string,
  requests: DocRequest[],
) {
  if (requests.length === 0) {
    return { documentId };
  }

  return googleDocsFetch<{ documentId: string }>(
    userId,
    `documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    },
  );
}

export async function getGoogleDoc(
  userId: string,
  documentId: string,
) {
  return googleDocsFetch<{
    documentId: string;
    title: string;
    body?: {
      content?: Array<{
        endIndex?: number;
      }>;
    };
  }>(userId, `documents/${encodeURIComponent(documentId)}`);
}

export async function createGoogleDoc(
  userId: string,
  input: { title: string; contentMarkdown: string; folderId?: string },
) {
  const created = await createDriveBackedGoogleDoc(userId, input);
  const requests = buildMarkdownRequests(input.contentMarkdown);
  await batchUpdateGoogleDoc(userId, created.id, requests);

  return {
    documentId: created.id,
    title: created.name,
    mimeType: created.mimeType,
    webViewLink: created.webViewLink ?? null,
    folderId: created.parents?.[0] ?? input.folderId ?? null,
  };
}

export async function createGoogleDocFromTemplate(
  userId: string,
  input: {
    templateDocumentId: string;
    title: string;
    replacements: Record<string, string>;
    folderId?: string;
  },
) {
  const copied = await copyGoogleDocTemplate(userId, input);
  const requests = Object.entries(input.replacements).map(([key, value]) => ({
    replaceAllText: {
      containsText: {
        text: `{{${key}}}`,
        matchCase: true,
      },
      replaceText: value,
    },
  })) satisfies DocRequest[];

  await batchUpdateGoogleDoc(userId, copied.id, requests);

  return {
    documentId: copied.id,
    title: copied.name,
    mimeType: copied.mimeType,
    webViewLink: copied.webViewLink ?? null,
    folderId: copied.parents?.[0] ?? input.folderId ?? null,
    replacementCount: requests.length,
  };
}

export async function appendGoogleDocSection(
  userId: string,
  input: { documentId: string; heading?: string; contentMarkdown: string },
) {
  const document = await getGoogleDoc(userId, input.documentId);
  const endIndex =
    document.body?.content?.[document.body.content.length - 1]?.endIndex ?? 1;

  const content = input.heading
    ? `## ${input.heading}\n\n${input.contentMarkdown}`
    : input.contentMarkdown;

  const requests = buildMarkdownRequests(content, Math.max(1, endIndex - 1));
  await batchUpdateGoogleDoc(userId, input.documentId, requests);

  return {
    documentId: input.documentId,
    title: document.title,
    appended: true,
    heading: input.heading ?? null,
  };
}
