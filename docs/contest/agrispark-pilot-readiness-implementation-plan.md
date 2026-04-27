# AgriSpark Pilot Readiness Implementation Plan

Status: active working plan  
Last updated: 2026-04-27  
Goal: get Vaja Kaset ready for committee video, live demo, and a small farmer pilot without pretending we are already at full production readiness.

Canonical document: `docs/contest/agrispark-pilot-readiness-implementation-plan.md`  
Note: `docs/contest/AgriSpark Pilot Readiness Implementation Plan` is an empty duplicate placeholder and should not be used as the source of truth.

## Pilot Readiness Snapshot

Overall readiness for AgriSpark committee demo: partial, with clear blockers remaining.

| Workstream | Status | Notes |
| --- | --- | --- |
| Farm Advisor agent + core skills | In progress | Text diagnosis and record summary now pass generated QA; remaining polish is mainly photo-response language cleanup and external skill-source sync |
| Record keeper | Implemented | Canonical `record_keeper` tool exists and is usable for farm logs |
| LINE OA channel + rich menu setup | In progress | Setup scripts and member-menu flow exist; real channel deployment still needs finishing |
| LINE text canonical agent path | Implemented | Text messages already go through `prepareAgentRun()` and `runAgentText()` |
| LINE photo canonical agent path | Implemented | Photo now derives an observation first, then runs through canonical agent execution with skills/tools |
| LINE voice canonical agent path | Implemented | Voice now transcribes first, then runs through canonical agent execution before TTS reply |
| Real weather | Implemented | `lib/tools/weather.ts` now uses Open-Meteo geocoding and forecast data with farm-risk summaries |
| Agriculture safety contract | In progress | Contract is reinforced in both in-repo seed paths and local shared agriculture skill prompts; generated QA now highlights remaining live-output drift |
| Demo evidence capture | In progress | Evidence scaffold plus generated transcript pack now exist with heuristic PASS/FAIL checks; screenshots and reviewer notes still need to be captured |

## Demo Go / No-Go Checklist

Current demo decision: `NO-GO for live committee demo`, `GO for internal implementation/testing`.

Go only when all required checks are complete:

| Requirement | Status | Owner file or artifact |
| --- | --- | --- |
| Weather returns real forecast data for Bangkok and Chiang Mai | Done | `lib/tools/weather.ts` |
| LINE text, photo, and voice all run through canonical Farm Advisor execution | Done | `features/line-oa/webhook/events/message.ts` |
| Farm Advisor diagnosis output uses the pilot response contract | Partial | Text diagnosis and record summary now pass generated QA; photo diagnosis still needs minor Thai-language cleanup to avoid heuristic false positives |
| Safety language covers uncertainty, label/PPE, and officer escalation | Partial | In-repo prompts reinforce these rules and generated QA is live, but output stability is not yet high enough to mark done |
| Real LINE OA rich menus are deployed and assigned | In progress | `scripts/setup-agrispark-line-oa.mjs`, LINE OA control room |
| Six evidence scenarios are captured | Partial | `docs/contest/agrispark-demo-evidence.md`, `docs/contest/agrispark-demo-evidence-generated.md`; generated QA now passes text diagnosis, weather risk, voice log, and record summary, with photo diagnosis needing minor Thai-language cleanup |
| Type-check passes | Done | `pnpm exec tsc --noEmit` |

Demo can proceed live only after the first five rows are complete. Evidence capture is required as backup before submission or committee handoff.

## Scope For This Milestone

This milestone is about pilot readiness, not full TRL 9.

Included:

- real weather via Open-Meteo
- reliable LINE text/photo/voice skill activation
- agriculture-specific response safety and formatting
- a small curated agriculture reference pack
- demo scripts and evidence capture
- manual pilot-review notes and basic quality tracking

Explicitly not included:

- automated outbreak detection
- regional outbreak heatmaps
- full farm/plot registry
- per-farmer credit caps in LINE
- production analytics or scoring pipelines

## What Is Already Implemented

### 1. Seeded Farm Advisor foundation

- `record_keeper` exists under `features/record-keeper/` with canonical service functions for log, read, and summarize flows.
- AgriSpark/Farm Advisor seeding scripts exist:
  - `scripts/create-agrispark-agent.mjs`
  - `scripts/setup-agrispark-line-oa.mjs`
- The AgriSpark agent ID is already defined as `agrispark-farm-assistant-001`.
- Rich-menu member swap plumbing exists through `member_rich_menu_line_id` in `db/schema/line-oa.ts`.

### 2. Canonical text path in LINE already exists

