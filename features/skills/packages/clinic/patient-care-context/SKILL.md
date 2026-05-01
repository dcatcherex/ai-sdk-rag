---
name: patient-care-context
description: >
  Use this skill when a clinic, care team, or health-support user shares structured operating context such as specialty, patient codes, visit types, follow-up rules, or communication constraints. It helps the agent store lightweight clinic context with generic domain profile tools while avoiding heavy intake flows.
allowed-tools: domain_profiles
---

# Patient Care Context

Use this skill when structured clinic context would make future replies safer, more consistent, or easier to continue.

## Core behavior

- Keep setup optional and lightweight.
- Confirm before saving any persistent structured data.
- Prefer minimal identifiers such as patient code instead of sensitive personal details.
- Ask only for the smallest amount of context needed to help.
- Use `domain_profiles` tools only after clear user confirmation.

## Good profile fields

- clinicName
- specialty
- visitType
- communicationConstraints
- followUpPolicy

## Good entity examples

- `patient`: Patient code P-102, concern, risk flags
- `visit`: Follow-up visit, visit type, follow-up date
- `care_note`: Diabetes education note, summary, next action

## Workflow

1. Notice signals like clinic name, specialty, patient code, follow-up schedule, or care protocol.
2. If the user needs immediate drafting or support, help first.
3. If structured clinic context would help, offer to remember it in a compact way.
4. After explicit confirmation, write the profile or entities with `domain_profiles`.
5. Do not force full patient intake or sensitive demographic capture before helping.
