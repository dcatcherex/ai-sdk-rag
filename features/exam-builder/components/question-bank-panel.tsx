'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus } from 'lucide-react';
import { useBankQuestions, useAddBankQuestionToExam } from '@/features/exam-builder/hooks/use-exams';
import type { ExamBloomsLevel, ExamQuestionType } from '@/features/exam-builder/types';

const BLOOMS_COLORS: Record<ExamBloomsLevel, string> = {
  remember: 'bg-sky-100 text-sky-700',
  understand: 'bg-green-100 text-green-700',
  apply: 'bg-yellow-100 text-yellow-700',
  analyze: 'bg-orange-100 text-orange-700',
  evaluate: 'bg-red-100 text-red-700',
  create: 'bg-purple-100 text-purple-700',
};

const TYPE_LABELS: Record<ExamQuestionType, string> = {
  mcq: 'ปรนัย',
  true_false: 'ถูก/ผิด',
  short_answer: 'เติมคำตอบ',
  matching: 'จับคู่',
  essay: 'อัตนัย',
};

type Props = { activeExamId: string | null };

export function QuestionBankPanel({ activeExamId }: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBlooms, setFilterBlooms] = useState<string>('all');

  const filters: Record<string, string> = {};
  if (filterType !== 'all') filters.type = filterType;
  if (filterBlooms !== 'all') filters.bloomsLevel = filterBlooms;

  const { data: questions = [], isLoading } = useBankQuestions(Object.keys(filters).length ? filters : undefined);
  const addToExamMutation = useAddBankQuestionToExam(activeExamId ?? '');

  const filtered = questions.filter((q) =>
    !search || q.text.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="ค้นหาคำถาม…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="รูปแบบ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกรูปแบบ</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBlooms} onValueChange={setFilterBlooms}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Bloom's" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับ</SelectItem>
            {Object.keys(BLOOMS_COLORS).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!activeExamId && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          เปิดข้อสอบในแท็บ "สร้างข้อสอบ" ก่อน จึงจะสามารถเพิ่มคำถามจากคลังได้
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {questions.length === 0
            ? 'คลังข้อยังว่างอยู่ — คำถามจะถูกบันทึกอัตโนมัติเมื่อคุณสร้างข้อสอบ'
            : 'ไม่พบคำถามที่ค้นหา'}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((q) => (
          <div key={q.id} className="rounded-xl border border-zinc-200 dark:border-border p-3 space-y-2">
            <div className="flex items-start gap-2">
              <p className="text-sm flex-1 min-w-0">{q.text}</p>
              {activeExamId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => addToExamMutation.mutate(q.id)}
                  disabled={addToExamMutation.isPending}
                >
                  <Plus className="h-3 w-3 mr-1" /> เพิ่ม
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {TYPE_LABELS[q.type]}
              </span>
              <span className={`px-2 py-0.5 rounded-full ${BLOOMS_COLORS[q.bloomsLevel]}`}>
                {q.bloomsLevel}
              </span>
              <span className="text-muted-foreground">{q.subject} · {q.gradeLevel}</span>
              {q.useCount > 0 && (
                <Badge variant="secondary" className="text-xs">ใช้ {q.useCount} ครั้ง</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