For plain text LINE messages, the webhook already routes through:

- `prepareAgentRun()`
- `buildLineToolSet()`
- `runAgentText()`

That is a strong base for the demo because tool calling and skill-aware prompt assembly are already available on the text path.

### 3. Skills runtime plumbing exists

The codebase already has:

- `resolveAgentSkillRuntime()` in `features/agents/server/runtime.ts`
- skills activation and resource-loading support in `features/skills/`
- chat-route and agent-run integration already wired into the platform

This means the missing work is mostly about passing the right derived user content into the same path consistently, not inventing a new architecture.

## Implementation Map

Use this as the file-level checklist while implementing the remaining work.

| Area | Primary files | Expected change |
| --- | --- | --- |
| Real weather | `lib/tools/weather.ts` | Replace random temperature with Open-Meteo geocoding and forecast lookup |
| Tool registration check | `lib/tools/index.ts`, `features/tools/registry/server.ts` | Confirm weather tool remains available to agent/tool paths |
| LINE photo path | `features/line-oa/webhook/events/message.ts` | Convert image to concise observation, then call canonical agent run with the derived text |
| LINE voice path | `features/line-oa/webhook/events/message.ts` | Transcribe first, then call canonical agent run with transcript and preserve TTS reply |
| Agent run helper reuse | `features/agents/server/run-service.ts`, `features/agents/server/run-helpers.ts` | Reuse existing canonical execution instead of adding separate LINE-only business logic |
| Skill activation | `features/agents/server/runtime.ts`, `features/skills/server/activation.ts` | Ensure derived photo/voice text is what `resolveAgentSkillRuntime()` scores |
| LINE tool set | `features/line-oa/webhook/tools.ts` | Confirm `weather` and `record_keeper` work in LINE agent runs |
| Farm Advisor prompt | `scripts/create-agrispark-agent.mjs`, `scripts/seed-agents.ts` | Add the diagnosis/safety response contract to seeded agent prompts |
| Agriculture references | Skill package source, imported skill files, or `features/skills/packages/` if committed locally | Add or verify crop disease and safety references |
| Rich menu setup | `scripts/setup-agrispark-line-oa.mjs`, `features/line-oa/components/rich-menu-panel.tsx` | Deploy default/member menus and verify member menu assignment |
| Evidence capture | `docs/contest/agrispark-demo-evidence.md` | Store scenario inputs, transcripts, screenshots, and reviewer notes |

## Critical Gaps To Close

### 1. Replace fake weather with real Open-Meteo

Current state:

- `lib/tools/weather.ts` still returns a random Fahrenheit temperature.

Required implementation:

- geocode Thai or English place names
- fetch current weather plus 7-day forecast from Open-Meteo
- return structured output:
  - `location`
  - `current`
  - `daily`
  - `riskSummary`
  - `source`
- add farm-meaningful signals for rainfall, heat, wind, and simple field-risk flags
- fail cleanly when location is missing or geocoding fails

Progress: `Implemented`

Definition of done:

- Bangkok and Chiang Mai return real data
- invalid location returns a graceful explanation
- Farm Advisor can translate the structured output into 3-7 day farm-risk advice

Implementation notes:

- Use Open-Meteo geocoding first, then forecast API.
- Prefer Celsius, millimeters, and km/h in returned fields because the Farm Advisor serves Thai farmers.
- Keep the existing tool ID `weather`; changing the ID would break enabled tool settings and skill unlocks.

### 2. Move LINE photo into the canonical agent path

Current state:

- photo messages are analyzed directly with `generateText()` against the image
- conversation stores `[Image]`
- reply is useful, but it bypasses the main skill/tool-capable agent execution path

Required implementation:

- derive a short observation from the image first
- run the canonical agent path using that observation plus a tag such as `[Farmer sent photo]`
- make sure stored conversation includes both:
  - `[Image]`
  - derived text observation
- resolve skill runtime against the derived observation, not an empty string

Progress: `Implemented`

Definition of done:

- a plant photo can activate pest/disease skills and weather or record flows when relevant
- the same Farm Advisor output contract appears for photo and text

Implementation notes:

- Keep slip verification before farm-photo analysis so payment flows continue to work.
- Derive the observation with a short vision call, then pass text such as `[Farmer sent photo] Observation: ...` into the canonical run.
- Avoid storing raw image bytes in chat history; store the user marker and derived observation.

### 3. Move LINE voice into the canonical agent path

Current state:

- voice notes are transcribed with Gemini
- stored conversation includes `[Voice] {transcript}`
- reply still goes through direct `generateText()` instead of canonical agent execution

Required implementation:

