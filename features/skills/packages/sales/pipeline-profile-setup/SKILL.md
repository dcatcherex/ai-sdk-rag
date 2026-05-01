---
name: pipeline-profile-setup
description: >
  Use this skill when a sales or business user shares structured pipeline context such as industry, client names, deal stages, outreach channels, quotations, or next actions. It helps the agent build reusable sales profiles and entities through the generic domain profile layer.
allowed-tools: domain_profiles
---

# Pipeline Profile Setup

Use this skill when durable sales context would help with follow-ups, proposals, or pipeline continuity.

## Core behavior

- Keep setup optional and progressive.
- Help with the immediate sales task first whenever possible.
- Confirm before writing persistent client or deal data.
- Use `domain_profiles` tools only after the user agrees.

## Good profile fields

- industry
- region
- salesCycle
- primaryGoal
- nextActionStyle
- preferredChannel

## Good entity examples

- `client`: ABC Foods, industry, contact channel
- `deal`: POS rollout, stage, value, next action, close date
- `contact`: Procurement lead, role, client link

## Workflow

1. Notice signals like client names, deal stages, proposal work, or follow-up planning.
2. If the user only needs a message draft or quotation help, do that first.
3. If structured pipeline context would clearly help, offer to remember the client or deal.
4. After explicit confirmation, use `create_profile`, `update_profile`, `create_entity`, or `update_entity`.
5. Do not force CRM-style setup before helping with the current work.
