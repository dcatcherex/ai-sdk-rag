"use client";

import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
} from "@/components/ai-elements/tool";
import { DownloadIcon } from "lucide-react";
import type {
  CertificateToolOutput,
  CertificatePreviewOutput,
  ToolLikePart,
} from "../types";

// ─── Generate / batch output ─────────────────────────────────────────────────

type CertificateToolPartProps = {
  toolPart: ToolLikePart;
  toolName: string;
  output: CertificateToolOutput;
  partKey: string;
};

export function CertificateToolPart({ toolPart, toolName, output, partKey }: CertificateToolPartProps) {
  const fileUrl = output.fileUrl ?? output.url;
  const fileName = output.fileName ?? "certificate-output";

  return (
    <Tool key={partKey}>
      <ToolHeader type="dynamic-tool" state={toolPart.state as never} toolName={toolName} />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                Job {output.jobId ?? "unknown"}
                {output.outputMode ? ` · ${output.outputMode}` : ""}
                {typeof output.count === "number"
                  ? ` · ${output.count} recipient${output.count !== 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            {fileUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Open
                </a>
                <a
                  href={fileUrl}
                  download={fileName}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <DownloadIcon className="size-3.5" />
                  {output.downloadLabel ?? "Download"}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </ToolContent>
    </Tool>
  );
}

// ─── Preview output ───────────────────────────────────────────────────────────

type CertificatePreviewToolPartProps = {
  toolPart: ToolLikePart;
  toolName: string;
  output: CertificatePreviewOutput;
  partKey: string;
};

export function CertificatePreviewToolPart({
  toolPart,
  toolName,
  output,
  partKey,
}: CertificatePreviewToolPartProps) {
  const missingRequired = output.missingRequiredByRecipient ?? [];
  const unknownFields = output.unknownFieldIdsByRecipient ?? [];

  return (
    <Tool key={partKey}>
      <ToolHeader type="dynamic-tool" state={toolPart.state as never} toolName={toolName} />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            {output.canGenerate ? "Ready to generate" : "Needs fixes before generation"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Resolved output mode: {output.outputMode ?? "single_file"}
          </p>
          {missingRequired.length > 0 && (
            <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {missingRequired.slice(0, 5).map((row) => (
                <p key={`missing-${row.recipientIndex}`}>
                  Recipient {row.recipientIndex + 1}: missing {row.missingFieldIds.join(", ")}
                </p>
              ))}
            </div>
          )}
          {unknownFields.length > 0 && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-300">
              {unknownFields.slice(0, 5).map((row) => (
                <p key={`unknown-${row.recipientIndex}`}>
                  Recipient {row.recipientIndex + 1}: unknown {row.unknownFieldIds.join(", ")}
                </p>
              ))}
            </div>
          )}
        </div>
      </ToolContent>
    </Tool>
  );
}