- keep the transcription step
- run the transcript through `prepareAgentRun()` and `runAgentText()`
- resolve skill runtime from the transcript
- preserve TTS voice reply after the canonical text answer is produced

Progress: `Implemented`

Definition of done:

- Thai voice notes activate the same skills and tools as equivalent typed text
- farm-log voice notes can reach `record_keeper`

Implementation notes:

- Keep the existing transcript display so farmers can see what the system heard.
- Send TTS after the canonical reply is generated.
- Use the transcript for memory extraction and skill activation.

### 4. Add the agriculture response contract

Current state:

- the seeded agent prompt has useful constraints, but it does not yet guarantee the pilot response structure we want for committee judging and safety review

Required response sections for Farm Advisor:

- likely issue
- confidence
- severity
- immediate action
- prevention
- when to contact an extension officer

Safety rules to enforce:

- no overconfident diagnosis
- no chemical brand promotion
- prefer active ingredient + label + PPE language
- escalate severe, fast-moving, or ambiguous cases
- keep formatting friendly to current LINE plain-text/Flex rendering

Progress: `In progress`

Definition of done:

- pest and disease answers reliably render in a consistent structure
- ambiguous cases clearly state uncertainty
- severe cases recommend extension-officer escalation

Implementation notes:

- Put this in the Farm Advisor prompt and the pest/disease skill so both agent-level and skill-level behavior reinforce each other.
- Use plain labels and bullet points; do not require a new Flex template for this milestone.
- Avoid brand names in examples, even in demo scripts, unless the point is to show the system correcting or generalizing them.

### 5. Finalize the agriculture reference pack

Current state:

- AgriSpark skills and attachments are seeded
- reference quality is described in planning docs, but this milestone still needs a committee-ready curated pack

Required reference topics:

- tomato early blight
- rice blast
- cassava mealybug
- cassava mosaic
- longan anthracnose
- pesticide safety
- Thai escalation contacts

Rule:

- keep domain knowledge in skills and reference files, not hardcoded into platform logic

Progress: `In progress`

Definition of done:

- each priority topic exists in skill/reference content
- outputs reflect those references in a stable way during demo runs

Implementation notes:

- If the active skill content is managed outside this repo, record the source path or import URL in this document after updating it.
- If we commit local skill-package files, keep them under a skill package directory and preserve standard `SKILL.md` frontmatter.

### 6. Finish LINE OA demo deployment

Current state:

- setup script exists
- draft menus can be created
- member-menu switching plumbing exists
- a temporary test channel has already been used according to planning notes

Still needed:

- connect the final demo channel
- deploy both menus to the real channel
- set default menu
- set member menu
- smoke-test registration and top-up flows on a real phone

Progress: `In progress`

Definition of done:

- committee demo account works end to end on an actual LINE client

Implementation notes:

- Run `scripts/setup-agrispark-line-oa.mjs <channelId>` only against the intended demo channel.
- After deployment, record the channel name, default menu ID, and member menu ID in the progress log.

### 7. Create a demo evidence pack

Current state:

- scenario ideas exist in `docs/contest/agrispark-plan.md` and `docs/contest/agrispark-committee-answers.md`
- actual captured evidence is still missing

Required evidence set:

1. text diagnosis
2. photo diagnosis
3. voice farm log
4. weather risk
5. record summary
6. officer broadcast

For each scenario capture:

- prompt or input
- response transcript
- screenshot
- short reviewer note
- safety/quality note

Progress: `In progress`

Definition of done:

- we have a committee backup pack even if the live demo is imperfect

Implementation notes:

- Preferred doc path: `docs/contest/agrispark-demo-evidence.md`.
- Screenshots can live beside the doc in a dated folder if needed.
- Mark whether each transcript is live output, scripted expected output, or manually cleaned for readability.

## Progress Checklist

### Done

- [x] Build `record_keeper` canonical tool
- [x] Seed AgriSpark/Farm Advisor agent
- [x] Attach agriculture skills to the seeded agent
- [x] Create AgriSpark LINE OA setup script
- [x] Add member rich-menu support in LINE OA schema and flow
- [x] Route LINE text through canonical agent execution

### In progress

- [ ] Finalize agriculture reference pack
- [ ] Deploy real demo LINE channel and menus
- [ ] Thai-language and safety QA across skill responses
- [ ] Sync the final response contract back to the external/imported agriculture skill source and verify live outputs

### Not done

- [ ] Capture committee-ready evidence pack with screenshots, reviewer notes, and final cleaned transcripts

### Completed in this pass

