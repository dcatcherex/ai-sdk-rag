# Domain-Neutral Profile And Entity Layer Implementation Guide

## Purpose

Vaja needs a way to store structured real-world context without turning the platform into a single-industry product.

For agriculture, this means farm profiles, plots, crops, and crop cycles. For education, it means classes, students, lessons, and assessments. For clinics, it means patients, visits, and care notes. For sales teams, it means clients, deals, and follow-ups.

The implementation should add a reusable profile and entity layer that skills can specialize through configuration and prompts.

Core rule:

Do not add farm-only concepts to platform core. Add generic profile/entity primitives, then let agriculture skills define farm-specific labels, fields, onboarding questions, and tool behavior.

## Progress

Updated: 2026-05-01

- Phase 1 is implemented in code.
- Phase 1 SQL has been applied successfully.
- Added `domainProfile`, `domainEntity`, and `domainEntityRelation` schema definitions in `db/schema/domain-profiles.ts`.
- Exported the new schema from `db/schema.ts`.
- Added the Phase 1 server layer in `features/domain-profiles/` with typed CRUD, ownership checks, relation linking, context resolution, and LINE-to-user migration support.
- Added a SQL migration file at `db/migrations/0061_domain_profiles.sql`.
- Drizzle's automatic generation path is currently complicated by a pre-existing unrelated `agent.starter_tasks` / `starter_prompts` rename prompt, so the migration was added directly for this phase.
- Phase 2 is implemented in code.
- Added `features/domain-profiles/manifest.ts`, `features/domain-profiles/schema.ts`, and `features/domain-profiles/agent.ts`.
- Registered the domain profiles tool in the client and server tool registries.
- Added tests covering registry wiring and mutation approval expectations.
- Phase 3 is implemented in code.
- Added `features/domain-profiles/server/prompt.ts` to render compact `<domain_context>` prompt blocks.
- Injected domain context into the shared prompt assembly path used by web chat and LINE agent runs.
- Added LINE channel resolution support so unlinked LINE users can still receive domain-context injection.
- Added tests covering prompt ordering and compact domain-context rendering.
- Phase 4 is implemented in code.
- Extended record-keeper schemas and service to accept, persist, and return optional activity `metadata`.
- Added metadata support for `profileId`, `entityIds`, `entityType`, and `source` while keeping the record layer domain-neutral.
- Updated the agriculture `farm-record-keeper` skill to use domain profile context and attach structured metadata when available.
- Added tests covering record-keeper metadata schema parsing.
- Phase 5 is implemented in code.
- Added an agriculture pilot helper with lightweight farm profile definitions, optional setup questions, and plot/crop-cycle examples in `features/domain-profiles/server/agriculture.ts`.
- Injected an optional farm setup prompt block into the shared agent runtime so web chat and LINE can offer progressive setup without forcing forms.
- Expanded the agriculture `farm-record-keeper` skill with setup rules, plot and crop-cycle examples, and explicit GPS/boundary optionality.
- Added tests covering the agriculture setup prompt behavior.

## Current State

The app already has useful building blocks:

- LINE conversation persistence via `lineConversation` and `chatThread`.
- Durable chat history via `chatMessage`.
- User and LINE-user memory via `userMemory`.
- Generic activity records via `activityRecord`.
- Skill packages that specialize behavior, including `farm-record-keeper` and `weather-farm-risk`.
- Agent tool registration through `features/tools/registry/server.ts`.
- Skill tool unlocking through `allowed-tools` / `enabledTools`.

Current gaps:

- No field definition layer for skill-defined data capture.
- No reusable optional setup flow yet for non-agriculture professions.
- Agriculture pilot setup exists at the prompt/helper layer, but there is not yet a dedicated profile management UI.

## Product Principle

The user should be able to start chatting immediately.

Structured setup should be optional, conversational, and progressive. The system should collect only the minimum details needed for better advice, then refine over time.

Examples:

- Farmer: province, main crop, approximate area, plot names.
- Teacher: school, grade, subject, class names.
- Clinic: specialty, patient code, visit type, constraints.
- Sales: industry, client name, deal stage, next action.
- Creator: brand, audience, platforms, content pillars.

## Target Architecture

Add a new feature module:

```txt
features/domain-profiles/
  schema.ts
  types.ts
  service.ts
  agent.ts
  manifest.ts
  components/
    profile-setup-panel.tsx
    entity-list.tsx
    entity-detail.tsx
  hooks/
    use-domain-profiles.ts
  server/
    queries.ts
    mutations.ts
    prompt.ts

app/api/domain-profiles/
  route.ts
app/api/domain-profiles/[profileId]/
  route.ts
app/api/domain-profiles/[profileId]/entities/
  route.ts
app/api/domain-profiles/[profileId]/entities/[entityId]/
  route.ts

db/schema/domain-profiles.ts
```

