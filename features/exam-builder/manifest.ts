import type { ToolManifest } from '@/features/tools/registry/types';

export const examBuilderManifest: ToolManifest = {
  id: 'exam_builder',
  slug: 'exam-builder',
  title: 'Exam Builder',
  description:
    'สร้างข้อสอบสำหรับนักเรียนระดับประถมและมัธยมตามหลักสูตรแกนกลาง รองรับ Bloom\'s Taxonomy ทุกระดับ และส่งออกข้อสอบพร้อมเฉลยในรูปแบบพิมพ์ได้',
  icon: 'ClipboardList',
  category: 'assessment',
  professions: ['teacher', 'all'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: false,
  sidebar: {
    order: 120,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