- [x] Replace placeholder weather with Open-Meteo
- [x] Route LINE photo through canonical agent execution
- [x] Route LINE voice through canonical agent execution
- [x] Add pilot diagnosis/safety contract to `scripts/create-agrispark-agent.mjs`
- [x] Reinforce the response contract in `scripts/seed-agents.ts` via in-repo agriculture prompt overrides
- [x] Create `docs/contest/agrispark-demo-evidence.md` scaffold
- [x] Add `scripts/run-agrispark-demo-scenarios.ts` and generate `docs/contest/agrispark-demo-evidence-generated.md`
- [x] Improve Thai location weather lookup fallback for common province names
- [x] Add canonical final-answer fallback for empty text responses after tool/model execution
- [x] Run focused unit tests for weather and agent run helpers
- [x] Run `pnpm exec tsc --noEmit`

## Recommended Implementation Order

1. Fix weather first.
2. Refactor photo and voice to use the canonical agent path.
3. Tighten the Farm Advisor response contract.
4. Finalize agriculture reference files.
5. Deploy the real demo channel and rich menus.
6. Run the six demo scenarios and capture evidence.

This order keeps the highest-risk demo failures on the front of the queue.

## Progress Log

| Date | Update | Evidence |
| --- | --- | --- |
| 2026-04-27 | Converted this file from a placeholder into the active pilot-readiness tracker | This document |
| 2026-04-27 | Added demo go/no-go checklist, file-level implementation map, implementation notes, and duplicate-file warning | This document |
| 2026-04-27 | Replaced placeholder weather with real Open-Meteo lookup plus farm-risk summary and added focused weather tests | `lib/tools/weather.ts`, `lib/tools/weather.test.ts` |
| 2026-04-27 | Routed LINE photo and voice messages through the canonical Farm Advisor execution path while preserving image observation and TTS behavior | `features/line-oa/webhook/events/message.ts` |
| 2026-04-27 | Added the pilot diagnosis/safety response contract to the AgriSpark seed prompt and verified the codebase with `pnpm exec tsc --noEmit` | `scripts/create-agrispark-agent.mjs` |
| 2026-04-27 | Aligned the shared in-repo Farm Advisor seed and agriculture skill prompts to the pilot contract using local overrides | `scripts/seed-agents.ts` |
| 2026-04-27 | Created the committee evidence-pack scaffold for the six required demo scenarios | `docs/contest/agrispark-demo-evidence.md` |
| 2026-04-27 | Added a scripted Farm Advisor scenario runner, generated a transcript pack, improved Thai weather alias handling, and added a canonical empty-reply fallback | `scripts/run-agrispark-demo-scenarios.ts`, `docs/contest/agrispark-demo-evidence-generated.md`, `lib/tools/weather.ts`, `features/agents/server/run-service.ts` |
| 2026-04-27 | Hardened the AgriSpark prompt contracts, added transcript QA checks to the demo runner, and added a final-answer rewrite pass for leaked tool-call syntax | `scripts/create-agrispark-agent.mjs`, `scripts/seed-agents.ts`, `scripts/run-agrispark-demo-scenarios.ts`, `features/agents/server/run-service.ts` |
| 2026-04-27 | Added deterministic farm-record summary formatting and a diagnosis-contract fallback so the generated evidence pack now passes text diagnosis and record-summary QA | `features/agents/server/run-service.ts`, `features/agents/server/run-helpers.ts`, `docs/contest/agrispark-demo-evidence-generated.md` |

## Acceptance Test Plan

Run after implementation:

- `pnpm exec tsc --noEmit`
- weather checks:
  - Bangkok
  - Chiang Mai
  - one invalid location
- LINE smoke tests:
  - Thai text pest question
  - plant photo diagnosis
  - Thai voice-note farm log
  - weather risk question
  - record summary
  - officer broadcast
- safety acceptance:
  - ambiguous case states uncertainty
  - severe case escalates to extension officer
  - chemical guidance avoids brands and includes label/PPE caution

## Delivery Standard For The Committee

We should consider this pilot-demo-ready only when:

- weather is real, not placeholder
- text, photo, and voice all use the same Farm Advisor path
- diagnosis-style responses follow one visible contract
- the LINE OA demo works on a real phone
- we have transcript and screenshot backup for all six scenarios

## Notes

- Default model remains `google/gemini-2.5-flash-lite` unless a specific demo path needs a stronger vision-capable model.
- Open-Meteo is the planned weather source for this milestone because it is good enough for a no-key pilot demo.
- No schema migration is required for the remaining pilot-readiness items unless we decide to add new evidence-tracking tables, which is out of scope for now.
