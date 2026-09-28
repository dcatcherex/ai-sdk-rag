# Batch 6 — Remove agent teams

Issue #6 · Branch `compaction/06-agent-teams` · Risk: Low (5 external files)

## Why
Autonomy scope is Levels 1–3; a shop owner needs one good agent. 1 team exists in the DB.

## Delete

```
features/agent-teams/
app/(main)/agent-teams/
app/api/agent-teams/
app/api/team-chat/                  (route.ts, plan/)
app/api/team-runs/                  (route.ts, [runId]/)
docs/agent-teams.md
```

## Edit
- `package.json` `"test"` script — remove `features/agent-teams/server/*.test.ts`.
- `features/workspace/catalog.ts` (~lines 118–125) — remove the `agent-teams` nav entry.
- `features/chat/components/sidebar/sidebar-nav.tsx` — remove `"agent-teams"` from
  `SidebarNavItemId` and any `OPTIONAL_NAV_ITEMS` entry.
- Clean `localStorage` handling: if sidebar code validates stored ids
  (`chat-sidebar-visible-items`, `chat-sidebar-item-order`), make sure an unknown stored
  `"agent-teams"` id is ignored, not crashed on.
- `CLAUDE.md` — delete the "Agent Teams" section, the `agent-teams/` directory lines, and
  the agent-team rows in the schema tables.

## Verify
- `grep -rn "agent-teams\|agentTeam\|team-chat\|team-runs\|teamRun" app features lib components` → only `db/schema` hits.
- Sidebar renders for a user whose localStorage still lists `agent-teams`.
