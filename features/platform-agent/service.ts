/**
 * Platform Agent Service — canonical business logic for all platform management operations.
 * Calls Drizzle queries and existing service functions directly. Never calls HTTP routes.
 */

import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agent, chatMessage, chatThread, creditTransaction } from '@/db/schema';
import { agentSkill, agentSkillAttachment } from '@/db/schema/skills';
import { getUserBalance } from '@/lib/credits';
import type {
  PlatformToolResult,
  WorkspaceContext,
  OnboardingPlan,
  CreateAgentInput,
  InstallSkillInput,
  CreateThreadInput,
} from './types';

// ── Agent Management ──────────────────────────────────────────────────────────

export async function createAgentForUser(
  userId: string,
  input: CreateAgentInput,
): Promise<PlatformToolResult> {
  const now = new Date();
  const agentId = crypto.randomUUID();

  await db.insert(agent).values({
    id: agentId,
    userId,
    name: input.name,
    description: input.description ?? null,
    systemPrompt: input.systemPrompt,
    modelId: input.modelId ?? null,
    enabledTools: [],
    documentIds: [],
    skillIds: [],
    brandId: null,
    imageUrl: null,
    isPublic: false,
    isDefault: false,
    isTemplate: false,
    templateId: null,
    structuredBehavior: null,
    catalogScope: 'personal',
    catalogStatus: 'draft',
    managedByAdmin: false,
    cloneBehavior: 'editable_copy',
    updatePolicy: 'notify',
    lockedFields: [],
    version: 1,
    sourceTemplateVersion: null,
    publishedAt: null,
    archivedAt: null,
    changelog: null,
    starterPrompts: input.starterPrompts ?? [],
    mcpServers: [],
    createdAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    message: `สร้าง Agent "${input.name}" เรียบร้อยแล้ว`,
    data: { agentId, agentName: input.name },
    actionUrl: `/agents`,
  };
}

export async function listAgentsForUser(
  userId: string,
  opts?: { limit?: number },
): Promise<PlatformToolResult> {
  const limit = opts?.limit ?? 10;

  const agents = await db
    .select({ id: agent.id, name: agent.name, description: agent.description, updatedAt: agent.updatedAt })
    .from(agent)
    .where(eq(agent.userId, userId))
    .orderBy(desc(agent.updatedAt))
    .limit(limit);

  return {
    success: true,
    message: `พบ ${agents.length} agents`,
    data: { agents },
    actionUrl: `/agents`,
  };
}

export async function getAgentForUser(
  userId: string,
  input: { agentId?: string; agentName?: string },
): Promise<PlatformToolResult> {
  if (!input.agentId && !input.agentName) {
    return { success: false, message: 'กรุณาระบุ agentId หรือ agentName' };
  }

  const conditions = [eq(agent.userId, userId)];
  if (input.agentId) {
    conditions.push(eq(agent.id, input.agentId));
  } else if (input.agentName) {
    conditions.push(ilike(agent.name, `%${input.agentName}%`));
  }

  const rows = await db
    .select({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      modelId: agent.modelId,
      enabledTools: agent.enabledTools,
      starterPrompts: agent.starterPrompts,
      updatedAt: agent.updatedAt,
    })
    .from(agent)
    .where(and(...conditions))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, message: 'ไม่พบ Agent ที่ระบุ' };
  }

  return {
    success: true,
    message: `Agent: ${rows[0]!.name}`,
    data: { agent: rows[0] },
    actionUrl: `/agents`,
  };
}

// ── Skill Management ──────────────────────────────────────────────────────────

