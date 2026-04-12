# Automated Testing

This app now includes an MVP functional-testing setup built on Playwright.

## What you can do

- Run browser-based smoke tests from the terminal.
- Open `/admin/tests` and click `Run` on a registered test case.
- Add more functional cases without changing the admin UI.

## Commands

```bash
pnpm test
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:install
```

Install Chromium once before the first browser run:

```bash
pnpm test:e2e:install
```

## Admin runner

The admin runner lives at `/admin/tests`.

- `GET /api/admin/tests` lists registered cases.
- `POST /api/admin/tests` runs one case by id.
- The route uses the current request origin as the Playwright base URL unless `PLAYWRIGHT_BASE_URL` is set.

## Add a new case

1. Add a Playwright test in `tests/e2e/*.spec.ts`.
2. Register it in [features/testing/registry.ts](/d:/vscode2/nextjs/ai-sdk/features/testing/registry.ts:1).
3. Open `/admin/tests` and run it.

Each registry item maps one admin-visible test case to one Playwright spec title via `grep`.
