# Batch 7 — Remove generic workspace modules
(case-workspace, user-tools, workspace-ai, platform-agent, prompts)

Issue #7 · Branch `compaction/07-workspace-modules` · Risk: **Medium** (chat route, agent form, LINE)

## Why
These serve a generic-professional workspace, not the shop-owner wedge. 0 rows in
`user_tool*`, `prompt_library` has 0, case tables empty.

**Side benefit (important for pilots):** today, when the LINE OA *owner* messages their
own OA, `features/line-oa/webhook/index.ts` routes them to the platform-agent
"management bot" instead of the customer agent — so during concierge setup the owner
cannot test the customer experience from their own phone. Removing platform-agent fixes it.

## Delete

```
features/case-workspace/
features/user-tools/
features/workspace-ai/
features/platform-agent/
features/prompts/
features/line-oa/webhook/management-bot.ts
app/(main)/user-tools/
app/(main)/prompts/
app/api/case-workspace/
app/api/user-tools/
app/api/agents/[id]/user-tools/
app/api/workspace-ai/
app/api/platform-agent/            (context, onboard)
app/api/prompts/
docs/conversational-platform-management-dev-guide.md
docs/workspace-ai-assist-implementation.md
```
Keep `app/api/webhooks/clerk/` — unrelated.

## Edit

### Chat route — `app/api/chat/route.ts`
- Remove imports lines 24–26 (platform-agent).
- Remove `isVajaPlatformRequest` / `isPlatformAgentActive` (~168–169) and every branch that
  uses them (~270–272 system prompt, ~314–315 tools override, ~331 prompt override).
  The normal agent/default path becomes the only path.
- grep the client for `'vaja-platform'` (agent picker, constants) and remove it.

### LINE
- `features/line-oa/webhook/index.ts` — remove `handleManagementBotEvent` import (line 12)
  and the "Management bot detection" block (~lines 134–147). The owner now flows through
  the same handler as customers. Keep `isChannelOwner` only if used elsewhere.
- `features/line-oa/webhook/events/message.ts` — remove the case-workspace import
  (lines ~22–24), `resolveRelevantCaseWorkspaceContext` call (~449), the
  `caseWorkspaceBlock` prompt injection (~460–496), and `caseWorkspaceContext` passing
  (~140, 218, 278, 510).
- `features/line-oa/webhook/events/text-replies.ts` — remove case-workspace imports
  (lines ~28, 35), `caseWorkspaceContext` from the input type, the
  `pendingCaseDraft` / `shouldSuggestCreate` block and the
  `detectCaseWorkspaceFollowUpSignal` block (~lines 660–720). If
  `latestAssistantMetadata` (renamed in batch 1) is now unused, remove it and its
  producer in `message.ts`.
- `features/line-oa/webhook/events/postback.ts` — remove `addCaseNote`, `createCase`,
  `readPendingCaseWorkspaceDraft` import (line 7) and the case-draft postback branch.

### Agents (user-tools + workspace-ai)
- `features/agents/types.ts` — remove `AgentUserToolAttachment*` imports and the
  `userTools` / attachment fields on agent types.
- `features/agents/hooks/use-agents.ts` — remove `AgentUserToolAttachment` usage.
- `features/agents/components/agent-custom-tools-section.tsx` — delete the component
  (it only renders user-tools); remove its usage in `agent-form.tsx`.
- `features/agents/components/agent-form.tsx` — remove `useUserTools`,
  `AgentUserToolAttachmentInput`, `requestWorkspaceImageAssist`,
  `requestWorkspaceTextAssist`, `AiSuggestionDialog` and all related state/handlers/JSX.
- `features/agents/components/agent-general-section.tsx` — remove `AiAssistButton`,
  `AiImageAssistDialog` and their buttons.
- `features/agents/server/run-tools.ts` (~line 124) — remove the dynamic
  `buildUserCreatedToolSet` import branch; custom user tools no longer exist.
- `features/agents/server/optimizer-apply.ts` — remove `getUserToolById` / `updateUserTool`
  usage (the optimizer can no longer patch user tools; delete that suggestion kind).
- Agent create/update API (`app/api/agents/**`) and zod schemas — remove user-tool
  attachment fields.

### Skills editor — `features/skills/components/skill-editor-panel.tsx`
- Remove `requestWorkspaceTextAssist`, `AiAssistButton`, `AiSuggestionDialog`,
  `WorkspaceTextAssistResult` and their UI.

### Chat composer — `features/chat/components/composer/chat-composer.tsx`
- Remove `PromptPickerModal` import (line 40), its trigger button and state.

### Registry / nav / tests / deps
- `client.ts`, `server.ts`, `page-loaders.ts` — remove case-workspace and platform-agent
  (and user-tools if registered).
- `features/workspace/catalog.ts` — remove `/user-tools` (~58–63) and `/prompts` (~129–134) entries.
- `package.json` `"test"` — remove `features/user-tools/server/*.test.ts` and
  `features/case-workspace/*.test.ts`.
- `pdf-lib` — after this batch, if no imports remain, `pnpm remove pdf-lib`.
- `CLAUDE.md` — remove mentions.

## Verify
- `grep -rnE "features/(case-workspace|user-tools|workspace-ai|platform-agent|prompts)/|management-bot|vaja-platform|caseWorkspace|UserTool" app features lib components` → no hits.
- Agents page: create + edit an agent, attach a skill, save. Skill editor opens and saves.
- LINE: the channel owner messaging their own OA gets the normal agent reply.
