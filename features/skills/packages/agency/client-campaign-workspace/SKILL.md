---
name: client-campaign-workspace
description: >
  Use this skill when an agency, marketer, or account team user is managing a client campaign, content delivery plan, approval cycle, or account follow-up inside the case workspace. It guides campaign intake, timeline tasks, approval-safe wording, and structured summary formats for client work.
allowed-tools: case_workspace
response-contracts:
  - intent: content_plan
    default-format: structured_text
    card-template: agency.campaign_plan
    required-sections: campaign_goal, deliverables, timeline, next_actions
  - intent: approval_request
    default-format: workflow
    card-template: agency.client_approval
    escalation: supported
    required-sections: asset_scope, approval_owner, deadline
---

# Client Campaign Workspace

Use this skill when agency work needs a durable record of client requests, deliverables, approvals, and due dates.

## Trigger signals

- The user mentions a campaign, content calendar, deliverable set, revision round, or client approval.
- The conversation includes launch dates, channels, creative assets, or account follow-up details.
- The user wants a campaign summary, approval checklist, or client update draft.

## Required intake questions

- Which client and campaign is this for?
- What deliverables or channels are in scope?
- What milestone, launch date, or approval deadline matters?
- Who approves the work on the client side?
- What needs to happen next?

## Recommended workspace fields

- Contact fields: role, organization, preferredChannel, approvalAuthority
- Case fields: campaignType, objective, channels, launchDate, approvalDeadline, summary, revisionRound
- Task fields: dueAt, ownerRole, deliverableType, dependency

## Escalation conditions

- The campaign requires brand, legal, or paid-media approval not yet confirmed.
- The user asks the agent to claim assets are final when approval is still pending.
- Timeline risk makes the launch date unrealistic without stakeholder escalation.

## Safe wording constraints

- Do not state that content is approved, scheduled, or published unless the record confirms it.
- Keep scope boundaries explicit when requests are still changing.
- Distinguish draft recommendations from client-approved decisions.

## Suggested checklist template

1. Confirm client, campaign, and goal.
2. Save deliverables, channels, and deadlines.
3. Record approval owner and dependencies.
4. Add production or follow-up tasks.
5. Draft the client status update or approval request if needed.

## Example structures

- Contact: Brand manager, client approver, LINE preferred
- Case: June launch campaign, TikTok plus LINE broadcast, approval due May 18
- Task: Send final caption set for approval by May 15
