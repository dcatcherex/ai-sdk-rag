'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, FileText, GraduationCap } from 'lucide-react';
import { useExams, useDeleteExam } from '@/features/exam-builder/hooks/use-exams';
import type { ExamDraft } from '@/features/exam-builder/types';

type Props = {
  onEdit: (exam: ExamDraft) => void;
  onCreate: () => void;
};

export function ExamList({ onEdit, onCreate }: Props) {
  const { data: exams = [], isLoading } = useExams();
  const deleteMutation = useDeleteExam();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setConfirmDelete(null);
  }

  const subjectColors: Record<string, string> = {
    'ภาษาไทย': 'bg-rose-100 text-rose-700',
    'คณิตศาสตร์': 'bg-blue-100 text-blue-700',
    'วิทยาศาสตร์': 'bg-green-100 text-green-700',
    'สังคมศึกษา': 'bg-amber-100 text-amber-700',
    'ภาษาอังกฤษ': 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {exams.length === 0 ? 'ยังไม่มีข้อสอบ' : `${exams.length} ข้อสอบ`}
        </p>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> สร้างข้อสอบใหม่
        </Button>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด…</div>
      )}

      {!isLoading && exams.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 py-16 text-center space-y-3">
          <GraduationCap className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อสอบ กดปุ่ม "สร้างข้อสอบใหม่" เพื่อเริ่มต้น</p>
          <Button size="sm" onClick={onCreate}><Plus className="mr-1.5 h-3.5 w-3.5" /> สร้างข้อสอบใหม่</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exams.map((exam) => {
          const subjectColor = subjectColors[exam.subject] ?? 'bg-zinc-100 text-zinc-700';
          return (
            <div key={exam.id} className="rounded-xl border border-zinc-200 dark:border-border p-4 space-y-3 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{exam.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${subjectColor}`}>{exam.subject}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{exam.gradeLevel}</span>
                    <Badge variant={exam.status === 'finalized' ? 'default' : 'secondary'} className="text-xs">
                      {exam.status === 'finalized' ? 'เสร็จสิ้น' : 'ฉบับร่าง'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(exam)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {confirmDelete === exam.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleDelete(exam.id)}>ยืนยัน</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setConfirmDelete(null)}>ยกเลิก</Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(exam.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{exam.totalPoints} คะแนน</span>
                <span>{exam.language === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 English'}</span>
                <span className="ml-auto">{new Date(exam.updatedAt).toLocaleDateString('th-TH')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
