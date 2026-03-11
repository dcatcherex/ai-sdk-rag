import type { TextFieldConfig } from '@/lib/certificate-generator';
import type { CertificateTemplateType, PrintSheetSettings } from '@/lib/certificate-print';

export type { TextFieldConfig };
export type { CertificateTemplateType, PrintSheetSettings };

export type CertificateTemplate = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  templateType: CertificateTemplateType;
  r2Key: string;
  url: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  backR2Key: string | null;
  backUrl: string | null;
  backThumbnailKey: string | null;
  backThumbnailUrl: string | null;
  width: number;
  height: number;
  backWidth: number | null;
  backHeight: number | null;
  fields: TextFieldConfig[];
  backFields: TextFieldConfig[];
  printSettings: PrintSheetSettings;
  createdAt: string;
  updatedAt: string;
};

export type CertificateJob = {
  id: string;
  userId: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  exportMode: 'single_file' | 'zip' | 'single_pdf' | 'sheet_pdf';
  source: 'manual' | 'agent';
  totalCount: number;
  processedCount: number;
  fileName: string | null;
  downloadLabel: string | null;
  resultKey: string | null;
  resultUrl: string | null;
  zipKey: string | null;
  zipUrl: string | null;
  requestPayload: {
    fieldIds: string[];
    hasBackSide: boolean;
    recipientCount: number;
    recipientPreview: string[];
    requiredFieldIds: string[];
    templateName: string;
  } | null;
  resultPayload: {
    downloadLabel: string;
    fileKey: string;
    fileName: string;
    fileUrl: string;
    isDuplexSheet: boolean;
  } | null;
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
  required: false,
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
