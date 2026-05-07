# Client / Case Workspace - Implementation Guide

> **Audience:** AI coders and developers building Vaja's cross-profession workspace tool.
> **Status:** Phases 0-3 are implemented. The optional native activity table remains deferred.
> **Scope:** A reusable Client / Case Workspace that supports common professional workflows across LINE OA, chat agents, and the web control room.

## Implementation progress

**Last updated:** May 7, 2026

### Shipped in this pass

- Phase 0 scaffold implemented under `features/case-workspace/`
- Manifest, registry wiring, page loader, and sidebar visibility added
- Canonical `service.ts` added on top of `domain-profiles`
- Agent tools added with approval required for persistent writes
- API routes added for profiles, contacts, cases, tasks, notes, and summaries
- First `/tools/case-workspace` workbench UI added with search, selection, timeline, tasks, and summary actions
- Response-format selection updated for new case-workspace tool result kinds
- Initial LINE prompt integration added so matching case context can be injected for LINE conversations without silent writes
- LINE confirmation postback flow added for creating cases and attaching LINE follow-up notes after explicit confirmation
- Workbench filters expanded for source, due-soon, and waiting-on-reply views
- Profession starter skill packages added for legal, clinic, education, sales, agency, and support
- Starter skills now include intake prompts, field guidance, checklist templates, escalation rules, and response contracts for case summaries and follow-ups
- Focused registry and approval tests added
- Empty-account workbench path added: users can now create the first Case Workspace profile directly from `/tools/case-workspace`
- Thai LINE intake/follow-up signal matching repaired and covered by focused tests
- Case Workspace profile creation now normalizes nullable UI fields before calling the underlying `domain-profiles` service
- Assigned-to-me filtering is now implemented in both the service layer and the workbench UI
- Route validation and sidebar-hook invalidation coverage added for the Phase 0 surface
- Profile-level dashboard metrics added for case aging, waiting load, overdue work, and unassigned cases
- Reminder and alert generation added for waiting follow-ups, overdue tasks, due-soon tasks, and unassigned cases
- CSV and PDF export routes added for Case Workspace profile reports
- Workspace-level case assignment added with dedicated API route, timeline events, and workbench controls
- Phase 3 reporting and automation delivered without requiring a native activity table

### Still pending

- Optional native activity table if timeline query volume later outgrows the current entity-backed approach

---

## 1. What this feature does

Most professions share the same operating pattern:

1. A person or organization needs help.
2. The professional opens a case, project, visit, deal, class, claim, campaign, or order.
3. Work accumulates as notes, files, messages, tasks, approvals, deadlines, and status changes.
4. The AI should remember the context and help move the work forward.

This feature turns that pattern into a reusable Vaja tool:

- **Contacts:** customers, clients, students, patients, leads, vendors, candidates, partners
- **Cases:** matters, projects, visits, tickets, deals, claims, campaigns, lessons, orders
- **Timeline:** notes, LINE summaries, AI actions, status changes, file links, decisions
- **Tasks:** next actions, follow-ups, appointments, approvals, due dates
- **AI actions:** summarize, extract tasks, draft reply, create case from chat, retrieve context

This should become the shared professional memory layer for Vaja. Skills customize the language and field expectations for each profession; the core tool stays generic.

---

## 2. Key design decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Canonical feature name | `case-workspace` | "Case" is broad enough for legal, clinic, support, sales, education, and project work |
| Storage foundation | Reuse `domainProfile`, `domainEntity`, and `domainEntityRelation` | Existing generic professional context layer already supports clients, students, patients, deals, projects |
| First native extension | Add activity/timeline records only if domain entity history is insufficient | Avoid duplicating profile/entity storage too early |
| Client UI | New sidebar page at `/tools/case-workspace` | This is a real workbench, not only an agent-only hidden tool |
| Agent behavior | Thin `agent.ts` wrappers call service functions | Preserve the one canonical `service.ts` rule |
| Skill behavior | Skills define profession terms, intake checklists, and recommended fields | Domain knowledge belongs in `SKILL.md`, not platform core |
| LINE behavior | LINE messages can create/update cases after confirmation | LINE OA is the front door; avoid silent persistent writes |
| Write safety | Mutations require explicit approval in agent tools | Creating contacts, cases, tasks, and notes changes persistent state |
| Search behavior | Search contacts/cases/tasks through service functions; later add full-text/vector search | Start simple, then deepen when volume requires it |
| Privacy posture | Per-user, line-user/channel, and brand/workspace ownership follow `domain-profiles` owner context | Prevent cross-workspace leakage |

---

