"use client";

import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { memo } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { MarkdownText } from "./markdown-text";
import { FilePartRenderer } from "./parts/file-part";
import { CertificateToolPart, CertificatePreviewToolPart } from "./parts/certificate-tool-part";
import { ExamPrepToolPart } from "./parts/exam-prep-tool-part";
import { useToolApproval } from "@/features/chat/contexts/tool-approval-context";
import {
  isFilePart,
  isToolLikePart,
  normalizeToolName,
  isCertificateToolName,
  isExamPrepToolName,
  isCertificateToolOutput,
  isCertificatePreviewOutput,
  isExamPrepToolOutput,
} from "./types";
import type { MessagePartRendererProps } from "./types";

function MessagePartRendererInner({
  part,
  messageId,
  threadId,
  index,
  role,
  onImageClick,
  onQuizStateChange,
}: MessagePartRendererProps) {
  const onToolApproval = useToolApproval();
  const key = `${messageId}-${index}`;

  if (!part || typeof part !== "object") return null;

  if (part.type === "text") {
    return <MarkdownText key={key} content={part.text} isAssistant={role === "assistant"} />;
  }

  if (isToolLikePart(part) && "state" in part) {
    const toolName = normalizeToolName(part.toolName || part.type);
    const toolOutput = part.output;

    if (isCertificateToolName(toolName) && isCertificateToolOutput(toolOutput) && toolOutput.success) {
      return (
        <CertificateToolPart
          key={key}
          partKey={key}
          toolPart={part}
          toolName={toolName}
          output={toolOutput}
        />
      );
    }

    if (isCertificateToolName(toolName) && isCertificatePreviewOutput(toolOutput) && toolOutput.success) {
      return (
        <CertificatePreviewToolPart
          key={key}
          partKey={key}
          toolPart={part}
          toolName={toolName}
          output={toolOutput}
        />
      );
    }

    if (isExamPrepToolName(toolName) && isExamPrepToolOutput(toolOutput) && toolOutput.success) {
      return (
        <ExamPrepToolPart
          key={key}
          partKey={key}
          toolPart={part}
          toolName={toolName}
          output={toolOutput}
          messageId={messageId}
          threadId={threadId}
          onQuizStateChange={onQuizStateChange}
        />
      );
    }

    const toolCallId = (part as { toolCallId?: string }).toolCallId;
    const isAwaitingApproval = part.state === "approval-requested" && !!toolCallId && !!onToolApproval;

    return (
      <Tool key={key}>
        <ToolHeader type="dynamic-tool" state={part.state as never} toolName={toolName} />
        <ToolContent>
          <ToolInput input={part.input} />
          {isAwaitingApproval && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={() => onToolApproval({ id: toolCallId!, approved: true })}
              >
                <CheckIcon className="size-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => onToolApproval({ id: toolCallId!, approved: false })}
              >
                <XIcon className="size-3.5" />
                Deny
              </Button>
            </div>
          )}
          {part.output && <ToolOutput output={part.output} errorText={part.errorText} />}
        </ToolContent>
      </Tool>
    );
  }

  if (isFilePart(part)) {
    return (
      <FilePartRenderer
        key={key}
        part={part}
        messageId={messageId}
        threadId={threadId}
        onImageClick={onImageClick}
      />
    );
  }

  const partType = part.type as string;
  if (partType === "step-start" || partType === "step-finish" || partType === "step-result") {
    return null;
  }

  console.warn("Unknown message part type:", part.type, part);
  return null;
}

// Streaming text parts can be updated in place by the chat state layer, so
// avoid memoizing this renderer by shallow prop identity.
export const MessagePartRenderer = memo(MessagePartRendererInner, () => false);

MessagePartRenderer.displayName = "MessagePartRenderer";
