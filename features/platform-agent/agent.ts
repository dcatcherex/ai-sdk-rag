/**
 * Platform Agent — AI SDK tool() wrappers.
 * Thin adapters only. All logic lives in service.ts.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  createAgentInputSchema,
  listAgentsInputSchema,
  getAgentInputSchema,
  installSkillInputSchema,
  listSkillsInputSchema,
  createThreadInputSchema,
  listThreadsInputSchema,
  continueThreadInputSchema,
  getUsageInputSchema,
  addTeamMemberInputSchema,
  configRichMenuInputSchema,
} from './schema';
import {
  createAgentForUser,
  listAgentsForUser,
  getAgentForUser,
  installSkillForUser,
  listSkillsForUser,
  createThreadForUser,
  listThreadsForUser,
  findRelevantThreadWithContext,
  getUserUsageSummary,
  addTeamMemberForUser,
  configRichMenuForUser,
} from './service';

export function getPlatformAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    create_agent: tool({
      description:
        'สร้าง Agent ใหม่ใน workspace ของผู้ใช้ — ระบุชื่อ, system prompt, และ description',
      inputSchema: createAgentInputSchema,
      async execute(input) {
        return createAgentForUser(userId, input);
      },
    }),

    list_agents: tool({
      description: 'แสดงรายการ Agents ทั้งหมดของผู้ใช้',
      inputSchema: listAgentsInputSchema,
      async execute(input) {
        return listAgentsForUser(userId, { limit: input.limit });
      },
    }),

    get_agent: tool({
      description: 'ดูรายละเอียดของ Agent โดยใช้ ID หรือชื่อ',
      inputSchema: getAgentInputSchema,
      async execute(input) {
        return getAgentForUser(userId, input);
      },
    }),

    install_skill: tool({
      description:
        'สร้าง Skill ใหม่และติดตั้งเข้า workspace — ระบุชื่อ, คำอธิบาย, และ prompt instructions',
      inputSchema: installSkillInputSchema,
      async execute(input) {
        return installSkillForUser(userId, input);
      },
    }),

    list_skills: tool({
      description: 'แสดงรายการ Skills ทั้งหมดของผู้ใช้',
      inputSchema: listSkillsInputSchema,
      async execute(input) {
        return listSkillsForUser(userId, { category: input.category, limit: input.limit });
      },
    }),

    create_thread: tool({
      description: 'สร้าง conversation thread ใหม่ optionally กับ Agent ที่ระบุ',
      inputSchema: createThreadInputSchema,
      async execute(input) {
        return createThreadForUser(userId, input);
      },
    }),

    list_threads: tool({
      description: 'แสดง conversation threads ล่าสุดของผู้ใช้',
      inputSchema: listThreadsInputSchema,
      async execute(input) {
        return listThreadsForUser(userId, { limit: input.limit, agentId: input.agentId });
      },
    }),

    continue_thread: tool({
      description:
        'ค้นหา thread เดิมตาม topic หรือ ID (รวมถึง threads จาก LINE) และสร้างสรุป 2 ประโยค',
      inputSchema: continueThreadInputSchema,
      async execute(input) {
        return findRelevantThreadWithContext(userId, input);
      },
    }),

    get_usage: tool({
      description: 'ดูเครดิตคงเหลือและประวัติการใช้งานล่าสุด',
      inputSchema: getUsageInputSchema,
      async execute() {
        return getUserUsageSummary(userId);
      },
    }),

    add_team_member: tool({
      description:
        'เพิ่มสมาชิกเข้า workspace และ/หรือโอน credits ให้ — ต้องยืนยันก่อนดำเนินการ',
      inputSchema: addTeamMemberInputSchema,
      async execute(input) {
        return addTeamMemberForUser(userId, input);
      },
    }),

    config_rich_menu: tool({
      description:
        'อัปเดต rich menu button ของ LINE OA ให้เชื่อมกับ Agent ที่ระบุ — แสดง preview ก่อนยืนยัน',
      inputSchema: configRichMenuInputSchema,
      async execute(input) {
        return configRichMenuForUser(userId, input);
      },
    }),
  };
}
