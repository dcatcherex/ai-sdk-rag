import type { TextFieldConfig } from '@/lib/certificate-generator';

export type { TextFieldConfig };

export type CertificateTemplate = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  r2Key: string;
  url: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  fields: TextFieldConfig[];
  createdAt: string;
  updatedAt: string;
};

export type CertificateJob = {
  id: string;
  userId: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  totalCount: number;
  processedCount: number;
  zipKey: string | null;
  zipUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type Recipient = {
  /** keyed by fieldId */
  values: Record<string, string>;
};

export const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'pdf', label: 'PDF' },
] as const;

export type ExportFormat = 'png' | 'jpg' | 'pdf';

export const DEFAULT_FIELD: Omit<TextFieldConfig, 'id' | 'label'> = {
  xPercent: 50,
  yPercent: 50,
  fontSize: 48,
  minFontSize: 18,
  maxWidthPercent: 70,
  fontFamily: 'Arial',
  color: '#1a1a1a',
  fontWeight: 'bold',
  align: 'center',
};
