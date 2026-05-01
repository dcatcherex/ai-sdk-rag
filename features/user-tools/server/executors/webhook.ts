import type { ToolExecutionResult } from "@/features/tools/registry/types";
import type { UserToolDefinition, UserToolField, UserToolWebhookConfig } from "../../types";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const BLOCKED_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "host",
  "proxy-authorization",
  "set-cookie",
]);

function resolveTemplateValue(value: unknown, input: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*input\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const resolved = input[key];
      return typeof resolved === "string" || typeof resolved === "number" || typeof resolved === "boolean"
        ? String(resolved)
        : "";
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, input));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, resolveTemplateValue(nested, input)]),
    );
  }

  return value;
}

function getValueAtPath(payload: unknown, path?: string): unknown {
  if (!path) return payload;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, payload);
}

function assertSafeWebhookUrl(urlString: string) {
  const url = new URL(urlString);
  const host = url.hostname.toLowerCase();
  const blockedHosts = new Set(["localhost", "0.0.0.0", "::1"]);
  if (url.protocol !== "https:") throw new Error("Only HTTPS webhook URLs are allowed.");
  if (url.username || url.password) throw new Error("Webhook URLs cannot include credentials.");
  if (blockedHosts.has(host) || host.endsWith(".local") || isPrivateIpLiteral(host)) {
    throw new Error("Local or private webhook destinations are not allowed.");
  }
  return url;
}

function isPrivateIpLiteral(host: string) {
  const normalized = host.replace(/^\[|\]$/g, "");
  const parts = normalized.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  return (
    normalized === "::1" ||
    normalized.toLowerCase().startsWith("fc") ||
    normalized.toLowerCase().startsWith("fd") ||
    normalized.toLowerCase().startsWith("fe80:")
  );
}

function buildHeaders(template?: Record<string, string>) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  for (const [name, value] of Object.entries(template ?? {})) {
    const normalized = name.toLowerCase();
    if (BLOCKED_HEADER_NAMES.has(normalized)) {
      throw new Error(`Webhook header "${name}" is not allowed in Phase 1.`);
    }
    if (!normalized.startsWith("x-") && normalized !== "accept") {
      throw new Error(`Webhook header "${name}" is not allowed in Phase 1.`);
    }
    headers[name] = value;
  }

  return headers;
}

async function readLimitedResponse(response: Response) {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("Webhook response is too large.");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("Webhook response is too large.");
  }

  const text = new TextDecoder().decode(buffer);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { text };
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Webhook returned invalid JSON.");
  }
}

function buildRequestBody(
  config: UserToolWebhookConfig,
  fields: UserToolField[],
  input: Record<string, unknown>,
) {
  if (config.requestTemplate) {
    return resolveTemplateValue(config.requestTemplate, input);
  }

  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (input[field.key] !== undefined) payload[field.key] = input[field.key];
  }
  return payload;
}

export async function executeWebhookUserTool(params: {
  tool: UserToolDefinition;
  versionId: string;
  versionNumber: number;
  inputFields: UserToolField[];
  webhook: UserToolWebhookConfig;
  input: Record<string, unknown>;
  runId: string;
}): Promise<ToolExecutionResult> {
  const url = assertSafeWebhookUrl(params.webhook.url);
  const timeoutMs = Math.min(params.webhook.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = buildRequestBody(params.webhook, params.inputFields, params.input);
    const response = await fetch(url, {
      method: params.webhook.method,
      headers: buildHeaders(params.webhook.headersTemplate),
      body: params.webhook.method === "GET" ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: controller.signal,
    });

    const rawPayload = await readLimitedResponse(response);

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}.`);
    }

    const data = getValueAtPath(rawPayload, params.webhook.responseDataPath);
    return {
      tool: `user-tool/${params.tool.slug}`,
      runId: params.runId,
      title: params.tool.name,
      summary: "Tool executed successfully.",
      data,
      createdAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
