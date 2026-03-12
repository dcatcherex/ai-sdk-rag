"use client";

import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { memo } from "react";
import { MarkdownText } from "./markdown-text";
import { FilePartRenderer } from "./parts/file-part";
import { CertificateToolPart, CertificatePreviewToolPart } from "./parts/certificate-tool-part";
import { ExamPrepToolPart } from "./parts/exam-prep-tool-part";
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

export const MessagePartRenderer = memo(
  ({ part, messageId, threadId, index, role, onImageClick, onQuizStateChange }: MessagePartRendererProps) => {
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

      return (
        <Tool key={key}>
          <ToolHeader type="dynamic-tool" state={part.state as never} toolName={toolName} />
          <ToolContent>
            <ToolInput input={part.input} />
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
  },
);

MessagePartRenderer.displayName = "MessagePartRenderer";
