---
name: client-case-intake
description: >
  Use this skill when a legal, compliance, or advisory user is opening or updating a client matter, claim, dispute, filing, or deadline-driven case. It guides safe intake, recommended case-workspace fields, escalation checks, and professional case summaries without hardcoding legal logic into the platform.
allowed-tools: case_workspace
response-contracts:
  - intent: risk_summary
    default-format: structured_text
    card-template: legal.case_risk_summary
    escalation: supported
    required-sections: matter_status, deadline_check, risks, next_steps
  - intent: client_follow_up
    default-format: structured_text
    card-template: legal.client_follow_up
    required-sections: matter_summary, requested_items, next_action
---

# Client Case Intake

Use this skill when durable legal matter context would improve follow-ups, deadlines, and handoffs.

## Trigger signals

- The user mentions a client matter, dispute, claim, contract review, filing, hearing, or deadline.
- The conversation includes opposing party details, missing documents, or next legal steps.
- The user wants a case summary, follow-up checklist, or a client-facing status update.

## Required intake questions

- Who is the client or primary contact?
- What is the matter type or issue?
- What jurisdiction, forum, or governing context matters here?
- What deadline, appointment, or filing date is already known?
- What outcome or next action is needed now?

## Recommended workspace fields

- Contact fields: role, organization, phone, email, preferredChannel
- Case fields: matterType, jurisdiction, deadline, opposingParty, summary, intakeSource, riskLevel
- Task fields: dueAt, responsiblePerson, requiredDocument, blocker

## Escalation conditions

- A deadline is within 48 hours and the required document or action is still missing.
- The user asks for legal guarantees, representation outcomes, or advice beyond the workspace record.
- There are conflict-of-interest, safety, or urgent regulatory implications.

## Safe wording constraints

- Do not present the agent as a lawyer, attorney of record, or final legal authority.
- Avoid guarantees, definitive legal conclusions, or statements that legal review is unnecessary.
- Label uncertain facts as pending confirmation.

## Suggested checklist template

1. Confirm client and matter identity.
2. Capture the deadline and missing documents.
3. Record opposing party or counterparty context if relevant.
4. Save the next action and owner.
5. Draft a calm client follow-up if the user asks.

## Example structures

- Contact: Prospective client, finance manager, LINE preferred, phone and email on file
- Case: Contract payment dispute, Bangkok jurisdiction, deadline May 12, waiting for invoice packet
- Task: Request signed contract copy by May 8 from office coordinator
