'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Wand2, Plus, Trash2, Pencil, Check, X, Download, BookOpen } from 'lucide-react';
import {
  useExam, useCreateExam, useUpdateExam, useGenerateQuestions,
  useAddQuestions, useUpdateQuestion, useDeleteQuestion, useExportExam,
} from '@/features/exam-builder/hooks/use-exams';
import type { ExamDraft, ExamQuestion, GeneratedQuestion, ExamQuestionType, ExamBloomsLevel } from '@/features/exam-builder/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const THAI_SUBJECTS = [
  'ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี',
  'สังคมศึกษาฯ', 'ศิลปะ', 'สุขศึกษาและพลศึกษา',
  'การงานอาชีพ', 'ภาษาอังกฤษ',
];

const GRADE_LEVELS = [
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
];

const QUESTION_TYPES: { value: ExamQuestionType; label: string }[] = [
  { value: 'mcq', label: 'ปรนัย (MCQ)' },
  { value: 'true_false', label: 'ถูก/ผิด' },
  { value: 'short_answer', label: 'เติมคำตอบ' },
  { value: 'matching', label: 'จับคู่' },
  { value: 'essay', label: 'อัตนัย' },
];

const BLOOMS_LEVELS: { value: ExamBloomsLevel; label: string; color: string }[] = [
  { value: 'remember', label: 'จำ (Remember)', color: 'bg-sky-100 text-sky-700' },
  { value: 'understand', label: 'เข้าใจ (Understand)', color: 'bg-green-100 text-green-700' },
  { value: 'apply', label: 'ประยุกต์ (Apply)', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'analyze', label: 'วิเคราะห์ (Analyze)', color: 'bg-orange-100 text-orange-700' },
  { value: 'evaluate', label: 'ประเมิน (Evaluate)', color: 'bg-red-100 text-red-700' },
  { value: 'create', label: 'สร้าง (Create)', color: 'bg-purple-100 text-purple-700' },
];