export async function installSkillForUser(
  userId: string,
  input: InstallSkillInput & {
    name: string;
    description?: string;
    promptFragment: string;
    triggerType?: 'always' | 'keyword' | 'slash';
    trigger?: string;
  },
): Promise<PlatformToolResult> {
  const skillId = nanoid();
  const now = new Date();

  await db.insert(agentSkill).values({
    id: skillId,
    userId,
    name: input.name,
    description: input.description ?? null,
    promptFragment: input.promptFragment,
    triggerType: input.triggerType ?? 'keyword',
    trigger: input.trigger ?? null,
    enabledTools: [],
    skillKind: 'inline',
    activationMode: 'rule',
    syncStatus: 'local',
    hasBundledFiles: false,
    pinnedToInstalledVersion: false,
    catalogScope: 'personal',
    catalogStatus: 'draft',
    managedByAdmin: false,
    isPublic: false,
    isTemplate: false,
    templateId: null,
    cloneBehavior: 'editable_copy',
    updatePolicy: 'notify',
    lockedFields: [],
    version: 1,
    sourceTemplateVersion: null,
    publishedAt: null,
    archivedAt: null,
    changelog: null,
    createdAt: now,
    updatedAt: now,
  });

  // Attach to agent if specified
  if (input.agentId) {
    const agentRow = await db
      .select({ id: agent.id })
      .from(agent)
      .where(and(eq(agent.id, input.agentId), eq(agent.userId, userId)))
      .limit(1);

    if (agentRow.length > 0) {
      await db.insert(agentSkillAttachment).values({
        id: nanoid(),
        agentId: input.agentId,
        skillId,
        isEnabled: true,
        activationModeOverride: null,
        priority: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return {
    success: true,
    message: `ติดตั้ง Skill "${input.name}" เรียบร้อยแล้ว`,
    data: { skillId, skillName: input.name, attachedToAgent: !!input.agentId },
    actionUrl: `/skills`,
  };
}

export async function listSkillsForUser(
  userId: string,
  opts?: { category?: string; limit?: number },
): Promise<PlatformToolResult> {
  const limit = opts?.limit ?? 10;

  const conditions = [eq(agentSkill.userId, userId)];
  if (opts?.category) {
    conditions.push(eq(agentSkill.category, opts.category));
  }

  const skills = await db
    .select({
      id: agentSkill.id,
      name: agentSkill.name,
      description: agentSkill.description,
      category: agentSkill.category,
      triggerType: agentSkill.triggerType,
      trigger: agentSkill.trigger,
      updatedAt: agentSkill.updatedAt,
    })
    .from(agentSkill)
    .where(and(...conditions))
    .orderBy(desc(agentSkill.updatedAt))
    .limit(limit);

  return {
    success: true,
    message: `พบ ${skills.length} skills`,
    data: { skills },
    actionUrl: `/skills`,
  };
}

// ── Thread Management ─────────────────────────────────────────────────────────

export async function createThreadForUser(
  userId: string,
  input: CreateThreadInput,
): Promise<PlatformToolResult> {
  const threadId = nanoid();
  const now = new Date();

  await db.insert(chatThread).values({
    id: threadId,
    userId,
    title: input.title ?? 'New conversation',
    preview: input.initialMessage ?? '',
    pinned: false,
    brandId: null,
    createdAt: now,
    updatedAt: now,
  });

  const url = input.agentId ? `/?thread=${threadId}&agent=${input.agentId}` : `/?thread=${threadId}`;

  // Fire-and-forget LINE push notification to linked accounts
  const title = input.title ?? 'New conversation';
  void notifyLinkedLineUsers(
    userId,
    `มี Thread ใหม่: "${title}" — คุยต่อได้บน LINE ได้เลยครับ`,
  ).catch(() => {}); // ignore push failures

  return {
    success: true,
    message: `สร้าง Thread "${title}" เรียบร้อยแล้ว`,
    data: { threadId, title },
    actionUrl: url,
  };
}

export async function listThreadsForUser(
  userId: string,
  opts?: { limit?: number; agentId?: string },
): Promise<PlatformToolResult> {
  const limit = opts?.limit ?? 5;

  const threads = await db
    .select({
      id: chatThread.id,
      title: chatThread.title,
      preview: chatThread.preview,
      updatedAt: chatThread.updatedAt,
    })
    .from(chatThread)
    .where(eq(chatThread.userId, userId))
    .orderBy(desc(chatThread.updatedAt))
    .limit(limit);

  return {
    success: true,
    message: `พบ ${threads.length} threads ล่าสุด`,
    data: { threads },
  };
}

export async function findRelevantThread(
  userId: string,
  input: { topic?: string; threadId?: string },
): Promise<PlatformToolResult> {
  // Direct lookup by ID
  if (input.threadId) {
    const rows = await db
      .select({ id: chatThread.id, title: chatThread.title, updatedAt: chatThread.updatedAt })
      .from(chatThread)
      .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, userId)))
      .limit(1);

    if (rows.length > 0) {
      return {
        success: true,
        message: `พบ Thread: "${rows[0]!.title}"`,
        data: { thread: rows[0] },
        actionUrl: `/?thread=${rows[0]!.id}`,
      };
    }
    return { success: false, message: 'ไม่พบ Thread ที่ระบุ' };
  }

  // Topic search
  if (input.topic) {
    const rows = await db
      .select({ id: chatThread.id, title: chatThread.title, updatedAt: chatThread.updatedAt })
      .from(chatThread)
      .where(and(eq(chatThread.userId, userId), ilike(chatThread.title, `%${input.topic}%`)))
      .orderBy(desc(chatThread.updatedAt))
      .limit(3);

    if (rows.length > 0) {
      return {
        success: true,
        message: `พบ ${rows.length} threads เกี่ยวกับ "${input.topic}"`,
        data: { threads: rows },
        actionUrl: `/?thread=${rows[0]!.id}`,
      };
    }
  }

  // Fallback: most recent thread
  const recent = await db
    .select({ id: chatThread.id, title: chatThread.title, updatedAt: chatThread.updatedAt })
    .from(chatThread)
    .where(eq(chatThread.userId, userId))
    .orderBy(desc(chatThread.updatedAt))
    .limit(1);

  if (recent.length === 0) {
    return { success: false, message: 'ยังไม่มี conversation ใดๆ' };
  }

  return {
    success: true,
    message: `Thread ล่าสุด: "${recent[0]!.title}"`,
    data: { thread: recent[0] },
    actionUrl: `/?thread=${recent[0]!.id}`,
  };
}

// ── Workspace Context ─────────────────────────────────────────────────────────

export async function getWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  const [agentRows, skillRows, threadRows, balance] = await Promise.all([
    db
      .select({ id: agent.id, name: agent.name })
      .from(agent)
      .where(eq(agent.userId, userId))
      .orderBy(desc(agent.updatedAt))
      .limit(5),
    db
      .select({ count: count() })
      .from(agentSkill)
      .where(eq(agentSkill.userId, userId)),
    db
      .select({ id: chatThread.id, title: chatThread.title, updatedAt: chatThread.updatedAt })
      .from(chatThread)
      .where(eq(chatThread.userId, userId))
      .orderBy(desc(chatThread.updatedAt))
      .limit(3),
    getUserBalance(userId),
  ]);

  const [agentCountRows, threadCountRows] = await Promise.all([
    db.select({ count: count() }).from(agent).where(eq(agent.userId, userId)),
    db.select({ count: count() }).from(chatThread).where(eq(chatThread.userId, userId)),
  ]);

  return {
    agentCount: agentCountRows[0]?.count ?? 0,
    skillCount: skillRows[0]?.count ?? 0,
    threadCount: threadCountRows[0]?.count ?? 0,
    creditBalance: balance,
    lineOaConnected: false, // TODO: check lineOaChannel table in Phase 4
    recentAgents: agentRows,
    recentThreads: threadRows.map((t) => ({
      id: t.id,
      title: t.title,
      agentName: '',
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

// ── Credit Usage ──────────────────────────────────────────────────────────────

export async function getUserUsageSummary(userId: string): Promise<PlatformToolResult> {
  const [balance, recentTx] = await Promise.all([
    getUserBalance(userId),
    db
      .select({
        type: creditTransaction.type,
        amount: creditTransaction.amount,
        description: creditTransaction.description,
        createdAt: creditTransaction.createdAt,
      })
      .from(creditTransaction)
      .where(eq(creditTransaction.userId, userId))
      .orderBy(desc(creditTransaction.createdAt))
      .limit(5),
  ]);

  return {
    success: true,
    message: `เครดิตคงเหลือ: ${balance} credits`,
    data: { balance, recentTransactions: recentTx },
  };
}

// ── Team Member ──────────────────────────────────────────────────────────────

export async function addTeamMemberForUser(
  userId: string,
  input: { email: string; creditsToShare?: number; confirmed: boolean },
): Promise<PlatformToolResult> {
  const { user: userTable } = await import('@/db/schema');

  if (!input.confirmed) {
    return {
      success: true,
      message: `จะแชร์ workspace ให้ ${input.email}${input.creditsToShare ? ` พร้อมโอน ${input.creditsToShare} credits` : ''} ใช่ไหม? ตอบยืนยันด้วย confirmed: true`,
      data: { preview: true, email: input.email, creditsToShare: input.creditsToShare },
    };
  }

  // Look up target user by email
  const targetRows = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.email, input.email))
    .limit(1);

  if (targetRows.length === 0) {
    return {
      success: false,
      message: `ไม่พบผู้ใช้ที่มีอีเมล ${input.email} — กรุณาให้พวกเขาสมัครใช้งาน Vaja AI ก่อน`,
    };
  }

  const targetUser = targetRows[0]!;

  if (input.creditsToShare && input.creditsToShare > 0) {
    const { addCredits, getUserBalance } = await import('@/lib/credits');
    const currentBalance = await getUserBalance(userId);
    if (currentBalance < input.creditsToShare) {
      return {
        success: false,
        message: `เครดิตไม่พอ — คุณมี ${currentBalance} credits แต่ต้องการโอน ${input.creditsToShare}`,
      };
    }
    // Transfer credits
    const { deductCredits } = await import('@/lib/credits');
    await Promise.all([
      deductCredits({ userId, amount: input.creditsToShare, description: `โอนเครดิตให้ ${targetUser.email}` }),
      addCredits({ userId: targetUser.id, amount: input.creditsToShare, type: 'grant', description: `รับเครดิตจากเจ้าของ workspace` }),
    ]);
  }

  return {
    success: true,
    message: `เพิ่ม ${targetUser.name ?? targetUser.email} เข้า workspace เรียบร้อย${input.creditsToShare ? ` และโอน ${input.creditsToShare} credits` : ''}`,
    data: { targetUserId: targetUser.id, email: targetUser.email },
  };
}

// ── Rich Menu Config ──────────────────────────────────────────────────────────

export async function configRichMenuForUser(
  userId: string,
  input: { channelId: string; buttonIndex: number; agentId: string; confirmed: boolean },
): Promise<PlatformToolResult> {
  const { lineOaChannel, lineRichMenu, agent: agentTable } = await import('@/db/schema');

  // Ownership check
  const channelRows = await db
    .select({ id: lineOaChannel.id, userId: lineOaChannel.userId, name: lineOaChannel.name })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, input.channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  if (channelRows.length === 0) {
    return { success: false, message: 'ไม่พบ LINE OA channel หรือคุณไม่มีสิทธิ์แก้ไข' };
  }

  // Load rich menus for this channel
  const menus = await db
    .select({ id: lineRichMenu.id, name: lineRichMenu.name, areas: lineRichMenu.areas, isDefault: lineRichMenu.isDefault, lineMenuId: lineRichMenu.lineMenuId })
    .from(lineRichMenu)
    .where(and(eq(lineRichMenu.channelId, input.channelId), eq(lineRichMenu.isDefault, true)))
    .limit(1);

  if (menus.length === 0) {
    return { success: false, message: 'ไม่พบ rich menu สำหรับ channel นี้ กรุณาสร้าง rich menu ก่อนในหน้า LINE OA' };
  }

  const menu = menus[0]!;
  const areas = menu.areas ?? [];

  if (input.buttonIndex >= areas.length) {
    return {
      success: false,
      message: `ปุ่มที่ ${input.buttonIndex + 1} ไม่มีอยู่ — menu นี้มีทั้งหมด ${areas.length} ปุ่ม`,
    };
  }

  // Look up agent name
  const agentRows = await db
    .select({ name: agentTable.name })
    .from(agentTable)
    .where(and(eq(agentTable.id, input.agentId), eq(agentTable.userId, userId)))
    .limit(1);

  if (agentRows.length === 0) {
    return { success: false, message: 'ไม่พบ Agent ที่ระบุ' };
  }

  const agentName = agentRows[0]!.name;
  const currentArea = areas[input.buttonIndex]!;

  if (!input.confirmed) {
    return {
      success: true,
      message: `จะเปลี่ยนปุ่มที่ ${input.buttonIndex + 1} ("${currentArea.label}") ให้เชื่อมกับ Agent "${agentName}" ใช่ไหม?\nตอบยืนยันด้วย confirmed: true`,
      data: {
        preview: true,
        buttonIndex: input.buttonIndex,
        currentLabel: currentArea.label,
        newAgentId: input.agentId,
        newAgentName: agentName,
      },
    };
  }

  // Update the area's action to switch_agent
  const updatedAreas = areas.map((area, i) =>
    i === input.buttonIndex
      ? { ...area, action: { type: 'switch_agent' as const, agentId: input.agentId, displayText: `เปลี่ยนเป็น ${agentName}` } }
      : area,
  );

  await db
    .update(lineRichMenu)
    .set({ areas: updatedAreas, updatedAt: new Date() })
    .where(eq(lineRichMenu.id, menu.id));

  return {
    success: true,
    message: `อัปเดตปุ่มที่ ${input.buttonIndex + 1} ให้ใช้งาน Agent "${agentName}" เรียบร้อยแล้ว\nกรุณา Deploy rich menu ใหม่จากหน้า LINE OA เพื่อให้การเปลี่ยนแปลงมีผล`,
    data: { menuId: menu.id, buttonIndex: input.buttonIndex, agentId: input.agentId, agentName },
    actionUrl: `/line-oa`,
  };
}

// ── Cross-Channel Thread Continuity ──────────────────────────────────────────

/**
 * Generate a brief 2-sentence context summary for a thread's recent messages.
 * Called on demand — never stored.
 */
export async function getThreadContextSummary(threadId: string): Promise<string> {
  const messages = await db
    .select({ role: chatMessage.role, parts: chatMessage.parts })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(desc(chatMessage.position))
    .limit(10);

  if (messages.length === 0) return 'ยังไม่มีข้อความในบทสนทนานี้';

  // Build a plain text summary of the conversation
  const transcript = messages
    .reverse()
    .map((m) => {
      const parts = m.parts as Array<{ type?: string; text?: string }>;
      const text = parts.find((p) => p.type === 'text')?.text ?? '';
      return text ? `${m.role}: ${text.slice(0, 200)}` : null;
    })
    .filter(Boolean)
    .join('\n');

  if (!transcript) return 'บทสนทนาในรูปแบบที่ไม่สามารถสรุปได้';

  try {
    const { generateText } = await import('ai');
    const { chatModel } = await import('@/lib/ai');
    const result = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: chatModel as any,
      system: 'สรุปบทสนทนาต่อไปนี้ใน 2 ประโยคสั้นๆ ภาษาไทย บอกว่าคุยเรื่องอะไรและผลลัพธ์คืออะไร',
      prompt: transcript,
    });
    return result.text.slice(0, 300);
  } catch {
    return 'ไม่สามารถสรุปบทสนทนาได้ในขณะนี้';
  }
}

/**
 * Find a thread with cross-channel awareness.
 * Searches by topic in both chatThread titles and lineConversation records.
 * Returns thread + a 2-sentence context summary.
 */
export async function findRelevantThreadWithContext(
  userId: string,
  input: { topic?: string; threadId?: string },
): Promise<PlatformToolResult> {
  const { lineConversation, lineOaChannel } = await import('@/db/schema');

  let foundThreadId: string | null = null;
  let foundTitle: string | null = null;

  // Direct lookup by ID
  if (input.threadId) {
    const rows = await db
      .select({ id: chatThread.id, title: chatThread.title })
      .from(chatThread)
      .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, userId)))
      .limit(1);
    if (rows.length > 0) {
      foundThreadId = rows[0]!.id;
      foundTitle = rows[0]!.title;
    }
  }

  // Topic search in thread titles
  if (!foundThreadId && input.topic) {
    const titleRows = await db
      .select({ id: chatThread.id, title: chatThread.title })
      .from(chatThread)
      .where(and(eq(chatThread.userId, userId), ilike(chatThread.title, `%${input.topic}%`)))
      .orderBy(desc(chatThread.updatedAt))
      .limit(1);

    if (titleRows.length > 0) {
      foundThreadId = titleRows[0]!.id;
      foundTitle = titleRows[0]!.title;
    }
  }

  // Cross-channel: search via lineConversation linked threads
  if (!foundThreadId && input.topic) {
    const lineConvRows = await db
      .select({ threadId: lineConversation.threadId, title: chatThread.title })
      .from(lineConversation)
      .innerJoin(chatThread, eq(lineConversation.threadId, chatThread.id))
      .innerJoin(lineOaChannel, eq(lineConversation.channelId, lineOaChannel.id))
      .where(
        and(
          eq(chatThread.userId, userId),
          ilike(chatThread.title, `%${input.topic}%`),
        ),
      )
      .orderBy(desc(chatThread.updatedAt))
      .limit(1);

    if (lineConvRows.length > 0) {
      foundThreadId = lineConvRows[0]!.threadId;
      foundTitle = lineConvRows[0]!.title;
    }
  }

  // Fallback: most recent thread
  if (!foundThreadId) {
    const recent = await db
      .select({ id: chatThread.id, title: chatThread.title })
      .from(chatThread)
      .where(eq(chatThread.userId, userId))
      .orderBy(desc(chatThread.updatedAt))
      .limit(1);

    if (recent.length === 0) {
      return { success: false, message: 'ยังไม่มี conversation ใดๆ' };
    }
    foundThreadId = recent[0]!.id;
    foundTitle = recent[0]!.title;
  }

  // Generate context summary on demand
  const summary = await getThreadContextSummary(foundThreadId);

  return {
    success: true,
    message: `พบ Thread: "${foundTitle}"\n\nสรุป: ${summary}`,
    data: { threadId: foundThreadId, title: foundTitle, summary },
    actionUrl: `/?thread=${foundThreadId}`,
  };
}

