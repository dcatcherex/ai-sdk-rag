/**
 * Canonical exam-builder business logic.
 * All operations — AI generation, CRUD, PDF export — live here.
 * Agent adapters and API routes call these functions; no logic elsewhere.
 */

import { generateText, Output } from 'ai';
import { nanoid } from 'nanoid';
import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  examDraft,
  examQuestion,
  examQuestionBank,
} from '@/db/schema';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import {
  type GenerateExamQuestionsInput,
  type CreateExamDraftInput,
  type UpdateExamDraftInput,
  type UpdateExamQuestionInput,
  type ExportOptions,
  type ExamDraftWithQuestions,
  type BankQuestion,
  type ExamQuestion,
  type ExamDraft,
} from './types';
import {
  generateExamQuestionsOutputSchema,
  bankFilterSchema,
} from './schema';
import type { z } from 'zod';

const EXAM_MODEL = 'google/gemini-2.5-flash-lite';

// ── AI Generation ─────────────────────────────────────────────────────────────

export async function runGenerateExamQuestions(
  input: GenerateExamQuestionsInput,
) {
  const {
    topic, subject, gradeLevel, language, questionTypes,
    bloomsLevels, countPerType, sourceMaterial,
  } = input;

  const langLabel = language === 'th' ? 'Thai (ภาษาไทย)' : 'English';
  const typeDescriptions: Record<string, string> = {
    mcq: 'MCQ (4 options, options = string[4], answer = correct option text)',
    true_false: language === 'th'
      ? 'True/False (options = ["ถูก","ผิด"], answer = "ถูก" or "ผิด")'
      : 'True/False (options = ["True","False"], answer = "True" or "False")',
    short_answer: 'Short Answer (options = null, answer = expected answer text)',
    essay: 'Essay (options = null, answer = model answer or rubric)',
    matching: 'Matching (options = { left: string[], right: string[] } with 4-5 pairs, answer = "1→A,2→C,3→B,4→D" style mapping from left index to right index)',
  };
  const requestedTypeDescriptions = questionTypes.map((t) => typeDescriptions[t]).join('\n');

  const { output } = await generateText({
    model: EXAM_MODEL,
    system: `You are an expert Thai school curriculum developer and exam writer. Create high-quality exam questions aligned to the Thai national curriculum (หลักสูตรแกนกลาง).

Rules:
- Write ALL question text in ${langLabel}
- Questions must be appropriate for ${gradeLevel} level students
- Distribute questions evenly across the requested Bloom's taxonomy levels: ${bloomsLevels.join(', ')}
- Each question type has a specific options format — follow it exactly:
${requestedTypeDescriptions}
- Points should reflect difficulty: 1pt for remember/understand, 2-3pt for apply/analyze, 3-5pt for evaluate/create
- Explanations should help teachers understand the correct answer
- Questions must be fair, unambiguous, and curriculum-appropriate
- Return exactly ${questionTypes.length * countPerType} questions total (${countPerType} per type)`,
    output: Output.object({ schema: generateExamQuestionsOutputSchema }),
    prompt: [
      `Subject: ${subject}`,
      `Topic: ${topic}`,
      `Grade level: ${gradeLevel}`,
      `Language: ${langLabel}`,
      `Question types needed: ${questionTypes.join(', ')} — ${countPerType} each`,
      `Bloom's levels to use: ${bloomsLevels.join(', ')}`,
      sourceMaterial ? `Reference material:\n${sourceMaterial}` : null,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n'),
  });

  return output;
}

export async function generateExamQuestionsAction(
  input: GenerateExamQuestionsInput,
): Promise<ToolExecutionResult> {
  const data = await runGenerateExamQuestions(input);
  return {
    tool: 'exam_builder',
    runId: nanoid(),
    title: `Questions: ${input.topic}`,
    summary: `${data.questions.length} questions generated for ${input.subject} ${input.gradeLevel}`,
    data,
    createdAt: new Date().toISOString(),
  };
}

// ── Exam CRUD ─────────────────────────────────────────────────────────────────

export async function createExamDraft(
  userId: string,
  input: CreateExamDraftInput,
) {
  const id = nanoid();
  const [draft] = await db.insert(examDraft).values({
    id,
    userId,
    title: input.title,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    language: input.language ?? 'th',
    instructions: input.instructions ?? null,
    headerInfo: input.headerInfo ?? {},
    enabledTypes: input.enabledTypes ?? ['mcq'],
    enabledBloomsLevels: input.enabledBloomsLevels ?? ['remember', 'understand', 'apply'],
    totalPoints: 0,
    status: 'draft',
  }).returning();
  return draft;
}

export async function getUserExams(userId: string): Promise<ExamDraft[]> {
  return db
    .select()
    .from(examDraft)
    .where(eq(examDraft.userId, userId))
    .orderBy(desc(examDraft.updatedAt));
}

export async function getExamDraft(
  examId: string,
  userId: string,
): Promise<ExamDraftWithQuestions | null> {
  const [draft] = await db
    .select()
    .from(examDraft)
    .where(and(eq(examDraft.id, examId), eq(examDraft.userId, userId)))
    .limit(1);

  if (!draft) return null;

  const questions = await db
    .select()
    .from(examQuestion)
    .where(eq(examQuestion.examId, examId))
    .orderBy(asc(examQuestion.orderIndex));

  return { ...draft, questions } as ExamDraftWithQuestions;
}

export async function updateExamDraft(
  examId: string,
  userId: string,
  patch: UpdateExamDraftInput,
) {
  const [updated] = await db
    .update(examDraft)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.subject !== undefined && { subject: patch.subject }),
      ...(patch.gradeLevel !== undefined && { gradeLevel: patch.gradeLevel }),
      ...(patch.language !== undefined && { language: patch.language }),
      ...(patch.instructions !== undefined && { instructions: patch.instructions }),
      ...(patch.headerInfo !== undefined && { headerInfo: patch.headerInfo }),
      ...(patch.enabledTypes !== undefined && { enabledTypes: patch.enabledTypes }),
      ...(patch.enabledBloomsLevels !== undefined && { enabledBloomsLevels: patch.enabledBloomsLevels }),
      ...(patch.status !== undefined && { status: patch.status }),
    })
    .where(and(eq(examDraft.id, examId), eq(examDraft.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteExamDraft(examId: string, userId: string) {
  await db
    .delete(examDraft)
    .where(and(eq(examDraft.id, examId), eq(examDraft.userId, userId)));
}

// ── Question management ───────────────────────────────────────────────────────

type QuestionInsert = {
  type: ExamQuestion['type'];
  text: string;
  options: ExamQuestion['options'];
  answer: string;
  explanation: string;
  bloomsLevel: ExamQuestion['bloomsLevel'];
  points: number;
  subject?: string;
  gradeLevel?: string;
};

async function recalcTotalPoints(examId: string) {
  const questions = await db
    .select({ points: examQuestion.points })
    .from(examQuestion)
    .where(eq(examQuestion.examId, examId));
  const total = questions.reduce((sum, q) => sum + q.points, 0);
  await db.update(examDraft).set({ totalPoints: total }).where(eq(examDraft.id, examId));
}

export async function addQuestionsToExam(
  examId: string,
  userId: string,
  questions: QuestionInsert[],
): Promise<ExamQuestion[]> {
  // Verify ownership
  const [owner] = await db
    .select({ id: examDraft.id })
    .from(examDraft)
    .where(and(eq(examDraft.id, examId), eq(examDraft.userId, userId)))
    .limit(1);
  if (!owner) return [];

  // Get current max orderIndex
  const existing = await db
    .select({ orderIndex: examQuestion.orderIndex })
    .from(examQuestion)
    .where(eq(examQuestion.examId, examId))
    .orderBy(desc(examQuestion.orderIndex))
    .limit(1);
  let nextOrder = (existing[0]?.orderIndex ?? -1) + 1;

  // Get exam for subject/grade defaults
  const [draft] = await db.select().from(examDraft).where(eq(examDraft.id, examId)).limit(1);

  const rows = questions.map((q) => ({
    id: nanoid(),
    examId,
    userId,
    type: q.type,
    text: q.text,
    options: q.options ?? null,
    answer: q.answer,
    explanation: q.explanation,
    bloomsLevel: q.bloomsLevel,
    points: q.points,
    orderIndex: nextOrder++,
    subject: q.subject ?? draft?.subject ?? '',
    gradeLevel: q.gradeLevel ?? draft?.gradeLevel ?? '',
  }));

  const inserted = await db.insert(examQuestion).values(rows).returning();
  await recalcTotalPoints(examId);

  // Auto-save to question bank
  const bankRows = inserted.map((q) => ({
    id: nanoid(),
    userId,
    sourceExamId: examId,
    type: q.type,
    text: q.text,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    bloomsLevel: q.bloomsLevel,
    defaultPoints: q.points,
    subject: q.subject,
    gradeLevel: q.gradeLevel,
    tags: [] as string[],
    useCount: 0,
  }));
  await db.insert(examQuestionBank).values(bankRows);

  return inserted as ExamQuestion[];
}

export async function updateExamQuestion(
  questionId: string,
  userId: string,
  patch: UpdateExamQuestionInput,
) {
  const [updated] = await db
    .update(examQuestion)
    .set({
      ...(patch.text !== undefined && { text: patch.text }),
      ...(patch.options !== undefined && { options: patch.options }),
      ...(patch.answer !== undefined && { answer: patch.answer }),
      ...(patch.explanation !== undefined && { explanation: patch.explanation }),
      ...(patch.bloomsLevel !== undefined && { bloomsLevel: patch.bloomsLevel }),
      ...(patch.points !== undefined && { points: patch.points }),
      ...(patch.orderIndex !== undefined && { orderIndex: patch.orderIndex }),
    })
    .where(and(eq(examQuestion.id, questionId), eq(examQuestion.userId, userId)))
    .returning();

  if (updated) await recalcTotalPoints(updated.examId);
  return updated ?? null;
}

export async function deleteExamQuestion(questionId: string, userId: string) {
  const [deleted] = await db
    .delete(examQuestion)
    .where(and(eq(examQuestion.id, questionId), eq(examQuestion.userId, userId)))
    .returning();
  if (deleted) await recalcTotalPoints(deleted.examId);
}

export async function reorderExamQuestions(
  examId: string,
  userId: string,
  orderedIds: string[],
) {
  // Verify ownership
  const [owner] = await db
    .select({ id: examDraft.id })
    .from(examDraft)
    .where(and(eq(examDraft.id, examId), eq(examDraft.userId, userId)))
    .limit(1);
  if (!owner) return;

  // Update orderIndex for each question
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(examQuestion)
        .set({ orderIndex: index })
        .where(and(eq(examQuestion.id, id), eq(examQuestion.userId, userId))),
    ),
  );
}

// ── Question Bank ─────────────────────────────────────────────────────────────

export async function getUserBankQuestions(
  userId: string,
  filters?: z.infer<typeof bankFilterSchema>,
): Promise<BankQuestion[]> {
  const conditions = [eq(examQuestionBank.userId, userId)];
  if (filters?.subject) conditions.push(eq(examQuestionBank.subject, filters.subject));
  if (filters?.gradeLevel) conditions.push(eq(examQuestionBank.gradeLevel, filters.gradeLevel));
  if (filters?.type) conditions.push(eq(examQuestionBank.type, filters.type));
  if (filters?.bloomsLevel) conditions.push(eq(examQuestionBank.bloomsLevel, filters.bloomsLevel));

  return db
    .select()
    .from(examQuestionBank)
    .where(and(...conditions))
    .orderBy(desc(examQuestionBank.createdAt)) as Promise<BankQuestion[]>;
}

export async function addBankQuestionToExam(
  bankQuestionId: string,
  examId: string,
  userId: string,
): Promise<ExamQuestion | null> {
  const [bankQ] = await db
    .select()
    .from(examQuestionBank)
    .where(and(eq(examQuestionBank.id, bankQuestionId), eq(examQuestionBank.userId, userId)))
    .limit(1);

  if (!bankQ) return null;

  const [inserted] = await addQuestionsToExam(examId, userId, [{
    type: bankQ.type,
    text: bankQ.text,
    options: bankQ.options,
    answer: bankQ.answer,
    explanation: bankQ.explanation,
    bloomsLevel: bankQ.bloomsLevel,
    points: bankQ.defaultPoints,
    subject: bankQ.subject,
    gradeLevel: bankQ.gradeLevel,
  }]);

  // Increment use count
  await db
    .update(examQuestionBank)
    .set({ useCount: bankQ.useCount + 1 })
    .where(eq(examQuestionBank.id, bankQuestionId));

  return inserted;
}

// ── HTML Export ───────────────────────────────────────────────────────────────

const SECTION_LABELS_TH: Record<string, string> = {
  mcq: 'ตอนที่ {n} ปรนัย (เลือกคำตอบที่ถูกต้องที่สุด เพียงข้อเดียว)',
  true_false: 'ตอนที่ {n} ถูกหรือผิด (เขียน ✓ หน้าข้อที่ถูก หรือ ✗ หน้าข้อที่ผิด)',
  short_answer: 'ตอนที่ {n} เติมคำตอบ (เขียนคำตอบลงในช่องว่าง)',
  matching: 'ตอนที่ {n} จับคู่ (เติมหมายเลขของคอลัมน์ ข ที่ตรงกับคอลัมน์ ก)',
  essay: 'ตอนที่ {n} อัตนัย (อธิบายคำตอบให้ครบถ้วน)',
};
const SECTION_LABELS_EN: Record<string, string> = {
  mcq: 'Part {n}: Multiple Choice (Choose the best answer)',
  true_false: 'Part {n}: True or False',
  short_answer: 'Part {n}: Short Answer',
  matching: 'Part {n}: Matching',
  essay: 'Part {n}: Essay',
};

const MCQ_LABELS_TH = ['ก', 'ข', 'ค', 'ง', 'จ'];
const MCQ_LABELS_EN = ['A', 'B', 'C', 'D', 'E'];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderQuestion(
  q: ExamQuestion,
  globalIndex: number,
  isEn: boolean,
  opts: ExportOptions,
): string {
  const labels = isEn ? MCQ_LABELS_EN : MCQ_LABELS_TH;
  const pointsHtml = opts.showPoints
    ? `<span class="q-points">(${q.points} คะแนน)</span>`
    : '';

  let body = '';

  if (q.type === 'mcq') {
    const options = Array.isArray(q.options) ? (q.options as string[]) : [];
    const optHtml = options
      .map((opt, i) => `<div class="mcq-option"><span class="mcq-label">${labels[i]}.</span> ${escapeHtml(opt)}</div>`)
      .join('');
    body = `<div class="mcq-options">${optHtml}</div>`;
  } else if (q.type === 'true_false') {
    const choices = isEn
      ? '<span class="tf-choice">True □</span><span class="tf-choice">False □</span>'
      : '<span class="tf-choice">ถูก □</span><span class="tf-choice">ผิด □</span>';
    body = `<div class="tf-choices">${choices}</div>`;
  } else if (q.type === 'matching') {
    const opts2 = q.options as { left: string[]; right: string[] } | null;
    if (opts2 && 'left' in opts2) {
      const leftItems = opts2.left.map((l, i) => `<div class="matching-left"><b>${i + 1}.</b> ${escapeHtml(l)}</div>`).join('');
      // Shuffle right items for display
      const rightItems = [...opts2.right]
        .map((r, i) => `<div class="matching-right"><b>${labels[i] ?? String(i + 1)}.</b> ${escapeHtml(r)}</div>`)
        .join('');
      const answerBlanks = opts2.left.map((_, i) => `${i + 1}.___ `).join(' ');
      body = `<div class="matching-grid"><div class="matching-col">${leftItems}</div><div class="matching-col">${rightItems}</div></div><div class="matching-answers">${isEn ? 'Answers' : 'คำตอบ'}: ${answerBlanks}</div>`;
    }
  } else if (q.type === 'short_answer') {
    if (opts.answerSheetStyle === 'lines') {
      body = `<div class="answer-lines"><div class="answer-line"></div></div>`;
    }
  } else if (q.type === 'essay') {
    if (opts.answerSheetStyle === 'lines') {
      body = `<div class="answer-lines"><div class="answer-line"></div><div class="answer-line"></div><div class="answer-line"></div><div class="answer-line mt-wide"></div></div>`;
    }
  }

  return `
    <div class="question">
      <div class="question-text">${globalIndex}. ${escapeHtml(q.text)} ${pointsHtml}</div>
      ${body}
    </div>`;
}

export function generateExamHtml(
  exam: ExamDraftWithQuestions,
  exportOpts: ExportOptions,
): string {
  const isEn = exam.language === 'en';
  const header = exam.headerInfo ?? {};
  const sectionLabels = isEn ? SECTION_LABELS_EN : SECTION_LABELS_TH;
  const questionTypes: ExamQuestion['type'][] = ['mcq', 'true_false', 'matching', 'short_answer', 'essay'];

  // Group questions by type, preserving orderIndex sort
  const byType = new Map<string, ExamQuestion[]>();
  for (const t of questionTypes) {
    const qs = exam.questions.filter((q) => q.type === t);
    if (qs.length) byType.set(t, qs);
  }

  let globalIndex = 1;
  let sectionNumber = 1;
  let sectionsHtml = '';

  for (const [type, questions] of byType) {
    const sectionPoints = questions.reduce((s, q) => s + q.points, 0);
    const pointsLabel = exportOpts.showPoints ? ` (${sectionPoints} ${isEn ? 'pts' : 'คะแนน'})` : '';
    const label = (sectionLabels[type] ?? `Part ${sectionNumber}`).replace('{n}', String(sectionNumber));
    sectionsHtml += `<div class="section"><div class="section-header">${label}${pointsLabel}</div>`;
    for (const q of questions) {
      sectionsHtml += renderQuestion(q, globalIndex++, isEn, exportOpts);
    }
    sectionsHtml += `</div>`;
    sectionNumber++;
  }

  const headerHtml = exportOpts.includeHeader ? `
    <div class="exam-header">
      ${header.schoolName ? `<div class="school-name">${escapeHtml(header.schoolName)}</div>` : ''}
      <div class="exam-title">${isEn ? 'Exam' : 'แบบทดสอบ'}: ${escapeHtml(exam.title)}</div>
      <div class="exam-meta">
        <span>${isEn ? 'Subject' : 'วิชา'}: ${escapeHtml(exam.subject)}</span>
        <span>${isEn ? 'Grade' : 'ชั้น'}: ${escapeHtml(exam.gradeLevel)}</span>
        ${header.teacherName ? `<span>${isEn ? 'Teacher' : 'ครูผู้สอน'}: ${escapeHtml(header.teacherName)}</span>` : ''}
        ${header.timeLimit ? `<span>${isEn ? 'Time' : 'เวลา'}: ${escapeHtml(header.timeLimit)}</span>` : ''}
        <span>${isEn ? 'Total' : 'คะแนนเต็ม'}: ${exam.totalPoints} ${isEn ? 'pts' : 'คะแนน'}</span>
      </div>
      <div class="student-info">
        <div class="student-field">${isEn ? 'Name' : 'ชื่อ-นามสกุล'}: <span class="field-line"></span></div>
        <div class="student-field">${isEn ? 'No.' : 'เลขที่'}: <span class="field-line short"></span></div>
        <div class="student-field">${isEn ? 'Class' : 'ชั้น/ห้อง'}: <span class="field-line short"></span></div>
        <div class="student-field">${isEn ? 'Date' : 'วันที่'}: <span class="field-line"></span></div>
        <div class="student-field">${isEn ? 'Score' : 'คะแนนที่ได้'}: <span class="field-line short"></span> / ${exam.totalPoints}</div>
      </div>
    </div>` : '';

  const instructionsHtml = exam.instructions
    ? `<div class="instructions">${escapeHtml(exam.instructions)}</div>` : '';

  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'th'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(exam.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', sans-serif; font-size: 14pt; line-height: 1.7; color: #000; background: #f5f5f5; }
    .no-print { background: #1a1a2e; color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
    .no-print button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 8px 20px; font-family: 'Sarabun', sans-serif; font-size: 13pt; cursor: pointer; }
    .no-print button:hover { background: #4338ca; }
    .page { width: 210mm; min-height: 297mm; padding: 20mm 22mm 20mm 25mm; margin: 20px auto; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
    .exam-header { margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
    .school-name { text-align: center; font-size: 15pt; font-weight: 700; }
    .exam-title { text-align: center; font-size: 14pt; font-weight: 600; margin-top: 4px; }
    .exam-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12pt; margin-top: 8px; }
    .student-info { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px 20px; margin-top: 10px; border: 1px solid #aaa; padding: 8px 12px; }
    .student-field { font-size: 12pt; }
    .field-line { display: inline-block; border-bottom: 1px solid #000; min-width: 140px; }
    .field-line.short { min-width: 60px; }
    .instructions { font-size: 12pt; margin-bottom: 14px; font-style: italic; color: #333; border-left: 3px solid #4f46e5; padding-left: 10px; }
    .section { margin-top: 20px; }
    .section-header { font-size: 13pt; font-weight: 700; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 12px; }
    .question { margin-bottom: 18px; page-break-inside: avoid; }
    .question-text { font-weight: 500; }
    .q-points { float: right; font-size: 11pt; color: #555; font-weight: 400; }
    .mcq-options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-top: 8px; margin-left: 22px; }
    .mcq-option { font-size: 13pt; }
    .mcq-label { font-weight: 600; }
    .tf-choices { display: flex; gap: 30px; margin-top: 8px; margin-left: 22px; font-size: 13pt; }
    .tf-choice { }
    .matching-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; margin-left: 22px; }
    .matching-left, .matching-right { font-size: 13pt; margin-bottom: 4px; }
    .matching-answers { margin-top: 10px; margin-left: 22px; font-size: 12pt; }
    .answer-lines { margin-top: 8px; margin-left: 22px; }
    .answer-line { border-bottom: 1px solid #999; margin-bottom: 10px; height: 24px; }
    .answer-line.mt-wide { margin-top: 4px; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; font-size: 13pt; }
      .page { width: 100%; margin: 0; padding: 15mm 20mm 15mm 22mm; box-shadow: none; }
      .question { page-break-inside: avoid; }
      .section { page-break-inside: avoid; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <span>${isEn ? '📄 Exam ready to print' : '📄 ข้อสอบพร้อมพิมพ์'}</span>
    <button onclick="window.print()">${isEn ? '🖨️ Print Exam' : '🖨️ พิมพ์ข้อสอบ'}</button>
  </div>
  <div class="page">
    ${headerHtml}
    ${instructionsHtml}
    ${sectionsHtml}
  </div>
</body>
</html>`;
}

export function generateAnswerKeyHtml(exam: ExamDraftWithQuestions): string {
  const isEn = exam.language === 'en';
  const header = exam.headerInfo ?? {};
  const labels = isEn ? MCQ_LABELS_EN : MCQ_LABELS_TH;

  const bloomsLabels: Record<string, string> = isEn
    ? { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' }
    : { remember: 'จำ', understand: 'เข้าใจ', apply: 'ประยุกต์', analyze: 'วิเคราะห์', evaluate: 'ประเมิน', create: 'สร้าง' };

  const answersHtml = exam.questions
    .map((q, i) => {
      let answerDisplay = escapeHtml(q.answer);

      if (q.type === 'mcq') {
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        const idx = options.indexOf(q.answer);
        if (idx >= 0) answerDisplay = `${labels[idx]}. ${escapeHtml(q.answer)}`;
      }

      return `
      <div class="answer-row">
        <div class="ans-num">${i + 1}.</div>
        <div class="ans-content">
          <div class="ans-question">${escapeHtml(q.text)}</div>
          <div class="ans-answer"><strong>${isEn ? 'Answer' : 'เฉลย'}:</strong> ${answerDisplay}</div>
          ${q.explanation ? `<div class="ans-explanation">${escapeHtml(q.explanation)}</div>` : ''}
          <div class="ans-meta">
            <span class="blooms-tag">${bloomsLabels[q.bloomsLevel] ?? q.bloomsLevel}</span>
            <span class="points-tag">${q.points} ${isEn ? 'pts' : 'คะแนน'}</span>
          </div>
        </div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'th'}">
<head>
  <meta charset="UTF-8">
  <title>${isEn ? 'Answer Key' : 'เฉลย'} — ${escapeHtml(exam.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', sans-serif; font-size: 13pt; line-height: 1.6; color: #000; background: #f5f5f5; }
    .no-print { background: #14532d; color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; }
    .no-print button { background: #16a34a; color: #fff; border: none; border-radius: 6px; padding: 8px 20px; font-family: 'Sarabun', sans-serif; font-size: 12pt; cursor: pointer; }
    .page { width: 210mm; min-height: 297mm; padding: 18mm 22mm; margin: 20px auto; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
    .key-header { border-bottom: 2px solid #16a34a; margin-bottom: 16px; padding-bottom: 10px; }
    .key-title { font-size: 16pt; font-weight: 700; color: #14532d; }
    .key-subtitle { font-size: 12pt; color: #555; margin-top: 4px; }
    .answer-row { display: grid; grid-template-columns: 28px 1fr; gap: 8px; margin-bottom: 14px; page-break-inside: avoid; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; }
    .ans-num { font-weight: 700; color: #14532d; padding-top: 2px; }
    .ans-question { font-size: 12pt; color: #555; margin-bottom: 4px; }
    .ans-answer { font-weight: 600; font-size: 13pt; color: #14532d; }
    .ans-explanation { font-size: 11pt; color: #444; margin-top: 4px; }
    .ans-meta { display: flex; gap: 8px; margin-top: 6px; }
    .blooms-tag { background: #ede9fe; color: #5b21b6; border-radius: 99px; padding: 1px 10px; font-size: 10pt; }
    .points-tag { background: #dcfce7; color: #14532d; border-radius: 99px; padding: 1px 10px; font-size: 10pt; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; }
      .page { width: 100%; margin: 0; padding: 15mm 20mm; box-shadow: none; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <span>🔑 ${isEn ? 'Answer Key' : 'เฉลยข้อสอบ'}</span>
    <button onclick="window.print()">🖨️ ${isEn ? 'Print Answer Key' : 'พิมพ์เฉลย'}</button>
  </div>
  <div class="page">
    <div class="key-header">
      <div class="key-title">🔑 ${isEn ? 'Answer Key' : 'เฉลย'}</div>
      <div class="key-subtitle">${escapeHtml(exam.title)} · ${escapeHtml(exam.subject)} · ${escapeHtml(exam.gradeLevel)}${header.teacherName ? ` · ${escapeHtml(header.teacherName)}` : ''}</div>
    </div>
    ${answersHtml}
  </div>
</body>
</html>`;
}
