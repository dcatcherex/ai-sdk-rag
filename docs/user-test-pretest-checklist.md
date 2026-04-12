# User Test Pre-Test Checklist

Owner: Codex + product team
Target window: before user testing in 4 days
Reference vision: [docs/vaja-vision.md](/D:/vscode2/nextjs/ai-sdk/docs/vaja-vision.md:1)

## Release Blockers

- [x] `pnpm build` passes locally
- [x] `pnpm exec tsc --noEmit` passes locally
- [ ] Core auth pages work end to end:
  Sign up
  Verify email
  Sign in
  Reset password
- [x] Unauthorized users are redirected to `sign-in` instead of seeing broken or empty app states
- [x] Pending-approval users see a clear waiting state before they try to chat

## First-Run UX

- [x] Landing in chat feels simple and uncluttered
- [x] Default navigation matches the Vaja vision:
  Chat first
  LINE OA visible
  Skills visible
  Advanced builder surfaces de-emphasized
- [x] Default state does not overwhelm first-time users with compare, outline, gallery, prompt-library, or multi-agent complexity
- [x] Empty states explain the next useful action in plain language

## Branding And Trust

- [x] App title, metadata, auth emails, and auth screens say `Vaja AI`
- [x] Sign-in and onboarding copy do not use placeholder product names like `Studio Chat` or `Better Auth`
- [x] Thai-first product cues are visible in the entry experience
- [x] Mobile accessibility basics are respected:
  Zoom is not disabled
  Text remains legible
  Key screens work on narrow widths

## Current Progress

- [x] Build blocker on `/verified` fixed
- [x] Auth and approval gate added for chat and main workspace
- [x] Default workspace pinning simplified for first-run testing
- [x] Branding updated to `Vaja AI` across core auth surfaces
- [x] Second-pass chat UX simplification started
- [x] Thai-first onboarding cues added to auth and verification screens
- [x] Third-pass Thai-first chat guidance added to empty state, header, and composer
- [x] Fourth-pass first-run copy updated on LINE OA, AI Coworkers, and Skills Library pages
- [x] Raw `<img>` usage replaced across app and feature surfaces with `next/image` where appropriate

## Core Journey Rehearsal

- [ ] New user can sign up and reach chat successfully
- [ ] User can send first message and get a reply
- [ ] User can find agents and skills without confusion
- [ ] User can understand what LINE OA does and where to connect it
- [ ] User can recover from common problems:
  Not signed in
  Pending approval
  No LINE OA connected
  No skills yet

## High-Value Product Stories To Test

- [ ] "I want AI help for my work right now"
- [ ] "I want to connect LINE OA so Vaja can help reply"
- [ ] "I want a skill that makes Vaja understand my business better"
- [ ] "I want to know what this product does in under 2 minutes"

## Manual QA Script

1. Create a fresh account and confirm email.
2. Confirm redirect after verification works.
3. Confirm first chat works on desktop.
4. Confirm first chat works on mobile width.
5. Confirm `LINE OA` is visible in the workspace navigation.
6. Confirm advanced surfaces are not the default attention grabbers.
7. Confirm pending-approval behavior with `REQUIRE_APPROVAL=true`.
8. Confirm signing out and signing back in is clean.

## Nice-To-Have If Time Remains

- [x] Replace raw `<img>` usage on key surfaces with optimized images where appropriate
- [ ] Improve Thai localization on entry screens
- [ ] Add a lightweight first-run guide or helper text in chat
- [ ] Add event logging around signup, verification, first message, and LINE OA connect
