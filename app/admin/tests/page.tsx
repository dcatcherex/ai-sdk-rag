'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon, PlayIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  FunctionalTestCaseSummary,
  FunctionalTestRunResult,
} from '@/features/testing/registry';

type TestsResponse = {
  tests: FunctionalTestCaseSummary[];
};

type RunResponse = {
  run: FunctionalTestRunResult;
};

type RunErrorResponse = {
  error?: string;
  run?: FunctionalTestRunResult;
};

export default function AdminTestsPage() {
  const [resultsById, setResultsById] = useState<Record<string, FunctionalTestRunResult>>({});
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<TestsResponse>({
    queryKey: ['admin', 'tests'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tests');
      const payload = await parseJsonResponse<TestsResponse>(res);
      if (!res.ok || !payload) {
        throw new Error(getResponseErrorMessage(payload, 'Failed to fetch tests'));
      }
      return payload;
    },
  });

  const runMutation = useMutation<RunResponse, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await fetch('/api/admin/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const payload = await parseJsonResponse<RunResponse | RunErrorResponse>(res);
      if (!res.ok && (!payload || !payload.run)) {
        throw new Error(getResponseErrorMessage(payload, 'Failed to run test'));
      }

      if (!payload?.run) {
        throw new Error('Test runner returned no result');
      }

      return payload as RunResponse;
    },
    onMutate: ({ id }) => {
      setActiveTestId(id);
    },
    onSettled: () => {
      setActiveTestId(null);
    },
    onSuccess: ({ run }) => {
      setResultsById((prev) => ({ ...prev, [run.id]: run }));
    },
  });

  const tests = data?.tests ?? [];
  const totalPassed = useMemo(
    () => Object.values(resultsById).filter((result) => result.status === 'passed').length,
    [resultsById],
  );
  const totalFailed = useMemo(
    () => Object.values(resultsById).filter((result) => result.status === 'failed').length,
    [resultsById],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Functional Tests</h1>
          <p className="text-sm text-muted-foreground">
            Run browser-based smoke tests from the admin panel and review the output immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{tests.length} cases</Badge>
          <Badge variant="secondary">{totalPassed} passed</Badge>
          <Badge variant={totalFailed > 0 ? 'destructive' : 'outline'}>
            {totalFailed} failed
          </Badge>
          <Button variant="outline" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            Each case is a Playwright spec registered in the app. Clicking Run executes that single case
            against the current app URL and returns the result here.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading tests...</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            Failed to load tests: {error.message}
          </CardContent>
        </Card>
      ) : null}

      {runMutation.error ? (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">
            Failed to run test: {runMutation.error.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {tests.map((testCase) => {
          const result = resultsById[testCase.id];
          const isRunning = activeTestId === testCase.id && runMutation.isPending;

          return (
            <Card key={testCase.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{testCase.title}</CardTitle>
                    {testCase.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                    {result ? (
                      <Badge variant={result.status === 'passed' ? 'secondary' : 'destructive'}>
                        {result.status}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription>{testCase.description}</CardDescription>
                </div>

                <Button
                  onClick={() => runMutation.mutate({ id: testCase.id })}
                  disabled={runMutation.isPending}
                  className="sm:min-w-28"
                >
                  {isRunning ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      Running
                    </>
                  ) : (
                    <>
                      <PlayIcon className="mr-2 size-4" />
                      Run
                    </>
                  )}
                </Button>
              </CardHeader>

              {result ? (
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Ran at {new Date(result.ranAt).toLocaleString()}</span>
                    <span>Duration {formatDuration(result.durationMs)}</span>
                    <span>Base URL {result.baseUrl}</span>
                  </div>

                  {result.errors.length ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                        <AlertCircleIcon className="size-4" />
                        Failure details
                      </div>
                      <div className="space-y-2 text-sm text-destructive">
                        {result.errors.map((failure, index) => (
                          <p key={`${result.id}-error-${index}`} className="whitespace-pre-wrap break-words">
                            {failure}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2Icon className="size-4" />
                        Test passed
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <OutputPanel label="stdout" value={result.stdout} />
                    <OutputPanel label="stderr" value={result.stderr || 'No stderr output.'} />
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OutputPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-80 overflow-auto rounded-xl border bg-muted/40 p-4 text-xs whitespace-pre-wrap break-words">
        {value || 'No output.'}
      </pre>
    </div>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 500) || `Request failed with status ${res.status}`);
  }
}

function getResponseErrorMessage(
  payload: TestsResponse | RunResponse | RunErrorResponse | null,
  fallback: string,
): string {
  if (payload && 'error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}
