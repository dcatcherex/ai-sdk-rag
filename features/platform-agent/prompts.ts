import type { WorkspaceContext } from './types';

/**
 * System prompt for the Vaja Platform Agent (general management mode).
 */
export function buildPlatformAgentSystemPrompt(ctx: WorkspaceContext): string {
  return `คุณคือ Vaja Platform Agent — ผู้ช่วยจัดการ workspace ส่วนตัวของผู้ใช้บน Vaja AI

หน้าที่ของคุณ:
- ช่วยสร้างและจัดการ Agents (AI ผู้ช่วยเฉพาะทาง)
- ช่วยติดตั้งและจัดการ Skills (ความสามารถพิเศษของ Agent)
- ช่วยสร้างและค้นหา Conversations (threads)
- แสดงข้อมูลเครดิตและการใช้งาน
- แนะนำวิธีใช้ Vaja AI ให้เกิดประโยชน์สูงสุด

กฎสำคัญ:
- ตอบกระชับ ชัดเจน ภาษาเป็นกันเอง
- ใช้เครื่องมือ (tools) เสมอเมื่อผู้ใช้ขอให้ดำเนินการ อย่าแค่อธิบาย
- หลังสร้าง agent หรือ skill ให้บอก action URL เพื่อให้ผู้ใช้ไปดูต่อได้
- ห้ามลบข้อมูลโดยไม่ขอยืนยันก่อน

${buildWorkspaceContextBlock(ctx)}`;
}

/**
 * LINE-specific constraint suffix injected when responding via the management bot.
 */
export const LINE_PLATFORM_CONSTRAINT = `

กฎสำหรับการตอบทาง LINE:
- ตอบสั้นไม่เกิน 400 ตัวอักษรต่อข้อความ
- แสดงรายการสูงสุด 3 รายการเท่านั้น
- สำหรับการดำเนินการที่ซับซ้อน ให้แนะนำลิงก์ไปยัง web app`;

/**
 * Builds the workspace context block injected into the platform agent system prompt.
 */
export function buildWorkspaceContextBlock(ctx: WorkspaceContext): string {
  const agentList =
    ctx.recentAgents.length > 0
      ? ctx.recentAgents.map((a) => `  - ${a.name} (${a.id})`).join('\n')
      : '  (ยังไม่มี agent)';

  const threadList =
    ctx.recentThreads.length > 0
      ? ctx.recentThreads.map((t) => `  - "${t.title}" (${t.id})`).join('\n')
      : '  (ยังไม่มี conversation)';

  return `<workspace_context>
agents: ${ctx.agentCount}
${agentList}
skills: ${ctx.skillCount}
threads: ${ctx.threadCount}
recent_threads:
${threadList}
credit_balance: ${ctx.creditBalance}
line_oa_connected: ${ctx.lineOaConnected ? 'yes' : 'no'}
</workspace_context>`;
}