Register the tool in:

- `features/tools/registry/client.ts`
- `features/tools/registry/server.ts`
- `features/tools/registry/page-loaders.ts`, only if a sidebar page is added

## Data Model

Use three core tables.

### 1. `domainProfile`

A profile is the top-level structured context for a profession or workflow.

Agriculture example: "Somchai Farm".

Education example: "Mathayom 2 Science Class".

Sales example: "Northern Region Sales Pipeline".

Suggested fields:

```ts
export const domainProfile = pgTable("domain_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  lineUserId: text("line_user_id"),
  channelId: text("channel_id"),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  locale: text("locale").notNull().default("th-TH"),
  status: text("status").notNull().default("active"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

Ownership rules:

- Signed-in web users should write `userId`.
- Linked LINE users should write `userId`.
- Unlinked LINE users may write `lineUserId` and `channelId`, then migrate to `userId` after account linking.
- `brandId` is optional and should only be used when the profile belongs to a brand/workspace context.

### 2. `domainEntity`

An entity is a structured object inside a profile.

Agriculture examples: plot, crop cycle, irrigation source.

Education examples: student, class, assessment.

Sales examples: client, deal, contact.

Suggested fields:

```ts
export const domainEntity = pgTable("domain_entity", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => domainProfile.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

Keep domain-specific fields in `data`.

Example agriculture plot:

```json
{
  "area": { "value": 2, "unit": "rai" },
  "locationText": "Mae Rim, Chiang Mai",
  "soilType": "clay loam",
  "irrigation": "drip",
  "mainCrop": "tomato"
}
```

Example class:

```json
{
  "grade": "M2",
  "subject": "science",
  "studentCount": 34,
  "schedule": "Mon/Wed morning"
}
```

### 3. `domainEntityRelation`

Relations connect entities without adding domain-specific columns.

Agriculture examples:

- crop cycle belongs to plot
- activity record applies to crop cycle

Education examples:

- student belongs to class
- assessment belongs to class

Suggested fields:

```ts
export const domainEntityRelation = pgTable("domain_entity_relation", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => domainProfile.id, { onDelete: "cascade" }),
  fromEntityId: text("from_entity_id").notNull().references(() => domainEntity.id, { onDelete: "cascade" }),
  toEntityId: text("to_entity_id").notNull().references(() => domainEntity.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## Optional Field Definitions

Start without a database-backed field-definition system unless the UI needs it immediately.

For v1, field definitions can live in skill files or feature constants.

Example skill-side config:

```ts
export const agricultureProfileDefinition = {
  domain: "agriculture",
  profileLabel: "Farm profile",
  setupQuestions: [
    { key: "province", label: "Province", required: true },
    { key: "district", label: "District", required: false },
    { key: "mainCrop", label: "Main crop", required: true },
    { key: "approxArea", label: "Approximate area", required: false },
  ],
  entityTypes: {
    plot: {
      label: "Plot",
      fields: ["area", "locationText", "soilType", "irrigation", "mainCrop"],
    },
    crop_cycle: {
      label: "Crop cycle",
      fields: ["crop", "startDate", "expectedHarvestDate", "plotId"],
    },
  },
};
```

Add database-backed definitions later if admins need to create new profile/entity templates in the UI.

## Service Layer

All business logic should live in `features/domain-profiles/service.ts`.

Required functions:

```ts
createDomainProfile(input, ownerContext)
updateDomainProfile(profileId, patch, ownerContext)
getDomainProfile(profileId, ownerContext)
listDomainProfiles(ownerContext, filters)

createDomainEntity(profileId, input, ownerContext)
updateDomainEntity(entityId, patch, ownerContext)
getDomainEntity(entityId, ownerContext)
listDomainEntities(profileId, ownerContext, filters)

linkDomainEntities(input, ownerContext)
unlinkDomainEntities(relationId, ownerContext)

resolveRelevantDomainContext(input, ownerContext)
migrateLineProfilesToUser(lineUserId, channelId, userId)
```

Service rules:

- Never trust `profileId` alone. Always verify ownership.
- Keep domain validation shallow in core. Validate universal fields in core and skill-specific fields in skill/helper code.
- Do not write agriculture logic in shared services.
- Use `@/` imports.
- Return typed DTOs, not raw Drizzle rows, when used by API routes or tools.

## Tool Layer

Add an agent tool wrapper in `features/domain-profiles/agent.ts`.

Tools:

- `create_profile`
- `update_profile`
- `create_entity`
- `update_entity`
- `find_entities`
- `get_profile_context`

Important behavior:

- Mutating tools should use `needsApproval: true`.
- The agent must confirm with the user before creating or updating persistent structured data.
- Tool descriptions should be domain-neutral, with examples across professions.
- Skill prompts can narrow behavior for agriculture, education, clinics, etc.

Example tool description:

```ts
description:
  "Create or update structured professional context such as a farm profile, class profile, patient/client profile, project, plot, class, student, client, or other domain entity. Always confirm with the user before writing."
```

## Prompt Integration

Add a prompt helper:

```txt
features/domain-profiles/server/prompt.ts
```

It should render a compact block:

```xml
<domain_context>
Profile: Somchai Farm
Domain: agriculture
Known fields:
- province: Chiang Mai
- mainCrop: tomato
Entities:
- plot: Back field, 2 rai, tomato
- crop_cycle: Tomato cycle 2026, started 2026-05-01
</domain_context>
```

Inject this block after user profile memory and before active skills.

Reasoning:

- User memory says who the user is.
- Domain profile says what real-world context the agent is working inside.
- Skills say how to behave for the current domain.

Do not inject full JSON by default. Render short, human-readable context. Fetch full entity details through tools when needed.

## Chat Route Integration

In `app/api/chat/route.ts`:

1. Resolve active agent and active skills as today.
2. Determine relevant profile context using `resolveRelevantDomainContext`.
3. Render the domain context prompt block.
4. Add domain profile tool IDs when active skills allow them.
5. On finish, keep existing memory extraction separate from structured profile extraction.

Do not merge domain profiles into `userMemory`.

`userMemory` remains lightweight profile facts.

`domainProfile` and `domainEntity` become structured operational context.

## LINE Integration

In `features/line-oa/webhook/events/message.ts`:

1. Resolve linked user if available.
2. If linked, read/write profiles by `userId`.
3. If unlinked, read/write profiles by `lineUserId` and `channelId`.
4. On account linking, call `migrateLineProfilesToUser` alongside `mergeLineMemoryToUser`.

LINE setup should be conversational:

```txt
Farmer: I grow tomato in Chiang Mai.
Agent: Should I remember this as your farm profile? I can store province = Chiang Mai and main crop = tomato.
Farmer: yes
Agent: Saved. If you want, you can later add plot names like "back field" or "greenhouse".
```

Avoid first-run forms unless the user taps a setup menu item or asks for personalization.

## Record Keeper Integration

Extend `activityRecord` usage without replacing it.

Recommended improvements:

- Write `metadata` in `runLogActivity`.
- Allow `metadata.profileId`.
- Allow `metadata.entityIds`.
- Allow `metadata.entityType`.
- Allow `metadata.source`.

Example farm activity:

```json
{
  "contextType": "agriculture",
  "category": "fertilizer",
  "entity": "tomato",
  "activity": "Applied urea",
  "quantity": "50 kg",
  "cost": 850,
  "metadata": {
    "profileId": "farm_123",
    "entityIds": ["plot_back_field", "cycle_tomato_2026"],
    "plotName": "Back field"
  }
}
```

This lets record keeping stay generic while gaining entity-level precision.

## Agriculture Mapping

Agriculture should be implemented as a skill package plus optional setup helpers.

Recommended agriculture entity types:

- `farm_profile`
- `plot`
- `crop_cycle`
- `input_source`
- `buyer`
- `equipment`

Recommended profile fields:

- province
- district
- mainCrop
- approximateArea
- preferredUnits
- waterSource
- farmingMethod

Recommended plot fields:

- area
- locationText
- gpsPoint
- boundaryGeoJson
- soilType
- irrigation
- mainCrop
- notes

Keep `gpsPoint` and `boundaryGeoJson` optional. Do not block onboarding on precise geodata.

## Non-Agriculture Examples

Education:

```json
{
  "domain": "education",
  "profile": "Grade 8 Science",
  "entities": [
    { "entityType": "class", "name": "M2/1" },
    { "entityType": "student", "name": "Student A" },
    { "entityType": "assessment", "name": "Photosynthesis quiz" }
  ]
}
```

Clinic:

```json
{
  "domain": "clinic",
  "profile": "Community Clinic",
  "entities": [
    { "entityType": "patient", "name": "Patient code P-102" },
    { "entityType": "visit", "name": "Follow-up visit" }
  ]
}
```

Sales:

```json
{
  "domain": "sales",
  "profile": "SME Pipeline",
  "entities": [
    { "entityType": "client", "name": "ABC Foods" },
    { "entityType": "deal", "name": "POS rollout" }
  ]
}
```

## API Routes

Use Zod validation in every route.

Recommended endpoints:

```txt
GET    /api/domain-profiles
POST   /api/domain-profiles
GET    /api/domain-profiles/[profileId]
PATCH  /api/domain-profiles/[profileId]
DELETE /api/domain-profiles/[profileId]

GET    /api/domain-profiles/[profileId]/entities
POST   /api/domain-profiles/[profileId]/entities
GET    /api/domain-profiles/[profileId]/entities/[entityId]
PATCH  /api/domain-profiles/[profileId]/entities/[entityId]
DELETE /api/domain-profiles/[profileId]/entities/[entityId]
```

Do not put business logic in route files. Routes should auth, parse, call service, and return JSON.

## UI Surface

Initial UI can be small.

Recommended v1:

- Settings section: "Professional profiles".
- Profile list.
- Entity list grouped by entity type.
- Manual add/edit dialog.
- Optional "complete setup" conversational prompt in chat.

Agriculture-specific UI is not required for v1. If added later, it should consume the generic profile/entity APIs.

## Permissions And Privacy

Rules:

- Profiles are private to the owner by default.
- Brand/workspace profiles should follow workspace permissions.
- Unlinked LINE profiles are scoped by `channelId` plus `lineUserId`.
- Never expose another LINE user's profile in group chats.
- Group chats should use group-scoped context only when the user explicitly creates it for the group.
- Mutating agent tools must ask for confirmation.

## Migration Plan

Phase 1: Add schema and service.

- [x] Add `db/schema/domain-profiles.ts`.
- [x] Export it from `db/schema.ts`.
- [x] Add queries/mutations/services.
- [x] Add migration SQL for the new tables.
- [ ] Run a clean non-interactive `pnpm drizzle-kit generate` flow after the unrelated `agent.starter_tasks` / `starter_prompts` schema ambiguity is resolved.

Phase 2: Add agent tools.

- [x] Add `features/domain-profiles/manifest.ts`.
- [x] Add `features/domain-profiles/agent.ts`.
- [x] Register in server and client tool registries.
- [x] Add tests for mutation confirmation assumptions and registry wiring.

Phase 3: Add prompt context.

- [x] Add compact context renderer.
- [x] Inject into chat route and LINE route.
- [x] Keep memory, working memory, and domain profiles separate.

Phase 4: Connect record keeper.

- [x] Extend record keeper schema with optional `metadata`.
- [x] Persist metadata in `runLogActivity`.
- [x] Teach agriculture skill to attach profile/entity IDs when available.

Phase 5: Agriculture pilot.

- [x] Update `farm-record-keeper` skill instructions.
- [x] Add optional farm setup conversation.
- [x] Add plot and crop-cycle entity examples.
- [x] Keep GPS/boundaries optional.

Phase 6: Broaden to other professions.

- Add education, clinic, sales, and creator profile definitions as skill packages.
- Avoid platform-core changes unless multiple domains need the same primitive.

## Testing Checklist

- Signed-in user can create, read, update, and delete own profile.
- User cannot access another user's profile.
- Unlinked LINE user can create temporary profile scoped to `channelId` and `lineUserId`.
- Linking a LINE account migrates LINE-scoped profiles to `userId`.
- Agent tool cannot mutate without approval.
- Chat prompt includes compact profile context only when relevant.
- Record keeper can store activity with profile/entity metadata.
- Agriculture skill uses the generic tools without farm-specific core code.
- Non-agriculture profile can be created with the same APIs.

## AI Coder Guardrails

When implementing this feature:

- Keep core table names domain-neutral.
- Do not create `farmProfile`, `plot`, or `cropCycle` tables in platform core.
- Put agriculture-specific behavior in skills, definitions, or optional helper modules.
- Keep `userMemory` for personal facts only.
- Keep `activityRecord` as the log/event layer.
- Keep `domainProfile` and `domainEntity` as structured operational context.
- Keep route handlers thin.
- Use `pnpm`.
- Use `@/` imports.
- Do not import `service.ts` into client components.
- Do not modify `components/ui/`.

## Recommended First Slice

Build the smallest useful version:

1. `domainProfile` and `domainEntity` tables.
2. Service functions for CRUD and ownership checks.
3. Agent tools for create/update/find.
4. Prompt renderer for compact context.
5. LINE migration support.
6. Record keeper metadata support.
7. Agriculture skill update that uses `domain=agriculture`, `entityType=plot`, and `entityType=crop_cycle`.

This gives Vaja farm-level insight for the pilot while preserving the larger vision: any profession can bring its own structured context through skills.
