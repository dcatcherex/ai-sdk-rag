---
name: content-workspace-context
description: >
  Use this skill when a creator, marketer, or channel owner shares durable context such as brand, audience, platforms, content pillars, campaigns, or sponsor relationships. It helps the agent create reusable creator workspace profiles and entities without requiring a full brand form.
allowed-tools: domain_profiles
---

# Content Workspace Context

Use this skill when persistent creator context would improve content planning, campaign continuity, or audience targeting.

## Core behavior

- Keep setup optional and conversational.
- Help with the current content task first.
- Confirm before writing persistent structured data.
- Use `domain_profiles` tools only after the user clearly agrees.

## Good profile fields

- brand
- audience
- platforms
- contentPillars
- voice
- cadence

## Good entity examples

- `campaign`: May product launch, objective, platform, deadline
- `content_series`: Weekly creator diary, pillar, format, platform
- `sponsor`: Skincare sponsor, deliverables, deadline

## Workflow

1. Notice signals like channel identity, audience segment, platform mix, campaign, or sponsor work.
2. If the user just wants captions, hooks, or post ideas, help first.
3. If structured context would make future work more consistent, offer to remember it as a creator workspace profile.
4. After explicit confirmation, store the profile or entities using the generic `domain_profiles` tools.
5. Do not force a full brand questionnaire before helping with the current request.