## 3. Relationship to existing `domain-profiles`

`features/domain-profiles/` already provides the generic storage/runtime:

- `domainProfile`: a professional workspace/profile such as clinic, classroom, sales pipeline, farm, or creator workspace
- `domainEntity`: structured entities inside a profile such as student, patient, client, deal, project, or assessment
- `domainEntityRelation`: links between entities
- Agent tools for create/update/find/context

The Client / Case Workspace should **not** replace this. It should add a productized layer with friendlier concepts, stronger workflows, and a visible page.

Recommended mapping:

| Workspace concept | `domain-profiles` mapping |
| --- | --- |
| Workspace | `domainProfile` |
| Contact | `domainEntity.entityType = "contact"` or profession alias such as `"student"`, `"patient"`, `"client"` |
| Case | `domainEntity.entityType = "case"` or alias such as `"deal"`, `"project"`, `"visit"`, `"ticket"`, `"claim"` |
| Task | `domainEntity.entityType = "task"` |
| Note | `domainEntity.entityType = "note"` initially, or native timeline table later |
| File link | `domainEntity.entityType = "file_link"` initially, or relation to `document` / media asset later |
| Contact -> Case | `domainEntityRelation.relationType = "owns"` / `"primary_contact"` |
| Case -> Task | `domainEntityRelation.relationType = "has_task"` |
| Case -> Note | `domainEntityRelation.relationType = "has_note"` |

Use canonical entity type names in the service layer, while allowing skills and UI labels to present profession-specific words.

---

## 4. Files to create

```text
features/case-workspace/manifest.ts
features/case-workspace/schema.ts
features/case-workspace/types.ts
features/case-workspace/service.ts
features/case-workspace/agent.ts
features/case-workspace/hooks/use-case-workspace.ts
features/case-workspace/components/case-workspace-tool-page.tsx
features/case-workspace/components/case-list.tsx
features/case-workspace/components/case-detail-panel.tsx
features/case-workspace/components/case-intake-dialog.tsx
features/case-workspace/components/task-list.tsx
features/case-workspace/components/timeline.tsx

app/api/case-workspace/profiles/route.ts
app/api/case-workspace/contacts/route.ts
app/api/case-workspace/cases/route.ts
app/api/case-workspace/cases/[caseId]/route.ts
app/api/case-workspace/cases/[caseId]/tasks/route.ts
app/api/case-workspace/cases/[caseId]/notes/route.ts
app/api/case-workspace/cases/[caseId]/summary/route.ts
```

Files to edit:

```text
features/tools/registry/client.ts
features/tools/registry/server.ts
features/tools/registry/page-loaders.ts
features/chat/components/sidebar/sidebar-nav.tsx
lib/tools/index.ts                 # only if the registry builder requires explicit wiring
features/line-oa/webhook/events/message.ts
features/response-format/contracts.ts
features/response-format/server/select.ts
```

Optional later-phase files:

```text
db/schema/case-workspace.ts
db/migrations/XXXX_case_workspace_activity.sql
features/case-workspace/server/activity.ts
features/case-workspace/server/search.ts
```

---

## 5. Manifest

Create `features/case-workspace/manifest.ts`:

```typescript
import type { ToolManifest } from "@/features/tools/registry/types";

export const caseWorkspaceManifest: ToolManifest = {
  id: "case_workspace",
  slug: "case-workspace",
  title: "Case Workspace",
  description:
    "Manage contacts, cases, tasks, notes, files, and follow-ups for common professional workflows.",
  icon: "BriefcaseBusiness",
  category: "utilities",
  professions: ["all", "business", "teacher", "marketer", "minimal"],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: true,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
```

Register the manifest in the client registry. Register the agent adapter in the server registry. Do not import `service.ts` in client components.

---

## 6. Core types

Create user-facing DTOs that are stable even if storage remains generic.

