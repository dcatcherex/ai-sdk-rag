import { tool } from 'ai';

import type { AgentToolContext } from '@/features/tools/registry/types';

import {
  addCaseNote,
  createCase,
  createContact,
  createTask,
  getCaseContext,
  searchCases,
  summarizeCase,
  updateCase,
} from './service';
import {
  createCaseInputSchema,
  createContactInputSchema,
  createTaskInputSchema,
  createTimelineNoteInputSchema,
  getCaseContextInputSchema,
  searchCasesInputSchema,
  summarizeCaseInputSchema,
  updateCaseInputSchema,
} from './schema';

function buildOwnerContext(ctx: Pick<AgentToolContext, 'userId' | 'brandId'>) {
  return {
    userId: ctx.userId,
    brandId: ctx.brandId ?? null,
  };
}

export function createCaseWorkspaceAgentTools(
  ctx: Pick<AgentToolContext, 'userId' | 'brandId'>,
) {
  const owner = buildOwnerContext(ctx);

  return {
    get_case_context: tool({
      description:
        "Load one case with its contact, tasks, notes, and recent timeline. Use this before drafting a reply or suggesting next actions for a client, case, project, visit, deal, ticket, claim, campaign, lesson, or order.",
      inputSchema: getCaseContextInputSchema,
      async execute({ caseId }) {
        const context = await getCaseContext(caseId, owner);
        if (!context) {
          return {
            success: false,
            message: 'Case not found or not accessible.',
          };
        }

        return {
          success: true,
          kind: 'case_context',
          ...context,
        };
      },
    }),

    search_cases: tool({
      description:
        'Find professional cases, projects, visits, deals, tickets, claims, campaigns, lessons, or orders by name, status, priority, or summary.',
      inputSchema: searchCasesInputSchema,
      async execute(input) {
        const cases = await searchCases(input, owner);
        return {
          success: true,
          kind: 'case_context',
          cases,
          count: cases.length,
        };
      },
    }),

    create_contact: tool({
      description:
        'Create a new contact, client, customer, student, patient, lead, vendor, candidate, or partner in the user case workspace. Always confirm before writing persistent data.',
      inputSchema: createContactInputSchema,
      needsApproval: true,
      async execute(input) {
        const contact = await createContact(input, owner);
        return {
          success: true,
          kind: 'case_saved',
          contact,
          message: `Created contact "${contact.name}".`,
        };
      },
    }),

    create_case: tool({
      description:
        'Create a professional case, project, visit, deal, ticket, claim, campaign, lesson, or order inside the user case workspace. Always confirm before writing persistent data.',
      inputSchema: createCaseInputSchema,
      needsApproval: true,
      async execute(input) {
        const createdCase = await createCase(input, owner);
        return {
          success: true,
          kind: 'case_saved',
          case: createdCase,
          message: `Created case "${createdCase.name}".`,
        };
      },
    }),

    update_case: tool({
      description:
        'Update case status, priority, summary, due date, or next action. Always confirm before writing persistent data.',
      inputSchema: getCaseContextInputSchema.extend(updateCaseInputSchema.shape),
      needsApproval: true,
      async execute({ caseId, ...patch }) {
        const updatedCase = await updateCase(caseId, patch, owner);
        if (!updatedCase) {
          return {
            success: false,
            message: 'Case not found or not accessible.',
          };
        }

        return {
          success: true,
          kind: 'case_updated',
          case: updatedCase,
          message: `Updated case "${updatedCase.name}".`,
        };
      },
    }),

    add_case_note: tool({
      description:
        'Save a note, message summary, file link, or AI action to a case timeline. Always confirm before writing persistent data.',
      inputSchema: getCaseContextInputSchema.extend(createTimelineNoteInputSchema.shape),
      needsApproval: true,
      async execute({ caseId, ...input }) {
        const note = await addCaseNote(caseId, input, owner);
        return {
          success: true,
          kind: 'case_note_saved',
          note,
          message: `Added note "${note.title}".`,
        };
      },
    }),

    create_case_task: tool({
      description:
        'Create a case follow-up task, appointment, approval, or next action. Always confirm before writing persistent data.',
      inputSchema: getCaseContextInputSchema.extend(createTaskInputSchema.shape),
      needsApproval: true,
      async execute({ caseId, ...input }) {
        const task = await createTask(caseId, input, owner);
        return {
          success: true,
          kind: 'case_task_saved',
          task,
          message: `Created task "${task.title}".`,
        };
      },
    }),

    summarize_case: tool({
      description:
        'Generate a concise case summary and client-facing reply draft from existing case context without changing persistent state.',
      inputSchema: summarizeCaseInputSchema,
      async execute({ caseId }) {
        const summary = await summarizeCase(caseId, owner);
        if (!summary) {
          return {
            success: false,
            message: 'Case not found or not accessible.',
          };
        }

        return {
          success: true,
          kind: 'case_summary',
          ...summary,
        };
      },
    }),
  };
}
