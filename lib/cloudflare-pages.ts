import { env } from '@/lib/env';

const CF_API = 'https://api.cloudflare.com/client/v4';

function getHeaders(): HeadersInit {
  if (!env.CLOUDFLARE_PAGES_API_TOKEN) {
    throw new Error('CLOUDFLARE_PAGES_API_TOKEN is not configured');
  }
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_PAGES_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function getAccountId(): string {
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is not configured');
  }
  return env.CLOUDFLARE_ACCOUNT_ID;
}

export async function createPagesProject(
  projectName: string,
): Promise<{ id: string; subdomain: string }> {
  const accountId = getAccountId();
  const res = await fetch(`${CF_API}/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create Pages project: ${res.status} ${text}`);
  }

  const json = await res.json() as { result: { id: string; subdomain: string } };
  return { id: json.result.id, subdomain: json.result.subdomain };
}

export async function deployToPagesProject(
  projectName: string,
  htmlContent: string,
): Promise<{ deploymentId: string; url: string }> {
  const accountId = getAccountId();

  // Step 1: Create a direct upload deployment
  const deployRes = await fetch(
    `${CF_API}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_PAGES_API_TOKEN}`,
      },
      body: (() => {
        const form = new FormData();
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        form.append('/_headers', new Blob(['/*\n  Cache-Control: no-cache\n'], { type: 'text/plain' }), '_headers');
        form.append('/index.html', blob, 'index.html');
        return form;
      })(),
    },
  );

  if (!deployRes.ok) {
    const text = await deployRes.text();
    throw new Error(`Failed to deploy to Pages: ${deployRes.status} ${text}`);
  }

  const json = await deployRes.json() as { result: { id: string; url: string } };
  const subdomain = env.CLOUDFLARE_SITE_SUBDOMAIN ?? 'pages.dev';
  const url = json.result.url ?? `https://${projectName}.${subdomain}`;

  return { deploymentId: json.result.id, url };
}

export async function getPagesProjectUrl(projectName: string): Promise<string | null> {
  const accountId = getAccountId();
  const subdomain = env.CLOUDFLARE_SITE_SUBDOMAIN ?? 'pages.dev';

  try {
    const res = await fetch(
      `${CF_API}/accounts/${accountId}/pages/projects/${projectName}`,
      { headers: getHeaders() },
    );
    if (!res.ok) return null;
    return `https://${projectName}.${subdomain}`;
  } catch {
    return null;
  }
}

export async function deletePagesProject(projectName: string): Promise<void> {
  const accountId = getAccountId();
  await fetch(
    `${CF_API}/accounts/${accountId}/pages/projects/${projectName}`,
    { method: 'DELETE', headers: getHeaders() },
  );
}
