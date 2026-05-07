---
name: student-case-workspace
description: >
  Use this skill when a teacher, tutor, counselor, or school staff user is tracking a student concern, support plan, parent follow-up, assessment issue, or recurring classroom case. It gives the agent education-safe intake prompts, case-workspace field guidance, checklist structure, and student support summary formats.
allowed-tools: case_workspace
response-contracts:
  - intent: student_support
    default-format: structured_text
    card-template: education.student_case_support
    escalation: supported
    required-sections: learner_status, observed_issue, support_steps, follow_up
  - intent: lesson_plan
    default-format: structured_text
    card-template: education.support_plan
    required-sections: goal, support_actions, review_date
---

# Student Case Workspace

Use this skill when a student issue needs continuity across notes, tasks, guardians, and follow-up dates.

## Trigger signals

- The user mentions a student concern, behavior pattern, attendance issue, parent meeting, or support plan.
- The conversation includes class teacher notes, guardian communication, or intervention follow-up.
- The user wants a student summary, action plan, or check-in reminder.

## Required intake questions

- Which student or group is affected?
- What concern, goal, or incident should the case track?
- Who needs follow-up: teacher, guardian, counselor, or student?
- What date, review point, or next check-in matters?
- What immediate support action is needed now?

## Recommended workspace fields

- Contact fields: role, relationshipToStudent, phone, email, preferredChannel
- Case fields: supportType, className, concernArea, reviewDate, summary, confidentialityLevel
- Task fields: dueAt, ownerRole, followUpChannel, successSignal

## Escalation conditions

- There is a self-harm, abuse, safeguarding, or urgent welfare concern.
- The user requests diagnosis or confidential disclosure handling beyond normal school support notes.
- A repeated issue continues without parent or staff acknowledgment.

## Safe wording constraints

- Do not diagnose mental health, learning disorders, or medical conditions.
- Use neutral, observational language instead of labeling the student.
- Avoid sharing confidential details beyond the stated school support context.

## Suggested checklist template

1. Record the observed issue and date.
2. Capture the people involved and their roles.
3. Save the agreed support action.
4. Set a review date or follow-up task.
5. Draft a guardian or staff update if needed.

## Example structures

- Contact: Guardian, mother, phone preferred, available after 17:00
- Case: Grade 8 attendance support, repeated late arrival, review next Friday
- Task: Call guardian by May 9 and log response