```typescript
export type CaseWorkspaceProfile = {
  id: string;
  domain: string;
  name: string;
  description: string | null;
  locale: string;
  status: "active" | "archived";
  data: Record<string, unknown>;
};

export type CaseWorkspaceContact = {
  id: string;
  profileId: string;
  name: string;
  status: "active" | "archived";
  kind: "contact";
  data: {
    role?: string;
    organization?: string;
    channel?: string;
    phone?: string;
    email?: string;
    lineUserId?: string;
    notes?: string;
    [key: string]: unknown;
  };
};

export type CaseWorkspaceCase = {
  id: string;
  profileId: string;
  name: string;
  status: "new" | "in_progress" | "waiting" | "done" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  contactId?: string;
  data: {
    summary?: string;
    source?: "web" | "chat" | "line" | "manual";
    dueAt?: string;
    lastContactAt?: string;
    nextAction?: string;
    professionType?: string;
    [key: string]: unknown;
  };
};

export type CaseWorkspaceTask = {
  id: string;
  caseId: string;
  title: string;
  status: "todo" | "doing" | "done" | "cancelled";
  dueAt?: string;
  assigneeUserId?: string;
  data: Record<string, unknown>;
};

export type CaseWorkspaceTimelineItem = {
  id: string;
  caseId: string;
  kind: "note" | "message_summary" | "status_change" | "task_change" | "file_link" | "ai_action";
  title: string;
  body?: string;
  createdAt: string;
  actorUserId?: string;
  data: Record<string, unknown>;
};
```

These DTOs should be returned by the service. The service can map from `domainEntity` rows internally.

---

## 7. Zod schemas

Create `features/case-workspace/schema.ts`.

Minimum inputs:

- `createWorkspaceProfileInputSchema`
- `createContactInputSchema`
- `updateContactInputSchema`
- `createCaseInputSchema`
- `updateCaseInputSchema`
- `createTaskInputSchema`
- `updateTaskInputSchema`
- `createTimelineNoteInputSchema`
- `searchCasesInputSchema`
- `getCaseContextInputSchema`
- `summarizeCaseInputSchema`

Important rules:

- Validate status enums in the feature schema, even if stored as generic text/JSON.
- Keep `data` as `z.record(z.string(), z.unknown()).optional()` for profession-specific fields.
- Require `profileId` for direct API calls.
- Agent tools may allow omitted `profileId` only when the service can resolve a relevant profile safely.
- Mutating schemas must be clear enough for AI SDK tool descriptions.

Recommended case statuses:

```typescript
export const caseStatusSchema = z.enum([
  "new",
  "in_progress",
  "waiting",
  "done",
  "archived",
]);
```

Recommended task statuses:

```typescript
export const taskStatusSchema = z.enum([
  "todo",
  "doing",
  "done",
  "cancelled",
]);
```

---

## 8. Service layer

Create `features/case-workspace/service.ts` as the canonical business logic.

It should call `features/domain-profiles/service.ts` functions internally:

- `createDomainProfile`
- `updateDomainProfile`
- `listDomainProfiles`
- `createDomainEntity`
- `updateDomainEntity`
- `getDomainEntity`
- `listDomainEntities`
- `linkDomainEntities` if available
- `resolveRelevantDomainContext`

Required service functions:

```typescript
export async function createCaseWorkspaceProfile(input, owner) {}
export async function listCaseWorkspaceProfiles(owner, filters) {}

export async function createContact(input, owner) {}
export async function updateContact(contactId, patch, owner) {}
export async function listContacts(profileId, owner, filters) {}

export async function createCase(input, owner) {}
export async function updateCase(caseId, patch, owner) {}
export async function getCaseContext(caseId, owner) {}
export async function searchCases(input, owner) {}

export async function createTask(caseId, input, owner) {}
export async function updateTask(taskId, patch, owner) {}
export async function listTasks(caseId, owner, filters) {}

export async function addCaseNote(caseId, input, owner) {}
export async function listCaseTimeline(caseId, owner) {}

export async function createCaseFromLineMessage(input, owner) {}
export async function summarizeCase(caseId, owner) {}
```

Service responsibilities:

1. Normalize aliases into canonical entity types.
2. Verify owner access before every read/write.
3. Link related entities after creation.
4. Return feature DTOs, not raw `domainEntity` rows.
5. Keep all write behavior here so API routes and agent tools stay thin.

Do not place business logic in route handlers, UI components, or `agent.ts`.

---

## 9. Agent tools

Create `features/case-workspace/agent.ts`.

Recommended tools:

| Tool | Write? | Approval | Purpose |
| --- | --- | --- | --- |
| `get_case_context` | No | No | Load one case with contact, tasks, notes, and recent timeline |
| `search_cases` | No | No | Find cases/contacts/tasks by name, status, priority, or profession data |
| `create_contact` | Yes | Yes | Save a new contact after user confirmation |
| `create_case` | Yes | Yes | Save a new case/project/visit/deal/ticket |
| `update_case` | Yes | Yes | Change status, priority, summary, due date, next action |
| `add_case_note` | Yes | Yes | Save note or message summary to timeline |
| `create_case_task` | Yes | Yes | Save a follow-up task |
| `summarize_case` | No by default | No | Generate context summary without changing state |

Descriptions should mention profession aliases:

