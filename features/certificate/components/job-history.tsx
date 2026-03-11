'use client';

import { Download, FileStack, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CertificateJob } from '../types';

type Props = {
  onSourceChange: (value: CertificateJob['source'] | 'all') => void;
  onStatusChange: (value: CertificateJob['status'] | 'all') => void;
  selectedSource: CertificateJob['source'] | 'all';
  selectedStatus: CertificateJob['status'] | 'all';
  isLoading: boolean;
  jobs: CertificateJob[];
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getStatusVariant(status: CertificateJob['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'processing') return 'secondary';
  return 'outline';
}

function getSourceVariant(source: CertificateJob['source']): 'secondary' | 'outline' {
  return source === 'agent' ? 'secondary' : 'outline';
}

export function JobHistory({ jobs, isLoading, onSourceChange, onStatusChange, selectedSource, selectedStatus }: Props) {
  async function handleDownload(job: CertificateJob) {
    const key = job.resultKey ?? job.zipKey;
    const filename = job.fileName ?? job.resultPayload?.fileName ?? undefined;

    if (!key) return;

    const fileUrl = `/api/certificate/files?key=${encodeURIComponent(key)}&download=1${filename ? `&filename=${encodeURIComponent(filename)}` : ''}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename ?? 'certificate-output';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileStack className="h-4 w-4" />
          Recent jobs
        </CardTitle>
        <CardDescription>
          Review recent certificate outputs from manual actions and agent tool runs.
        </CardDescription>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
          <Select value={selectedSource} onValueChange={(value) => onSourceChange(value as CertificateJob['source'] | 'all')}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={(value) => onStatusChange(value as CertificateJob['status'] | 'all')}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading recent jobs…
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certificate jobs yet.</p>
        ) : (
          jobs.map((job) => {
            const fileName = job.fileName ?? job.resultPayload?.fileName ?? 'Generated file';
            const recipientCount = job.requestPayload?.recipientCount ?? job.totalCount;
            const canDownload = Boolean(job.resultKey ?? job.zipKey);

            return (
              <div key={job.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{fileName}</p>
                      <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                      <Badge variant={getSourceVariant(job.source)}>{job.source}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} · {job.exportMode} · {job.format.toUpperCase()} · {formatTimestamp(job.createdAt)}
                    </p>
                    {job.error ? (
                      <p className="text-xs text-red-500">{job.error}</p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canDownload}
                    onClick={() => {
                      void handleDownload(job);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
