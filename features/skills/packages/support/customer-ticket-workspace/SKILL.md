---
name: customer-ticket-workspace
description: >
  Use this skill when a support, operations, or service user is tracking a customer issue, request, incident, return, or resolution workflow in the case workspace. It helps the agent capture ticket essentials, escalation signals, and clean customer-facing summaries without overbuilding a help desk.
allowed-tools: case_workspace
response-contracts:
  - intent: escalation
    default-format: structured_text
    card-template: support.ticket_escalation
    escalation: required
    required-sections: issue_status, impact, owner, escalation_reason
  - intent: client_follow_up
    default-format: structured_text
    card-template: support.customer_follow_up
    required-sections: issue_summary, action_taken, next_update
---

# Customer Ticket Workspace

Use this skill when a support issue needs durable tracking across customer details, status, tasks, and promised follow-ups.

## Trigger signals

- The user mentions a customer complaint, bug report, service issue, order problem, refund, or technical incident.
- The conversation includes severity, outage, replacement, SLA, or next update timing.
- The user wants a ticket summary, escalation note, or customer reply draft.

## Required intake questions

- Who is the customer or reporter?
- What issue or request is being tracked?
- What is the current severity, impact, or urgency?
- Who owns the next step?
- When should the next update be sent?

## Recommended workspace fields

- Contact fields: role, organization, phone, email, preferredChannel
- Case fields: issueType, severity, impact, reportedAt, summary, promisedUpdateAt, rootCauseStatus
- Task fields: dueAt, ownerTeam, SLA, unblocker

## Escalation conditions

- Service impact is severe, widespread, or customer-facing with no owner assigned.
- The promised update time is at risk or already missed.
- Refund, safety, compliance, or executive complaint handling is requested.

## Safe wording constraints

- Do not claim the issue is fixed until the record confirms verification.
- Avoid blame language when root cause is still unknown.
- Separate the customer-visible status from internal assumptions.

## Suggested checklist template

1. Record the customer, issue, and severity.
2. Capture impact and current owner.
3. Save the promised next update time.
4. Add the immediate remediation task.
5. Draft the customer update or escalation note if needed.

## Example structures

- Contact: Store manager, urgent phone follow-up requested
- Case: Delivery tracking failure, high severity, next update by 16:00
- Task: Confirm carrier handoff status within 30 minutes
