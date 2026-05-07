---
name: client-deal-workspace
description: >
  Use this skill when a sales, account, or business user is tracking a lead, client deal, quotation, negotiation, renewal, or follow-up sequence in the case workspace. It helps the agent capture the right deal fields, next actions, and client update formats while keeping CRM setup lightweight.
allowed-tools: case_workspace
response-contracts:
  - intent: client_follow_up
    default-format: structured_text
    card-template: sales.deal_follow_up
    required-sections: deal_status, buyer_signal, next_action
  - intent: record_saved
    default-format: card
    card-template: sales.deal_saved
    required-sections: account_name, stage, due_date
---

# Client Deal Workspace

Use this skill when a sales conversation needs continuity across contact details, deal stage, blockers, and follow-up dates.

## Trigger signals

- The user mentions a lead, client account, quotation, proposal, negotiation, renewal, or closing plan.
- The conversation includes stage changes, estimated value, procurement contacts, or next meeting dates.
- The user wants a follow-up message, pipeline summary, or task list.

## Required intake questions

- Which client or account is this for?
- What deal, renewal, or opportunity is being tracked?
- What stage, amount, or decision milestone is known?
- Who is the buyer or main contact?
- What is the next action and when should it happen?

## Recommended workspace fields

- Contact fields: role, organization, phone, email, preferredChannel
- Case fields: dealType, stage, expectedValue, closeDate, decisionMaker, summary, blocker
- Task fields: dueAt, ownerRole, outreachChannel, objective

## Escalation conditions

- Commercial terms are promised that the user has not confirmed.
- Procurement, legal review, or executive approval is blocking movement.
- The agent is asked to invent pricing, delivery dates, or contract approval status.

## Safe wording constraints

- Do not fabricate discount approvals, implementation commitments, or signed decisions.
- Keep deal confidence language probabilistic when facts are incomplete.
- Separate confirmed buyer signals from assumptions.

## Suggested checklist template

1. Confirm account, deal name, and stage.
2. Record buyer contact and decision timeline.
3. Save blockers and promised deliverables.
4. Add the next follow-up task with due date.
5. Draft the client message if asked.

## Example structures

- Contact: Procurement lead, ABC Foods, email preferred
- Case: POS rollout proposal, negotiation stage, target close May 28
- Task: Send revised quotation by May 10 after finance approval
