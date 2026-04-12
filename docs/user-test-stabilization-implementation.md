# User Test Stabilization Implementation

Owner: Codex
Goal: reduce user-test risk by improving stability, onboarding clarity, and alignment with the Vaja vision

## Scope For This Pass

### 1. Stability

- Fix the `/verified` build failure caused by `useSearchParams()` without Suspense
- Add a lightweight authenticated app gate so unauthorized users do not land in broken app shells
- Add a pending-approval gate so blocked users see a clear state before chat fails

### 2. First-Run UX

- Simplify default workspace pinning
- Promote `LINE OA` in the default workspace
- Reduce default visual clutter in chat by hiding the outline panel initially

### 3. Branding

- Replace generic names like `Studio Chat` and `Better Auth` with `Vaja AI`
- Update auth screen placeholders and copy to feel product-specific
- Remove mobile zoom restrictions from the viewport config

## Files Expected To Change

- [app/layout.tsx](/D:/vscode2/nextjs/ai-sdk/app/layout.tsx:1)
- [app/page.tsx](/D:/vscode2/nextjs/ai-sdk/app/page.tsx:1)
- [app/verified/page.tsx](/D:/vscode2/nextjs/ai-sdk/app/verified/page.tsx:1)
- [app/(main)/layout.tsx](/D:/vscode2/nextjs/ai-sdk/app/(main)/layout.tsx:1)
- [app/sign-in/page.tsx](/D:/vscode2/nextjs/ai-sdk/app/sign-in/page.tsx:1)
- [app/email-preview/page.tsx](/D:/vscode2/nextjs/ai-sdk/app/email-preview/page.tsx:1)
- [lib/auth.ts](/D:/vscode2/nextjs/ai-sdk/lib/auth.ts:1)
- [features/workspace/catalog.ts](/D:/vscode2/nextjs/ai-sdk/features/workspace/catalog.ts:1)

New supporting files:

- `app/api/user/status/route.ts`
- `features/auth/hooks/use-user-status.ts`
- `features/auth/components/app-access-guard.tsx`

## Rollout Order

1. Fix build blocker.
2. Add user-status endpoint and app access guard.
3. Wrap chat root and main workspace layout with the guard.
4. Simplify navigation defaults and chat default layout state.
5. Clean product branding and auth copy.
6. Re-run build and type-check.

## Out Of Scope For This Pass

- Large chat-page architectural refactor
- Full Thai localization across the product
- Reworking the entire sidebar or tool IA
- Deep performance optimization
- Replacing every raw image usage in the codebase

## Success Criteria

- `pnpm build` succeeds
- First-time users hit a clear sign-in or approval path
- Default workspace feels less overwhelming
- Product branding consistently says `Vaja AI`
- The app feels closer to:
  skill-first
  agent-first
  LINE-native
  simpler than generic AI tools

## Progress Update

- Completed:
  `/verified` build fix
  user-status endpoint
  app access guard
  pending approval state
  branding cleanup on app/auth surfaces
  simpler default workspace pinning
  Thai-first auth and verification copy
  calmer chat empty state and starter prompts
  first-run header/composer guidance aligned to Vaja tasks
  Thai-first entry-page copy for LINE OA, AI Coworkers, and Skills Library
- In progress:
  full end-to-end auth rehearsal
  remaining first-run wording cleanup on secondary screens
- Next likely pass:
  tighten first-run navigation language
  replace high-impact raw image usage on user-facing pages
