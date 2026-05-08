import { nanoid } from 'nanoid';

import { providerHealthSchema, providerManifestSchema, providerResponseEnvelopeSchema } from './schema';
import type { ProviderManifest, ProviderRequestEnvelope, ProviderResponseEnvelope } from './types';
import { ProviderAuthError, ProviderSchemaError, ProviderTimeoutError, ProviderUnavailableError } from './errors';

const DEFAULT_TIMEOUT_MS = 30_000;

type ClientOptions = {
  baseUrl: string;
  providerKey: string;
  apiSecret?: string;
  timeoutMs?: number;
};

export class ProviderClient {
  private readonly baseUrl: string;
  private readonly providerKey: string;
  private readonly apiSecret: string | undefined;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.providerKey = opts.providerKey;
    this.apiSecret = opts.apiSecret;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetchManifest(): Promise<ProviderManifest> {
    const res = await this.request('GET', '/.well-known/vaja-tool-provider.json');
    const parsed = providerManifestSchema.safeParse(await res.json());
    if (!parsed.success) throw new ProviderSchemaError(parsed.error.message);
    return parsed.data;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.request('GET', '/health');
      const body = await res.json();
      const parsed = providerHealthSchema.safeParse(body);
      return parsed.success && parsed.data.status !== 'down';
    } catch {
      return false;
    }
  }

  async runSync(
    toolSlug: string,
    envelope: ProviderRequestEnvelope,
  ): Promise<ProviderResponseEnvelope> {
    const res = await this.request('POST', `/v1/tools/${toolSlug}/run`, envelope);
    return this.parseResponse(res);
  }

  async startAsync(
    toolSlug: string,
    envelope: ProviderRequestEnvelope,
  ): Promise<ProviderResponseEnvelope> {
    const res = await this.request('POST', `/v1/tools/${toolSlug}/runs`, envelope);
    return this.parseResponse(res);
  }

  async getRunStatus(providerRunId: string): Promise<ProviderResponseEnvelope> {
    const res = await this.request('GET', `/v1/runs/${providerRunId}`);
    return this.parseResponse(res);
  }

  async cancelRun(providerRunId: string): Promise<void> {
    await this.request('POST', `/v1/runs/${providerRunId}/cancel`);
  }

  buildEnvelope(
    opts: Omit<ProviderRequestEnvelope, 'requestId'> & { requestId?: string },
  ): ProviderRequestEnvelope {
    return { requestId: nanoid(), ...opts };
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Vaja-Provider': this.providerKey,
    };

    if (this.apiSecret) {
      headers['Authorization'] = `Bearer ${this.apiSecret}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ProviderTimeoutError(this.providerKey, this.timeoutMs);
      }
      throw new ProviderUnavailableError(this.providerKey);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) throw new ProviderAuthError();
    if (!res.ok) {
      const isRetryable = res.status >= 500 || res.status === 429;
      throw Object.assign(new Error(`Provider HTTP ${res.status}`), {
        code: `HTTP_${res.status}`,
        retryable: isRetryable,
      });
    }

    return res;
  }

  private async parseResponse(res: Response): Promise<ProviderResponseEnvelope> {
    const body = await res.json();
    const parsed = providerResponseEnvelopeSchema.safeParse(body);
    if (!parsed.success) throw new ProviderSchemaError(parsed.error.message);
    return parsed.data;
  }
}

export function createProviderClient(
  providerKey: string,
  baseUrl: string,
  timeoutMs?: number,
): ProviderClient {
  const secretEnvKey = `PROVIDER_SECRET_${providerKey.toUpperCase().replace(/-/g, '_')}`;
  const apiSecret = process.env[secretEnvKey];

  return new ProviderClient({ baseUrl, providerKey, apiSecret, timeoutMs });
}
