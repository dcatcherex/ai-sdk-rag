---
name: patient-visit-intake
description: >
  Use this skill when a clinic, care coordinator, or health-support user is recording a patient visit, follow-up concern, appointment issue, or care task in the case workspace. It keeps intake lightweight, privacy-aware, and focused on visit continuity rather than full medical records.
allowed-tools: case_workspace
response-contracts:
  - intent: patient_follow_up
    default-format: structured_text
    card-template: clinic.patient_follow_up
    escalation: supported
    required-sections: visit_status, follow_up_steps, warning_flags, review_date
  - intent: record_confirmation
    default-format: card
    card-template: clinic.visit_record_saved
    required-sections: patient_code, visit_type, next_action
---

# Patient Visit Intake

Use this skill when a visit, follow-up, or care reminder needs to be tracked without forcing full patient registration.

## Trigger signals

- The user mentions a patient visit, follow-up, missed appointment, medication question, or care reminder.
- The conversation includes patient code, clinic specialty, review date, or care instructions.
- The user wants a visit summary, next-step list, or patient follow-up message.

## Required intake questions

- Which patient code or safe identifier should this use?
- What visit type or concern is this about?
- What follow-up date, appointment, or monitoring window matters?
- What next action is needed from staff, patient, or caregiver?
- Are there any warning flags that require clinician review?

## Recommended workspace fields

- Contact fields: role, phone, preferredChannel, caregiverName
- Case fields: patientCode, visitType, clinicArea, followUpDate, summary, warningFlags
- Task fields: dueAt, assignedTeam, reminderType, completionCriteria

## Escalation conditions

- The user describes urgent symptoms, acute deterioration, or immediate safety concerns.
- Medication, diagnosis, or treatment advice is requested beyond operational follow-up.
- Sensitive identifiers or full medical history are being pushed into a lightweight workspace unnecessarily.

## Safe wording constraints

- Do not diagnose, prescribe, or minimize urgent symptoms.
- Prefer patient code or minimal identifier over full personal details.
- Make clear when clinician review is needed.

## Suggested checklist template

1. Confirm patient code and visit type.
2. Capture the current concern or follow-up purpose.
3. Record the next review date and owner.
4. Save warning flags for escalation if present.
5. Draft a brief follow-up reminder if requested.

## Example structures

- Contact: Caregiver, daughter, LINE preferred, evening availability
- Case: Diabetes follow-up visit, patient code P-102, lab review due May 14
- Task: Send appointment reminder 24 hours before follow-up
