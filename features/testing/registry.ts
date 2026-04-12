export type FunctionalTestCase = {
  id: string;
  title: string;
  description: string;
  specFile: string;
  grep: string;
  tags: string[];
};

export const FUNCTIONAL_TEST_CASES: FunctionalTestCase[] = [
  {
    id: 'auth-sign-up-switch',
    title: 'Auth form can switch from sign-in to sign-up',
    description: 'Checks that the public sign-in screen renders and can switch into the create-account flow.',
    specFile: 'tests/e2e/auth.spec.ts',
    grep: 'Auth form can switch from sign-in to sign-up',
    tags: ['auth', 'public'],
  },
  {
    id: 'auth-recovery-views',
    title: 'Auth form can open recovery views',
    description: 'Checks that reset-password and magic-link views are reachable from the public auth screen.',
    specFile: 'tests/e2e/auth.spec.ts',
    grep: 'Auth form can open recovery views',
    tags: ['auth', 'public'],
  },
  {
    id: 'verified-status-screen',
    title: 'Verified page shows session status messaging',
    description: 'Checks that the post-verification page renders a clear progress state while waiting for a session.',
    specFile: 'tests/e2e/auth.spec.ts',
    grep: 'Verified page shows session status messaging',
    tags: ['auth', 'public'],
  },
];

export type FunctionalTestCaseSummary = Pick<
  FunctionalTestCase,
  'id' | 'title' | 'description' | 'tags'
>;

export type FunctionalTestRunResult = {
  id: string;
  title: string;
  status: 'passed' | 'failed';
  baseUrl: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  errors: string[];
  ranAt: string;
};

export const FUNCTIONAL_TEST_CASE_SUMMARIES: FunctionalTestCaseSummary[] =
  FUNCTIONAL_TEST_CASES.map(({ id, title, description, tags }) => ({
    id,
    title,
    description,
    tags,
  }));

export function getFunctionalTestCaseById(id: string): FunctionalTestCase | undefined {
  return FUNCTIONAL_TEST_CASES.find((testCase) => testCase.id === id);
}