function bloomsColor(level: ExamBloomsLevel): string {
  return BLOOMS_LEVELS.find((b) => b.value === level)?.color ?? 'bg-zinc-100 text-zinc-600';
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  examId,
  onDelete,
}: {
  question: ExamQuestion;
  index: number;
  examId: string;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [answer, setAnswer] = useState(question.answer);
  const [explanation, setExplanation] = useState(question.explanation);
  const [points, setPoints] = useState(question.points);
  const [bloomsLevel, setBloomsLevel] = useState<ExamBloomsLevel>(question.bloomsLevel);
  const updateMutation = useUpdateQuestion(examId);

  async function handleSave() {
    await updateMutation.mutateAsync({
      questionId: question.id,
      patch: { text, answer, explanation, points, bloomsLevel },
    });
    setEditing(false);
  }

  const typeLabel = QUESTION_TYPES.find((t) => t.value === question.type)?.label ?? question.type;
  const options = Array.isArray(question.options) ? (question.options as string[]) : null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0 w-6">{index}.</span>
        <div className="flex-1 min-w-0 space-y-2">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">คำถาม</Label>
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">คำตอบที่ถูกต้อง</Label>
                  <Input value={answer} onChange={(e) => setAnswer(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">คะแนน</Label>
                  <Input type="number" min={1} value={points} onChange={(e) => setPoints(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bloom's Level</Label>
                <Select value={bloomsLevel} onValueChange={(v) => setBloomsLevel(v as ExamBloomsLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BLOOMS_LEVELS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">คำอธิบาย (สำหรับเฉลย)</Label>
                <Textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Check className="mr-1 h-3.5 w-3.5" /> บันทึก
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm">{question.text}</p>
              {options && question.type === 'mcq' && (
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {options.map((opt, i) => {
                    const labels = ['ก', 'ข', 'ค', 'ง'];
                    return (
                      <span key={i} className={opt === question.answer ? 'text-green-600 font-medium' : ''}>
                        {labels[i]}. {opt}
                      </span>
                    );
                  })}
                </div>
              )}
              {question.type === 'true_false' && (
                <p className="text-xs text-green-600 font-medium">✓ {question.answer}</p>
              )}
              {(question.type === 'short_answer' || question.type === 'essay') && (
                <p className="text-xs text-muted-foreground line-clamp-1">เฉลย: {question.answer}</p>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{typeLabel}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${bloomsColor(question.bloomsLevel)}`}>
            {BLOOMS_LEVELS.find((b) => b.value === question.bloomsLevel)?.label ?? question.bloomsLevel}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">{question.points} คะแนน</span>
        </div>
      )}
    </div>
  );
}

// ── Generate panel ────────────────────────────────────────────────────────────

function GeneratePanel({
  exam,
  onGenerated,
}: {
  exam: ExamDraft;
  onGenerated: (questions: GeneratedQuestion[]) => void;
}) {
  const [topic, setTopic] = useState('');
  const [countPerType, setCountPerType] = useState(3);
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ExamQuestionType[]>(exam.enabledTypes as ExamQuestionType[]);
  const [selectedBlooms, setSelectedBlooms] = useState<ExamBloomsLevel[]>(exam.enabledBloomsLevels as ExamBloomsLevel[]);
  const generateMutation = useGenerateQuestions();

  function toggle<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  async function handleGenerate() {
    if (!topic.trim() || selectedTypes.length === 0 || selectedBlooms.length === 0) return;
    const result = await generateMutation.mutateAsync({
      topic,
      subject: exam.subject,
      gradeLevel: exam.gradeLevel,
      language: exam.language,
      questionTypes: selectedTypes,
      bloomsLevels: selectedBlooms,
      countPerType,
      sourceMaterial: sourceMaterial || undefined,
    });
    onGenerated(result.questions);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-border p-4 space-y-4">
      <p className="text-sm font-semibold">🤖 สร้างคำถามด้วย AI</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="gen-topic">หัวข้อ / เนื้อหาที่ต้องการออกข้อสอบ *</Label>
          <Input id="gen-topic" placeholder="เช่น สมการเส้นตรง, การสังเคราะห์แสง, ประวัติสุโขทัย" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>รูปแบบคำถาม (เลือกได้หลายแบบ)</Label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedTypes(toggle(selectedTypes, t.value))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedTypes.includes(t.value) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-zinc-300 text-zinc-600 hover:border-indigo-400'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>ระดับ Bloom's (เลือกได้หลายระดับ)</Label>
          <div className="flex flex-wrap gap-2">
            {BLOOMS_LEVELS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setSelectedBlooms(toggle(selectedBlooms, b.value))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedBlooms.includes(b.value) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-zinc-300 text-zinc-600 hover:border-indigo-400'}`}
              >
                {b.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>จำนวนข้อต่อรูปแบบ</Label>
          <Input type="number" min={1} max={10} value={countPerType} onChange={(e) => setCountPerType(parseInt(e.target.value) || 1)} />
        </div>
        <div className="space-y-1.5">
          <Label>เนื้อหาอ้างอิง (ไม่บังคับ)</Label>
          <Textarea rows={2} placeholder="วางเนื้อหาหรือบทเรียน…" value={sourceMaterial} onChange={(e) => setSourceMaterial(e.target.value)} />
        </div>
      </div>
      {generateMutation.error && <p className="text-sm text-red-500">{generateMutation.error.message}</p>}
      <Button onClick={handleGenerate} disabled={generateMutation.isPending || !topic.trim() || selectedTypes.length === 0 || selectedBlooms.length === 0}>
        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
        {generateMutation.isPending ? 'กำลังสร้าง…' : 'สร้างคำถาม'}
      </Button>
    </div>
  );
}

// ── Export panel ──────────────────────────────────────────────────────────────

function ExportPanel({ examId }: { examId: string }) {
  const [showPoints, setShowPoints] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [answerSheetStyle, setAnswerSheetStyle] = useState<'lines' | 'none'>('lines');
  const exportMutation = useExportExam(examId);

  function openInNewTab(html: string) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function handleExport(type: 'exam' | 'key') {
    const result = await exportMutation.mutateAsync({ showPoints, includeHeader, answerSheetStyle });
    openInNewTab(type === 'exam' ? result.examHtml : result.answerKeyHtml);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-border p-4 space-y-4">
      <p className="text-sm font-semibold">📄 ส่งออกข้อสอบ</p>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id="show-points" checked={showPoints} onCheckedChange={(v) => setShowPoints(Boolean(v))} />
          <Label htmlFor="show-points" className="text-sm font-normal cursor-pointer">แสดงคะแนนแต่ละข้อ</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="include-header" checked={includeHeader} onCheckedChange={(v) => setIncludeHeader(Boolean(v))} />
          <Label htmlFor="include-header" className="text-sm font-normal cursor-pointer">ใส่ส่วนหัวข้อสอบ (ชื่อโรงเรียน วิชา ระดับชั้น)</Label>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">ช่องเขียนคำตอบ</Label>
          <Select value={answerSheetStyle} onValueChange={(v) => setAnswerSheetStyle(v as 'lines' | 'none')}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">เส้นว่างให้เขียน</SelectItem>
              <SelectItem value="none">ไม่มีช่องคำตอบ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {exportMutation.error && <p className="text-sm text-red-500">{exportMutation.error.message}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => handleExport('exam')} disabled={exportMutation.isPending}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {exportMutation.isPending ? 'กำลังสร้าง…' : 'ดาวน์โหลดข้อสอบ'}
        </Button>
        <Button variant="outline" onClick={() => handleExport('key')} disabled={exportMutation.isPending}>
          <BookOpen className="mr-1.5 h-3.5 w-3.5" /> ดาวน์โหลดเฉลย
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">ข้อสอบจะเปิดในแท็บใหม่ กด Ctrl+P หรือ ⌘+P เพื่อพิมพ์</p>
    </div>
  );
}

// ── Setup form ────────────────────────────────────────────────────────────────

function SetupForm({
  initial,
  onSaved,
}: {
  initial?: ExamDraft;
  onSaved: (exam: ExamDraft) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? 'คณิตศาสตร์');
  const [gradeLevel, setGradeLevel] = useState(initial?.gradeLevel ?? 'ป.1');
  const [language, setLanguage] = useState<'th' | 'en'>(initial?.language ?? 'th');
  const [schoolName, setSchoolName] = useState(initial?.headerInfo?.schoolName ?? '');
  const [teacherName, setTeacherName] = useState(initial?.headerInfo?.teacherName ?? '');
  const [className, setClassName] = useState(initial?.headerInfo?.className ?? '');
  const [timeLimit, setTimeLimit] = useState(initial?.headerInfo?.timeLimit ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');

  const createMutation = useCreateExam();
  const updateMutation = useUpdateExam(initial?.id ?? '');

  async function handleSave() {
    const payload = {
      title: title || `ข้อสอบ${subject} ${gradeLevel}`,
      subject,
      gradeLevel,
      language,
      instructions: instructions || undefined,
      headerInfo: { schoolName, teacherName, className, timeLimit },
      enabledTypes: ['mcq', 'true_false', 'short_answer', 'essay', 'matching'] as ExamQuestionType[],
      enabledBloomsLevels: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as ExamBloomsLevel[],
    };

    const result = initial
      ? await updateMutation.mutateAsync(payload)
      : await createMutation.mutateAsync(payload);

    if (result) onSaved(result as ExamDraft);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-border p-4 space-y-4">
      <p className="text-sm font-semibold">⚙️ ตั้งค่าข้อสอบ</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <Label>ชื่อข้อสอบ</Label>
          <Input placeholder="เช่น แบบทดสอบกลางภาค วิชาคณิตฯ ป.4" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>วิชา</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {THAI_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ระดับชั้น</Label>
          <Select value={gradeLevel} onValueChange={setGradeLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ภาษาที่ใช้ในข้อสอบ</Label>
          <Select value={language} onValueChange={(v) => setLanguage(v as 'th' | 'en')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="th">🇹🇭 ภาษาไทย</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ชื่อโรงเรียน (ไม่บังคับ)</Label>
          <Input placeholder="โรงเรียน…" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>ชื่อครูผู้สอน (ไม่บังคับ)</Label>
          <Input placeholder="ครู…" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>ชั้น/ห้อง (ไม่บังคับ)</Label>
          <Input placeholder="เช่น ป.4/2" value={className} onChange={(e) => setClassName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>เวลาสอบ (ไม่บังคับ)</Label>
          <Input placeholder="เช่น 60 นาที" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>คำชี้แจง (ไม่บังคับ)</Label>
          <Textarea rows={2} placeholder="คำชี้แจงสำหรับนักเรียน…" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? 'กำลังบันทึก…' : initial ? 'อัปเดต' : 'สร้างข้อสอบ'}
      </Button>
    </div>
  );
}

// ── Exam Editor ───────────────────────────────────────────────────────────────

type Props = {
  initialExam?: ExamDraft | null;
  onBack: () => void;
};

export function ExamEditor({ initialExam, onBack }: Props) {
  const [examId, setExamId] = useState<string | null>(initialExam?.id ?? null);
  const [pendingQuestions, setPendingQuestions] = useState<GeneratedQuestion[]>([]);
  const { data: exam } = useExam(examId);
  const addQuestionsMutation = useAddQuestions(examId ?? '');
  const deleteQuestionMutation = useDeleteQuestion(examId ?? '');

  async function handleAddPending() {
    if (!examId || pendingQuestions.length === 0) return;
    await addQuestionsMutation.mutateAsync(pendingQuestions);
    setPendingQuestions([]);
  }

  const questions = exam?.questions ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> กลับ
        </Button>
        <h3 className="text-sm font-semibold">{exam?.title ?? 'ข้อสอบใหม่'}</h3>
        {exam && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {questions.length} ข้อ · {exam.totalPoints} คะแนน
          </Badge>
        )}
      </div>

      {/* Setup */}
      <SetupForm
        initial={exam ?? initialExam ?? undefined}
        onSaved={(saved) => setExamId(saved.id)}
      />

      {/* Generate — only show after exam is created */}
      {examId && exam && (
        <>
          <GeneratePanel
            exam={exam}
            onGenerated={(qs) => setPendingQuestions(qs)}
          />

          {/* Preview of pending questions before adding */}
          {pendingQuestions.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  AI สร้างคำถามแล้ว {pendingQuestions.length} ข้อ — ตรวจสอบก่อนเพิ่มเข้าข้อสอบ
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPending} disabled={addQuestionsMutation.isPending}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {addQuestionsMutation.isPending ? 'กำลังเพิ่ม…' : `เพิ่มทั้งหมด ${pendingQuestions.length} ข้อ`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingQuestions([])}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingQuestions.map((q, i) => (
                  <div key={`${q.type}-${i}-${q.text.slice(0, 20)}`} className="text-xs bg-white dark:bg-zinc-900 rounded-lg p-2 border border-indigo-100 dark:border-indigo-900/30">
                    <span className="font-medium">{i + 1}. [{QUESTION_TYPES.find((t) => t.value === q.type)?.label ?? q.type}]</span> {q.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question list */}
          {questions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">รายการคำถาม</p>
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i + 1}
                  examId={examId}
                  onDelete={() => deleteQuestionMutation.mutate(q.id)}
                />
              ))}
            </div>
          )}

          {/* Export */}
          {questions.length > 0 && <ExportPanel examId={examId} />}
        </>
      )}
    </div>
  );
}
