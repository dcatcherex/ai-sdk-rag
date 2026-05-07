# Agent Audit Endpoints — Implementation and Usage Guide

> **Audience:** Admins, AI coders, and developers maintaining agent quality.
> **Status:** Implemented and ready to use.
> **Scope:** Covers architecture, endpoint contracts, audit workflow, and practical usage for agent configuration review.

---

## 1. Why this guide exists

Agent setup spans many sections (prompt, skills, tools, custom tools, MCP, sharing, knowledge). Manual screenshot review is slow and error-prone.

This guide defines a single, API-first audit workflow so one JSON request can answer:

- What the agent is configured to do
- What is missing or risky
- What should be changed in prompt and settings

---

## 2. What was implemented

### 2.1 New admin endpoints

- `GET /api/admin/agents/[id]/audit-snapshot`
- `GET /api/admin/agents/[id]/audit-report`

Both endpoints are admin-only and use `requireAdmin()`.

### 2.2 Tiny UI improvement for admin list

In `app/admin/agents/page.tsx`:

- Added an `Agent ID` field on each admin agent card
- Added a `Copy` button with temporary `Copied` state

This makes it fast to copy IDs like `tpl_general` for audit calls.

---

## 3. File map

### 3.1 Snapshot endpoint

- `app/api/admin/agents/[id]/audit-snapshot/route.ts`

Purpose:

- Returns a complete, read-only configuration snapshot
- Includes assembled preview prompt sections

### 3.2 Report endpoint

- `app/api/admin/agents/[id]/audit-report/route.ts`

Purpose:

- Evaluates config quality and risk
- Returns severity findings + recommendations
- Returns a reusable prompt policy patch block

---

## 4. Data sources used by the endpoints

The endpoints aggregate from existing tables and services:

- `agent`
- `agent_skill_attachment` + `agent_skill`
- `agent_user_tool_attachment` + `user_tool`
- `agent_share`
- `document`
- `TOOL_MANIFESTS` from tool registry
- Skill runtime resolver (`resolveSkillRuntimeContext`) for activation preview

---

## 5. Endpoint contracts

## 5.1 `GET /api/admin/agents/[id]/audit-snapshot`

### Query params

- `testMessage` (optional): simulate skill activation context

### Returns

A full payload including:

- `general`
- `aiBehavior`
- `skills`
- `knowledge`
- `tools`
- `customTools`
- `mcpServers`
- `sharing`
- `previewPrompt`

Use this endpoint when you need full context and raw evidence.

## 5.2 `GET /api/admin/agents/[id]/audit-report`

### Query params

- `testMessage` (optional): evaluates activation and alignment for that message

### Returns

- `summary` (score, status, severity counts)
- `context` (high-level inventory)
- `findings` (code/severity/section/message/recommendation)
- `recommendedChanges`
- `promptPatch` (`shouldApply`, `block`)
- `preview` (activated skills + active tools)

Use this endpoint for diagnosis and next-action planning.

---

## 6. Example usage (PowerShell)

## 6.1 Get snapshot

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/agents/tpl_general/audit-snapshot" -Method GET
```

## 6.2 Get report with a realistic test message

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/agents/tpl_general/audit-report?testMessage=ช่วยค้นหาข้อมูลราคาข้าวล่าสุดและสรุปพร้อมแหล่งที่มา" -Method GET
```

## 6.3 Save report to file

```powershell
$report = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/agents/tpl_general/audit-report?testMessage=write%20a%20LINE%20post%20for%20new%20product" -Method GET
$report | ConvertTo-Json -Depth 20 | Out-File -FilePath ".\tmp\tpl_general_audit_report.json" -Encoding utf8
```

---

## 7. Recommended audit workflow

1. Open `/admin/agents` and copy `Agent ID`.
2. Call `audit-snapshot` to inspect full settings.
3. Call `audit-report` with a realistic `testMessage`.
4. Apply `recommendedChanges`.
5. If `promptPatch.shouldApply=true`, append the patch block to system prompt.
6. Re-run `audit-report` and compare `summary.readinessScore`.

---

## 8. Interpreting common findings

- `TOOLS_ALLOW_LIST_EMPTY_EFFECTIVE`
  - Meaning: IDs in `enabledTools` no longer map to active manifests.
  - Fix: re-select tools from current registry.

- `SKILL_TOOL_MISMATCH`
  - Meaning: skill expects tool(s) that agent allow-list blocks.
  - Fix: align agent tools with skill needs.

- `RULE_SKILL_MISSING_TRIGGER`
  - Meaning: rule-based skill has no effective trigger.
  - Fix: set slash/keyword trigger or use model mode.

- `PROMPT_MISSING_SKILL_TOOL_POLICY`
  - Meaning: prompt lacks explicit operational policy.
  - Fix: apply `promptPatch.block`.

- `CUSTOM_TOOL_CONFIRMATION_GAP`
  - Meaning: mutable custom tools do not require confirmation.
  - Fix: set `requiresConfirmation=true` for risky tools.

---

## 9. Safety and permissions

- Endpoints are admin-only (`requireAdmin()`).
- Endpoints are read-only and do not mutate agent state.
- Report output may include operational metadata; treat it as internal admin data.

---

## 10. Validation done

Type-check completed successfully after implementation:

```bash
pnpm exec tsc --noEmit --pretty false
```

---

## 11. Next suggested enhancement

Add a one-click action in the admin agent editor:

- `Run Audit`
- shows `summary` + top findings inline
- optional `Apply Prompt Patch` button for `promptPatch.block`

This would make audit/report part of the normal publish workflow.
