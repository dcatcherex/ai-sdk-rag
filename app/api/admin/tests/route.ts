import { spawn } from 'node:child_process';
import { z } from 'zod';
import {
  FUNCTIONAL_TEST_CASE_SUMMARIES,
  getFunctionalTestCaseById,
  type FunctionalTestRunResult,
} from '@/features/testing/registry';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

const runTestSchema = z.object({
  id: z.string().min(1),
});

type PlaywrightJsonReport = {
  errors?: Array<{ message?: string }>;
  stats?: {
    duration?: number;
    unexpected?: number;
  };
  suites?: Array<{
    suites?: PlaywrightJsonReport['suites'];
    specs?: Array<{
      title?: string;
      tests?: Array<{
        results?: Array<{
          error?: {
            message?: string;
            stack?: string;
          };
        }>;
      }>;
    }>;
  }>;
};

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  return Response.json({ tests: FUNCTIONAL_TEST_CASE_SUMMARIES });
}

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const parsedBody = runTestSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const testCase = getFunctionalTestCaseById(parsedBody.data.id);
    if (!testCase) {
      return Response.json({ error: 'Test case not found' }, { status: 404 });
    }

    const requestUrl = new URL(req.url);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? requestUrl.origin;
    const startedAt = Date.now();
    const { command, args } = getPlaywrightCommand(testCase.specFile, testCase.grep);

    const execution = await new Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
      spawnError: string | null;
    }>((resolve) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CI: '1',
          PLAYWRIGHT_BASE_URL: baseUrl,
        },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let spawnError: string | null = null;

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        spawnError = error.message;
      });

      child.on('close', (exitCode) => {
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
          spawnError,
        });
      });
    });

    const parsedReport = safeParseReport(execution.stdout);
    const errors = [
      ...(execution.spawnError ? [execution.spawnError] : []),
      ...extractPlaywrightErrors(parsedReport),
    ];
    if (!parsedReport && execution.stderr.trim()) {
      errors.push(execution.stderr.trim());
    }

    const result: FunctionalTestRunResult = {
      id: testCase.id,
      title: testCase.title,
      status:
        execution.exitCode === 0 && (parsedReport?.stats?.unexpected ?? 0) === 0
          ? 'passed'
          : 'failed',
      baseUrl,
      durationMs:
        parsedReport?.stats?.duration ?? Math.max(0, Date.now() - startedAt),
      stdout: execution.stdout,
      stderr: execution.stderr,
      errors,
      ranAt: new Date().toISOString(),
    };

    return Response.json({ run: result }, { status: result.status === 'passed' ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected test runner error';
    return Response.json({ error: message }, { status: 500 });
  }
}

function safeParseReport(stdout: string): PlaywrightJsonReport | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as PlaywrightJsonReport;
  } catch {
    return null;
  }
}

function extractPlaywrightErrors(report: PlaywrightJsonReport | null): string[] {
  if (!report) return [];

  const errors: string[] = [];

  for (const error of report.errors ?? []) {
    if (error.message) {
      errors.push(error.message);
    }
  }

  const visitSuites = (suites: PlaywrightJsonReport['suites']) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          for (const result of test.results ?? []) {
            const message = result.error?.stack ?? result.error?.message;
            if (message) {
              errors.push(message);
            }
          }
        }
      }

      visitSuites(suite.suites);
    }
  };

  visitSuites(report.suites);

  return Array.from(new Set(errors));
}

function getPlaywrightCommand(specFile: string, grep: string): {
  command: string;
  args: string[];
} {
  const playwrightArgs = [
    'exec',
    'playwright',
    'test',
    specFile,
    '--grep',
    grep,
    '--reporter=json',
    '--workers=1',
  ];

  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm', ...playwrightArgs],
    };
  }

  return {
    command: 'pnpm',
    args: playwrightArgs,
  };
}