```text
Create a professional case, project, visit, deal, ticket, claim, campaign, lesson, or order inside the user's Case Workspace. Always confirm before writing persistent data.
```

The agent adapter should return AI-friendly results using existing response kinds where possible, or add new response kinds:

- `case_saved`
- `case_updated`
- `case_context`
- `case_task_saved`
- `case_note_saved`
- `case_summary`

Then update `features/response-format/contracts.ts` and `features/response-format/server/select.ts`.

---

## 10. API routes

Routes should do only:

1. Authenticate.
2. Parse JSON.
3. Validate with Zod.
4. Build owner context.
5. Call service.
6. Return JSON.

Example route pattern:

```typescript
const session = await auth.api.getSession({ headers: req.headers });
if (!session?.user) return new Response("Unauthorized", { status: 401 });

const body = await req.json();
const result = createCaseInputSchema.safeParse(body);
if (!result.success) {
  return Response.json({ error: "Bad Request", issues: result.error.issues }, { status: 400 });
}

const created = await createCase(result.data, {
  userId: session.user.id,
  brandId: result.data.brandId ?? null,
});

return Response.json({ case: created });
```

Use `@/` imports only.

---

## 11. Sidebar page UX

The first page at `/tools/case-workspace` should be a workbench, not a marketing page.

Required panels:

- Left: case/contact search and filters
- Center: selected case timeline and notes
- Right: tasks, status, due date, contact card, AI actions

Core actions:

- New contact
- New case
- Add note
- Add task
- Mark task done
- Change case status
- Generate case summary
- Draft LINE reply from case context

Filters:

- Status
- Priority
- Due soon
- Waiting on reply
- Assigned to me
- Source: manual, chat, LINE

Keep the UI dense and work-focused. Use shadcn/ui primitives, lucide icons, TanStack Query, and the existing page layout pattern.

Do not fetch data with `useEffect`; use React Query hooks in `features/case-workspace/hooks/use-case-workspace.ts`.

---

## 12. LINE OA integration

LINE should be able to feed the Case Workspace without making silent writes.

In `features/line-oa/webhook/events/message.ts`:

1. Load or infer the relevant workspace profile from `lineUserId` + `channelId`.
2. Include compact case context in the agent prompt when a matching case exists.
3. If no case exists and the message looks like an intake, the agent can propose creating one.
4. Mutating case tools require approval/confirmation.
5. After a confirmed case write, add a timeline item with source `"line"`.

Useful intake signals:

- New sender with issue/request
- Appointment request
- Complaint/support request
- Document/photo sent
- Follow-up wording such as "status", "any update", "when ready"
- Profession-specific keywords supplied by active skills

Line-specific case data:

```typescript
{
  source: "line",
  lineUserId,
  channelId,
  lastLineMessageId,
  lastContactAt,
}
```

Never expose another user's LINE case context across channels or workspaces.

---

## 13. Skill integration

Profession knowledge belongs in skills.

Starter skill examples:

```text
features/skills/packages/legal/client-case-intake/SKILL.md
features/skills/packages/education/student-case-workspace/SKILL.md
features/skills/packages/clinic/patient-visit-intake/SKILL.md
features/skills/packages/sales/client-deal-workspace/SKILL.md
features/skills/packages/agency/client-campaign-workspace/SKILL.md
features/skills/packages/support/customer-ticket-workspace/SKILL.md
```

Each skill should define:

- Trigger signals
- Required intake questions
- Recommended case fields
- Escalation conditions
- Safe wording constraints
- Example contact/case/task structures

Example field guidance for a legal skill:

```yaml
contact fields: role, phone, email, preferredChannel
case fields: matterType, jurisdiction, deadline, opposingParty, summary
task fields: dueAt, responsiblePerson, requiredDocument
```

The core `case-workspace` service must not hardcode legal, medical, school, or sales logic.

---

## 14. Optional native timeline table

Start with notes as `domainEntity` if speed matters. Add a native table when timeline query, audit, or reporting needs become painful.

Suggested schema:

```typescript
export const caseWorkspaceActivity = pgTable("case_workspace_activity", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => domainProfile.id, { onDelete: "cascade" }),
  caseEntityId: text("case_entity_id").notNull().references(() => domainEntity.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  source: text("source").notNull().default("manual"),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("case_workspace_activity_case_idx").on(table.caseEntityId),
  index("case_workspace_activity_profile_idx").on(table.profileId),
  index("case_workspace_activity_createdAt_idx").on(table.createdAt),
]);
```

If this table is added:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## 15. Permissions and privacy

Use the same owner model as `domain-profiles`:

