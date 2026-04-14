'use client';

import { useState } from 'react';
import type { ToolManifest } from '@/features/tools/registry/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useAppendGoogleSheetRow,
  useCreateGoogleSpreadsheet,
  useCreateGoogleSheetTab,
  useReadGoogleSheetRange,
  useUpdateGoogleSheetRange,
} from '@/features/google-sheets/hooks/use-google-sheets';
import {
  useDisconnectGoogleWorkspace,
  useGoogleWorkspaceStatus,
} from '@/features/google-workspace/hooks/use-google-workspace';

type Props = { manifest: ToolManifest };

export function GoogleSheetsToolPage({ manifest }: Props) {
  const statusQuery = useGoogleWorkspaceStatus();
  const disconnectMutation = useDisconnectGoogleWorkspace();
  const readMutation = useReadGoogleSheetRange();
  const appendMutation = useAppendGoogleSheetRow();
  const updateMutation = useUpdateGoogleSheetRange();
  const createTabMutation = useCreateGoogleSheetTab();
  const createSpreadsheetMutation = useCreateGoogleSpreadsheet();

  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [createSpreadsheetTitle, setCreateSpreadsheetTitle] = useState('Gradebook');
  const [createSpreadsheetFolderId, setCreateSpreadsheetFolderId] = useState('');
  const [createSpreadsheetHeaders, setCreateSpreadsheetHeaders] = useState('Student Name,Student ID,Score,Status');
  const [readRange, setReadRange] = useState('Sheet1!A1:F20');
  const [appendSheetName, setAppendSheetName] = useState('Sheet1');
  const [appendRowJson, setAppendRowJson] = useState('{\n  "Student Name": "Somchai",\n  "Score": 18,\n  "Status": "passed"\n}');
  const [updateRange, setUpdateRange] = useState('Sheet1!B2:C2');
  const [updateValuesJson, setUpdateValuesJson] = useState('[["18", "passed"]]');
  const [newTabTitle, setNewTabTitle] = useState('Term 2');
  const [localError, setLocalError] = useState<string | null>(null);

  const applyTeacherPreset = () => {
    setCreateSpreadsheetTitle('Teacher Gradebook');
    setCreateSpreadsheetHeaders('Student Name,Student ID,Score,Status');
    setReadRange('Gradebook!A1:F20');
    setAppendSheetName('Gradebook');
    setAppendRowJson('{\n  "Student Name": "Somchai Jaidee",\n  "Student ID": "M2-014",\n  "Score": 18,\n  "Status": "passed"\n}');
    setUpdateRange('Gradebook!C2:D2');
    setUpdateValuesJson('[["18", "passed"]]');
    setNewTabTitle('Midterm Scores');
  };

  const applyBusinessPreset = () => {
    setCreateSpreadsheetTitle('CRM Leads');
    setCreateSpreadsheetHeaders('Customer Name,Phone,Status');
    setReadRange('Leads!A1:F20');
    setAppendSheetName('Leads');
    setAppendRowJson('{\n  "Customer Name": "Suda Clinic",\n  "Phone": "0812345678",\n  "Status": "new lead"\n}');
    setUpdateRange('Leads!C2:D2');
    setUpdateValuesJson('[["follow-up", "high priority"]]');
    setNewTabTitle('April Leads');
  };

  const latestResult =
    createSpreadsheetMutation.data ??
    createTabMutation.data ??
    updateMutation.data ??
    appendMutation.data ??
    readMutation.data;

  const handleAppend = async () => {
    setLocalError(null);
    try {
      await appendMutation.mutateAsync({
        spreadsheetId,
        sheetName: appendSheetName,
        row: JSON.parse(appendRowJson) as Record<string, string | number | boolean | null>,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Append failed');
    }
  };

  const handleUpdate = async () => {
    setLocalError(null);
    try {
      await updateMutation.mutateAsync({
        spreadsheetId,
        range: updateRange,
        values: JSON.parse(updateValuesJson) as Array<Array<string | number | boolean | null>>,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Update failed');
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="rounded-3xl border bg-background/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {manifest.title}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Google Sheets Control Room
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Connect a Google account, test spreadsheet actions, and use the same
          service layer the agent will call for gradebooks, score tracking, and
          structured record sync.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href="/api/integrations/google/connect?returnTo=/tools/google-sheets"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Connect Google
          </a>
          <Button
            variant="outline"
            onClick={() => void statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            Refresh Status
          </Button>
          <Button
            variant="outline"
            onClick={() => void disconnectMutation.mutateAsync()}
            disabled={disconnectMutation.isPending || !statusQuery.data?.connected}
          >
            Disconnect
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={applyTeacherPreset}>
            Teacher Scorebook Preset
          </Button>
          <Button variant="outline" size="sm" onClick={applyBusinessPreset}>
            Business CRM Preset
          </Button>
        </div>
        <div className="mt-4 rounded-2xl border p-4 text-sm">
          <div className="font-medium">
            {statusQuery.data?.configured ? 'OAuth configured' : 'OAuth not configured'}
          </div>
          <div className="mt-1 text-muted-foreground">
            {statusQuery.data?.connected
              ? `Connected as ${statusQuery.data.account?.email ?? statusQuery.data.account?.displayName ?? 'Google account'}`
              : 'No Google account connected yet.'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Create Spreadsheet in Drive Folder</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={createSpreadsheetTitle}
              onChange={(event) => setCreateSpreadsheetTitle(event.target.value)}
              placeholder="Spreadsheet title"
            />
            <Input
              value={createSpreadsheetFolderId}
              onChange={(event) => setCreateSpreadsheetFolderId(event.target.value)}
              placeholder="Drive folder ID (optional)"
            />
            <Input
              value={createSpreadsheetHeaders}
              onChange={(event) => setCreateSpreadsheetHeaders(event.target.value)}
              placeholder="Comma-separated headers (optional)"
            />
            <Button
              onClick={() =>
                void createSpreadsheetMutation
                  .mutateAsync({
                    title: createSpreadsheetTitle,
                    folderId: createSpreadsheetFolderId || undefined,
                    headers: createSpreadsheetHeaders
                      ? createSpreadsheetHeaders.split(',').map((value) => value.trim()).filter(Boolean)
                      : undefined,
                  })
                  .then((result) => {
                    const payload = result as { data?: { spreadsheetId?: string } } | undefined;
                    const nextSpreadsheetId = payload?.data?.spreadsheetId;
                    if (nextSpreadsheetId) setSpreadsheetId(nextSpreadsheetId);
                  })
              }
              disabled={createSpreadsheetMutation.isPending || !createSpreadsheetTitle}
            >
              Create Spreadsheet
            </Button>
            <p className="text-xs text-muted-foreground">
              This can create a spreadsheet directly inside the specified Google Drive folder.
              If creation succeeds, the new spreadsheet ID is copied into the target field below.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Spreadsheet Target</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={spreadsheetId}
              onChange={(event) => setSpreadsheetId(event.target.value)}
              placeholder="Spreadsheet ID"
            />
            <p className="text-xs text-muted-foreground">
              Paste the Google Sheets spreadsheet ID once and use it for the test
              actions below.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Create Worksheet Tab</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={newTabTitle}
              onChange={(event) => setNewTabTitle(event.target.value)}
              placeholder="New tab title"
            />
            <Button
              onClick={() => void createTabMutation.mutateAsync({ spreadsheetId, title: newTabTitle })}
              disabled={createTabMutation.isPending || !spreadsheetId || !newTabTitle}
            >
              Create Tab
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Read Range</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={readRange}
              onChange={(event) => setReadRange(event.target.value)}
              placeholder="Sheet1!A1:F20"
            />
            <Button
              onClick={() => void readMutation.mutateAsync({ spreadsheetId, range: readRange })}
              disabled={readMutation.isPending || !spreadsheetId || !readRange}
            >
              Read Range
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Append Row by Header Name</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={appendSheetName}
              onChange={(event) => setAppendSheetName(event.target.value)}
              placeholder="Sheet name"
            />
            <Textarea
              value={appendRowJson}
              onChange={(event) => setAppendRowJson(event.target.value)}
              rows={7}
            />
            <Button
              onClick={handleAppend}
              disabled={appendMutation.isPending || !spreadsheetId || !appendSheetName}
            >
              Append Row
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border p-5 md:col-span-2">
          <h2 className="text-base font-medium">Update Range</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <Input
              value={updateRange}
              onChange={(event) => setUpdateRange(event.target.value)}
              placeholder="Sheet1!B2:C2"
            />
            <Textarea
              value={updateValuesJson}
              onChange={(event) => setUpdateValuesJson(event.target.value)}
              rows={4}
            />
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !spreadsheetId || !updateRange}
            >
              Update Range
            </Button>
          </div>
        </section>
      </div>

      {(localError || createSpreadsheetMutation.error || readMutation.error || appendMutation.error || updateMutation.error || createTabMutation.error) && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {localError ??
            createSpreadsheetMutation.error?.message ??
            readMutation.error?.message ??
            appendMutation.error?.message ??
            updateMutation.error?.message ??
            createTabMutation.error?.message}
        </div>
      )}

      <section className="rounded-2xl border p-5">
        <h2 className="text-base font-medium">Latest Result</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/50 p-4 text-xs">
          {JSON.stringify(latestResult ?? statusQuery.data ?? { message: 'No result yet' }, null, 2)}
        </pre>
      </section>
      </div>
    </div>
  );
}