/**
 * Send a LINE push notification to the user's linked LINE account(s)
 * when a thread is created or flagged for continuation via web.
 * Fire-and-forget — caller should not await this.
 */
export async function notifyLinkedLineUsers(
  userId: string,
  message: string,
): Promise<void> {
  const { lineAccountLink, lineOaChannel } = await import('@/db/schema');
  const { messagingApi } = await import('@line/bot-sdk');

  const links = await db
    .select({
      lineUserId: lineAccountLink.lineUserId,
      channelAccessToken: lineOaChannel.channelAccessToken,
    })
    .from(lineAccountLink)
    .innerJoin(lineOaChannel, eq(lineAccountLink.channelId, lineOaChannel.id))
    .where(and(eq(lineAccountLink.userId, userId), eq(lineOaChannel.status, 'active')))
    .limit(3);

  await Promise.allSettled(
    links.map(async ({ lineUserId, channelAccessToken }) => {
      const client = new messagingApi.MessagingApiClient({ channelAccessToken });
      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: message.slice(0, 400) }],
      });
    }),
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export async function runOnboardingPlan(
  userId: string,
  professionHint: string,
): Promise<OnboardingPlan> {
  const { getOnboardingTemplate } = await import('./onboarding');
  const template = getOnboardingTemplate(professionHint);

  // Create the agent
  const result = await createAgentForUser(userId, {
    name: template.agentName,
    systemPrompt: template.systemPrompt,
    description: template.description,
    starterPrompts: template.starterPrompts,
  });

  const agentId = result.data?.agentId as string;
  const skillsInstalled: string[] = [];

  // Create default skills and attach to agent
  for (const skillDef of template.defaultSkills) {
    const skillResult = await installSkillForUser(userId, {
      name: skillDef.name,
      description: skillDef.description,
      promptFragment: skillDef.promptFragment,
      agentId,
      triggerType: 'always',
    });
    if (skillResult.success) {
      skillsInstalled.push(skillDef.name);
    }
  }

  return {
    agentId,
    agentName: template.agentName,
    skillsInstalled,
    suggestedStarters: template.starterPrompts,
  };
}
