'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/page-header';
import type { ToolManifest } from '@/features/tools/registry/types';
import type { ExamDraft } from '@/features/exam-builder/types';
import { ExamList } from '@/features/exam-builder/components/exam-list';
import { ExamEditor } from '@/features/exam-builder/components/exam-editor';
import { QuestionBankPanel } from '@/features/exam-builder/components/question-bank-panel';

type Props = { manifest: ToolManifest };

export function ExamBuilderToolPage({ manifest }: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'editor' | 'bank'>('list');
  const [editingExam, setEditingExam] = useState<ExamDraft | null>(null);

  function openEditor(exam?: ExamDraft) {
    setEditingExam(exam ?? null);
    setActiveTab('editor');
  }

  function handleBack() {
    setEditingExam(null);
    setActiveTab('list');
  }

  return (
    <>
      <PageHeader title={manifest.title} description={manifest.description} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="list">ข้อสอบของฉัน</TabsTrigger>
            <TabsTrigger value="editor">สร้าง / แก้ไข</TabsTrigger>
            <TabsTrigger value="bank">คลังข้อ</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <ExamList
              onEdit={(exam) => openEditor(exam)}
              onCreate={() => openEditor()}
            />
          </TabsContent>

          <TabsContent value="editor">
            <ExamEditor
              initialExam={editingExam}
              onBack={handleBack}
            />
          </TabsContent>

          <TabsContent value="bank">
            <QuestionBankPanel activeExamId={editingExam?.id ?? null} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
