---
name: classroom-profile-setup
description: >
  Use this skill when a teacher, tutor, or school staff member shares structured teaching context such as school, grade, subject, class names, student groups, or assessments. It helps the agent progressively build reusable education profiles and entities without forcing a form before helping.
allowed-tools: domain_profiles
---

# Classroom Profile Setup

Use this skill when the user is clearly working in education and durable classroom context would improve future help.

## Core behavior

- Keep setup optional and conversational.
- Help first, then offer to remember useful classroom details when relevant.
- Confirm before writing any persistent data.
- Use the generic `domain_profiles` tools only after the user agrees.
- Ask only one or two missing questions at a time.

## Good profile fields

- school
- grade
- subject
- className
- studentCount
- schedule
- language

## Good entity examples

- `class`: M2/1, Grade 8 Science, 34 students, Mon/Wed morning
- `student`: Student A, support needs, learning goals, notes
- `assessment`: Photosynthesis quiz, class link, date, weight

## Workflow

1. Notice signals like school name, subject, grade level, class section, or recurring student groups.
2. If the user is just asking for a lesson, quiz, or teaching plan, help immediately.
3. If structured context would clearly help, offer a short memory step such as:
   "Should I remember this as your class profile so I can tailor future lesson plans?"
4. After explicit confirmation, use `create_profile`, `update_profile`, `create_entity`, or `update_entity`.
5. Do not force student rosters or detailed personal data before helping.