- Signed-in user context: `{ userId, brandId }`
- LINE context: `{ lineUserId, channelId }`
- Workspace context: brand/workspace membership where applicable

Rules:

1. Every service read/write verifies ownership before returning data.
2. API routes cannot accept arbitrary `userId`.
3. LINE context cannot read web-only user records unless account linking explicitly allows it.
4. Agent tools require approval for persistent writes.
5. Timeline should record source and actor when available.
6. Summaries should avoid leaking hidden internal notes unless the caller owns the case.

---

## 16. Delivery phases

### Phase 0 - Thin product layer on existing domain profiles

Status: complete

Deliver:

- Manifest and registry wiring
- `case-workspace` service wrapping `domain-profiles`
- Agent tools for create/search/context/update/note/task
- Basic API routes
- Basic sidebar page
- Tests for service mapping and registry wiring

No new DB tables required unless timeline is too awkward.

### Phase 1 - LINE intake and follow-up loop

Status: complete

Deliver:

- Case context resolver for LINE conversations
- Create-case-from-message flow
- Timeline notes from LINE summaries
- Due-soon and waiting-reply filters
- Draft reply action from case context

### Phase 2 - Profession starter kits

Status: complete

Deliver:

- Starter skills for legal, clinic, education, sales, agency, support
- Profession-specific field presets in skills
- Suggested workflow/checklist templates
- Case summary formatting by response contract

Status:

- Shipped in `features/skills/packages/legal/client-case-intake/`
- Shipped in `features/skills/packages/education/student-case-workspace/`
- Shipped in `features/skills/packages/clinic/patient-visit-intake/`
- Shipped in `features/skills/packages/sales/client-deal-workspace/`
- Shipped in `features/skills/packages/agency/client-campaign-workspace/`
- Shipped in `features/skills/packages/support/customer-ticket-workspace/`

### Phase 3 - Reporting and automation

Status: complete

Deliver:

- Case aging metrics
- Follow-up reminders
- Task overdue alerts
- Export to CSV/PDF
- Workspace-level case assignment
- Optional native activity table

---

## 17. Implementation order

1. Create `features/case-workspace/types.ts` and `schema.ts`.
2. Implement DTO mappers from `domainProfile` / `domainEntity`.
3. Implement `service.ts` using existing `domain-profiles` service functions.
4. Add `agent.ts` with read tools first, then write tools with `needsApproval: true`.
5. Add manifest and registry wiring.
6. Add API routes with auth + Zod validation.
7. Add React Query hooks.
8. Build `/tools/case-workspace` page.
9. Add response-format kinds.
10. Add focused tests.
11. Add LINE integration after the web/agent path is stable.

---

## 18. Tests

Minimum tests:

- Manifest is registered in client and server registries.
- Agent write tools set `needsApproval: true`.
- Creating a case maps to `domainEntity.entityType = "case"`.
- Creating a contact maps to `domainEntity.entityType = "contact"`.
- Updating case status only allows known statuses.
- `getCaseContext` returns contact, case, tasks, and notes for the owner.
- Owner A cannot read Owner B's case.
- LINE owner context is isolated by `lineUserId` + `channelId`.
- API routes reject invalid Zod payloads.
- Sidebar hooks invalidate the correct query keys after mutations.

Manual QA:

1. Create a profile, contact, case, note, and task from the sidebar.
2. Ask chat to find the case and summarize it.
3. Ask chat to create a follow-up task; verify approval appears.
4. Mark a task done from the sidebar.
5. Send a simulated LINE message and verify it can be attached to the correct case.

---

## 19. Acceptance criteria

The feature is ready for first release when:

1. A user can manage contacts, cases, notes, and tasks from `/tools/case-workspace`.
2. An agent can retrieve case context before drafting professional replies.
3. Agent-created writes require confirmation.
4. Case data is isolated by user/workspace/LINE channel.
5. LINE messages can become case notes or draft case records.
6. No client component imports `service.ts` or `agent.ts`.
7. All logic used by sidebar, API routes, and agent adapters flows through `features/case-workspace/service.ts`.
8. Tests cover registry wiring, service mapping, auth isolation, and approval flags.

---

## 20. Why this is essential

This is the tool that makes Vaja useful across common professions because it gives every agent a shared place to put real work:

- A lawyer gets cases.
- A clinic gets patient visits.
- A tutor gets student plans.
- A salesperson gets client deals.
- An agency gets client campaigns.
- A shop gets customer orders and support tickets.

Skills make the agent understand the profession. The Case Workspace lets the agent remember, organize, and act on the work.
