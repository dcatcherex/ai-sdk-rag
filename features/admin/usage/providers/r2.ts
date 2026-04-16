import { usageLimitConfig } from '@/features/admin/usage/config';
import { buildThresholdAlerts, createMetric, createUnavailableSnapshot, withProviderStatus } from '@/features/admin/usage/normalizers';
import type { UsageProviderSnapshot } from '@/features/admin/usage/types';

type R2StorageGroup = {
  max?: {
    objectCount?: number;
    payloadSize?: number;
    metadataSize?: number;
  };
};

type R2OperationsGroup = {
  sum?: {
    requests?: number;
  };
  dimensions?: {
    actionType?: string;
  };
};

type CloudflareGraphqlResponse<T> = {
  data?: {
    viewer?: {
      accounts?: Array<T>;
    };
  };
  errors?: Array<{ message?: string }>;
};

type R2StorageAccount = {
  r2StorageAdaptiveGroups?: R2StorageGroup[];
};

type R2OperationsAccount = {
  r2OperationsAdaptiveGroups?: R2OperationsGroup[];
};

const STORAGE_QUERY = `
query R2Storage($accountTag: string!, $startDate: Time, $endDate: Time, $bucketName: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(
        limit: 10000
        filter: {
          datetime_geq: $startDate
          datetime_leq: $endDate
          bucketName: $bucketName
        }
        orderBy: [datetime_DESC]
      ) {
        max {
          objectCount
          payloadSize
          metadataSize
        }
      }
    }
  }
}`;

const OPERATIONS_QUERY = `
query R2Volume($accountTag: string!, $startDate: Time, $endDate: Time, $bucketName: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2OperationsAdaptiveGroups(
        limit: 10000
        filter: {
          datetime_geq: $startDate
          datetime_leq: $endDate
          bucketName: $bucketName
        }
      ) {
        sum {
          requests
        }
        dimensions {
          actionType
        }
      }
    }
  }
}`;

export async function getR2UsageSnapshot(windowDays: number): Promise<UsageProviderSnapshot> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const collectedAt = new Date().toISOString();

  if (!apiToken || !accountId || !bucketName) {
    return createUnavailableSnapshot({
      provider: 'r2',
      label: 'Cloudflare R2',
      note: 'Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, or R2_BUCKET_NAME for live R2 monitoring.',
      collectedAt,
    });
  }

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - Math.max(1, windowDays - 1) * 86400000).toISOString();

  try {
    const [storage, operations] = await Promise.all([
      queryCloudflare<R2StorageAccount>(apiToken, {
        query: STORAGE_QUERY,
        variables: { accountTag: accountId, startDate, endDate, bucketName },
      }),
      queryCloudflare<R2OperationsAccount>(apiToken, {
        query: OPERATIONS_QUERY,
        variables: { accountTag: accountId, startDate, endDate, bucketName },
      }),
    ]);

    const storageGroups = storage.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups ?? [];
    const operationGroups = operations.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups ?? [];

    const storageBytes = storageGroups.reduce(
      (max, group) => Math.max(max, Number(group.max?.payloadSize ?? 0) + Number(group.max?.metadataSize ?? 0)),
      0,
    );

    const objectCount = storageGroups.reduce(
      (max, group) => Math.max(max, Number(group.max?.objectCount ?? 0)),
      0,
    );

    let classARequests = 0;
    let classBRequests = 0;

    for (const group of operationGroups) {
      const actionType = (group.dimensions?.actionType ?? '').toLowerCase();
      const requests = Number(group.sum?.requests ?? 0);

      if (actionType.includes('put') || actionType.includes('create') || actionType.includes('delete') || actionType.includes('list')) {
        classARequests += requests;
      } else {
        classBRequests += requests;
      }
    }

    const metrics = [
      createMetric({
        key: 'storage-bytes',
        label: 'Bucket storage used',
        value: storageBytes,
        unit: 'bytes',
        limit: usageLimitConfig.r2StorageBytes,
        status: 'live',
        updatedAt: collectedAt,
        note: 'Derived from Cloudflare R2 storage analytics.',
      }),
      createMetric({
        key: 'object-count',
        label: 'Object count',
        value: objectCount,
        unit: 'count',
        status: 'live',
        updatedAt: collectedAt,
        note: 'Derived from Cloudflare R2 storage analytics.',
      }),
      createMetric({
        key: 'class-a-requests',
        label: `Estimated Class A requests (${windowDays}d)`,
        value: classARequests,
        unit: 'requests',
        limit: usageLimitConfig.r2ClassARequests,
        status: 'partial',
        updatedAt: collectedAt,
        note: 'Estimated from operation action types returned by R2 analytics.',
      }),
      createMetric({
        key: 'class-b-requests',
        label: `Estimated Class B requests (${windowDays}d)`,
        value: classBRequests,
        unit: 'requests',
        limit: usageLimitConfig.r2ClassBRequests,
        status: 'partial',
        updatedAt: collectedAt,
        note: 'Estimated from operation action types returned by R2 analytics.',
      }),
    ];

    return withProviderStatus({
      provider: 'r2',
      label: 'Cloudflare R2',
      collectedAt,
      metrics,
      alerts: buildThresholdAlerts('r2', 'Cloudflare R2', metrics),
      rawAvailable: storageGroups.length > 0 || operationGroups.length > 0,
      fallbackStatus: 'partial',
    });
  } catch (error) {
    return createUnavailableSnapshot({
      provider: 'r2',
      label: 'Cloudflare R2',
      note: error instanceof Error ? error.message : 'Unknown Cloudflare R2 monitoring error.',
      collectedAt,
    });
  }
}

async function queryCloudflare<T>(
  apiToken: string,
  body: { query: string; variables: Record<string, string> },
): Promise<CloudflareGraphqlResponse<T>> {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Cloudflare GraphQL request failed with status ${res.status}.`);
  }

  const data = (await res.json()) as CloudflareGraphqlResponse<T>;
  if (data.errors?.length) {
    throw new Error(data.errors.map((error) => error.message ?? 'Unknown Cloudflare error').join('; '));
  }

  return data;
}
