import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildPdfFilename } from "@/lib/export/filename";
import type { PrintableQuizData, PrintableQuizMode, PrintableQuizTeacherOptions } from "@/lib/quiz-print";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_GAP = 18;
const SECTION_GAP = 14;
const QUESTION_GAP = 12;
const LINE_GAP = 4;

type PdfRenderContext = {
  boldFont: PDFFont;
  doc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;
};

function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number): string[] {
  const normalized = text.replace(/\r/g, "");
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);

      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        currentLine = word;
        continue;
      }

      let segment = "";
      for (const character of word) {
        const segmentCandidate = `${segment}${character}`;
        if (font.widthOfTextAtSize(segmentCandidate, fontSize) <= maxWidth) {
          segment = segmentCandidate;
        } else {
          if (segment) {
            lines.push(segment);
          }
          segment = character;
        }
      }
      currentLine = segment;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function createPage(doc: PDFDocument): PDFPage {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({
    x: MARGIN,
    y: MARGIN,
    width: CONTENT_WIDTH,
    height: PAGE_HEIGHT - MARGIN * 2,
    borderColor: rgb(0.87, 0.87, 0.9),
    borderWidth: 0.75,
  });
  return page;
}

function ensureSpace(context: PdfRenderContext, requiredHeight: number): PdfRenderContext {
  if (context.y - requiredHeight >= MARGIN) {
    return context;
  }

  return {
    ...context,
    page: createPage(context.doc),
    y: PAGE_HEIGHT - MARGIN,
  };
}

function drawTextBlock(
  context: PdfRenderContext,
  text: string,
  options: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    fontSize?: number;
    gapAfter?: number;
    indent?: number;
  } = {},
): PdfRenderContext {
  const font = options.font ?? context.font;
  const fontSize = options.fontSize ?? 11;
  const indent = options.indent ?? 0;
  const color = options.color ?? rgb(0.12, 0.12, 0.14);
  const lineHeight = fontSize + LINE_GAP;
  const lines = wrapText(font, text, fontSize, CONTENT_WIDTH - indent);
  let nextContext = ensureSpace(context, Math.max(lineHeight, lines.length * lineHeight));

  if (lines.length === 0) {
    return {
      ...nextContext,
      y: nextContext.y - lineHeight - (options.gapAfter ?? 0),
    };
  }

  for (const line of lines) {
    nextContext = ensureSpace(nextContext, lineHeight);
    nextContext.page.drawText(line, {
      x: MARGIN + indent,
      y: nextContext.y - fontSize,
      size: fontSize,
      font,
      color,
    });
    nextContext = {
      ...nextContext,
      y: nextContext.y - lineHeight,
    };
  }

  return {
    ...nextContext,
    y: nextContext.y - (options.gapAfter ?? 0),
  };
}

function drawRule(context: PdfRenderContext, gapAfter: number): PdfRenderContext {
  let nextContext = ensureSpace(context, 12);
  nextContext.page.drawLine({
    start: { x: MARGIN, y: nextContext.y - 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: nextContext.y - 2 },
    thickness: 0.75,
    color: rgb(0.82, 0.82, 0.86),
  });
  return {
    ...nextContext,
    y: nextContext.y - gapAfter,
  };
}

function drawMarkBox(context: PdfRenderContext, label: string): PdfRenderContext {
  let nextContext = ensureSpace(context, 20);
  const boxWidth = 86;
  const boxHeight = 18;
  const x = PAGE_WIDTH - MARGIN - boxWidth;
  const y = nextContext.y - boxHeight;

  nextContext.page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    borderWidth: 0.8,
    borderColor: rgb(0.2, 0.2, 0.24),
  });
  nextContext.page.drawText(label, {
    x: x + 8,
    y: y + 5,
    size: 9,
    font: nextContext.font,
    color: rgb(0.18, 0.18, 0.22),
  });

  return nextContext;
}

export async function generateQuizPdf(
  quiz: PrintableQuizData,
  mode: PrintableQuizMode,
  options: PrintableQuizTeacherOptions,
): Promise<{ buffer: Buffer; filename: string }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let context: PdfRenderContext = {
    boldFont,
    doc,
    font,
    page: createPage(doc),
    y: PAGE_HEIGHT - MARGIN,
  };

  const baseFontSize = options.compact ? 10 : 11;
  const titleSize = options.compact ? 18 : 20;
  const headingSize = options.compact ? 13 : 14;

  const drawSectionHeader = (title: string, description?: string) => {
    context = drawTextBlock(context, title, {
      font: boldFont,
      fontSize: headingSize,
      gapAfter: 4,
    });

    if (description) {
      context = drawTextBlock(context, description, {
        color: rgb(0.35, 0.35, 0.4),
        fontSize: baseFontSize,
        gapAfter: SECTION_GAP,
      });
    } else {
      context = {
        ...context,
        y: context.y - SECTION_GAP,
      };
    }
  };

  context = drawTextBlock(context, quiz.title, {
    font: boldFont,
    fontSize: titleSize,
    gapAfter: 6,
  });

  context = drawTextBlock(context, `Questions: ${quiz.questions.length}`, {
    color: rgb(0.35, 0.35, 0.4),
    fontSize: baseFontSize,
    gapAfter: 10,
  });

  if (mode === "worksheet" || mode === "both") {
    drawSectionHeader("Worksheet", quiz.instructions);

    context = drawTextBlock(context, `Name: ____________________    Date: ____________________    Score: ______ / ${quiz.questions.length}`, {
      fontSize: baseFontSize,
      gapAfter: HEADER_GAP,
    });

    quiz.questions.forEach((question, index) => {
      context = ensureSpace(context, 80);
      context = drawTextBlock(context, `Question ${index + 1}`, {
        font: boldFont,
        fontSize: baseFontSize + 1,
        gapAfter: 4,
      });

      if (options.showTopics) {
        context = drawTextBlock(context, `Topic: ${question.topic} · Type: ${question.type === "mcq" ? "Multiple choice" : question.type === "short_answer" ? "Short answer" : "True / false"}`, {
          color: rgb(0.38, 0.38, 0.42),
          fontSize: baseFontSize - 1,
          gapAfter: 4,
        });
      }

      if (options.showMarkBoxes) {
        context = drawMarkBox(context, "Mark: ____ / 1");
      }

      context = drawTextBlock(context, question.question, {
        fontSize: baseFontSize,
        gapAfter: 6,
      });

      if (question.type === "mcq" && question.options?.length) {
        question.options.forEach((option, optionIndex) => {
          context = drawTextBlock(context, `${String.fromCharCode(65 + optionIndex)}. ${option}`, {
            fontSize: baseFontSize,
            indent: 12,
            gapAfter: 2,
          });
        });
        context = {
          ...context,
          y: context.y - QUESTION_GAP,
        };
      } else if (question.type === "true_false") {
        context = drawTextBlock(context, "(   ) True      (   ) False", {
          fontSize: baseFontSize,
          indent: 12,
          gapAfter: QUESTION_GAP,
        });
      } else {
        const answerLineCount = options.compact ? 3 : 5;
        for (let lineIndex = 0; lineIndex < answerLineCount; lineIndex += 1) {
          context = drawTextBlock(context, "____________________________________________________________", {
            fontSize: baseFontSize,
            indent: 12,
            gapAfter: 2,
          });
        }
        context = {
          ...context,
          y: context.y - QUESTION_GAP,
        };
      }

      context = drawRule(context, 10);
    });
  }

  if (mode === "answer-key" || mode === "both") {
    context = ensureSpace(context, 120);
    context = drawTextBlock(context, mode === "both" ? "Answer Key" : `${quiz.title} · Answer Key`, {
      font: boldFont,
      fontSize: headingSize,
      gapAfter: 8,
    });

    context = drawTextBlock(context, "Teacher-friendly version for review and marking.", {
      color: rgb(0.35, 0.35, 0.4),
      fontSize: baseFontSize,
      gapAfter: SECTION_GAP,
    });

    quiz.questions.forEach((question, index) => {
      context = ensureSpace(context, 100);
      context = drawTextBlock(context, `Answer ${index + 1}`, {
        font: boldFont,
        fontSize: baseFontSize + 1,
        gapAfter: 4,
      });

      if (options.showTopics) {
        context = drawTextBlock(context, `Topic: ${question.topic}`, {
          color: rgb(0.38, 0.38, 0.42),
          fontSize: baseFontSize - 1,
          gapAfter: 4,
        });
      }

      if (options.showMarkBoxes) {
        context = drawMarkBox(context, "Awarded: ____ / 1");
      }

      context = drawTextBlock(context, question.question, {
        fontSize: baseFontSize,
        gapAfter: 6,
      });

      context = drawTextBlock(context, `Correct answer: ${question.answer}`, {
        font: boldFont,
        fontSize: baseFontSize,
        indent: 12,
        gapAfter: 4,
      });

      if (options.showExplanations) {
        context = drawTextBlock(context, `Explanation: ${question.explanation}`, {
          fontSize: baseFontSize,
          indent: 12,
          gapAfter: 4,
        });
      }

      if (options.showReferences && question.references?.length) {
        const references = question.references
          .map((referenceId) => quiz.groundingReferences.find((reference) => reference.id === referenceId))
          .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
          .map((reference) => {
            const parts = [reference.source];
            if (typeof reference.page === "number") {
              parts.push(`p.${reference.page}`);
            }
            if (reference.section) {
              parts.push(`section: ${reference.section}`);
            }
            return parts.join(" · ");
          });

        if (references.length > 0) {
          context = drawTextBlock(context, `References: ${references.join("; ")}`, {
            color: rgb(0.35, 0.35, 0.4),
            fontSize: baseFontSize - 1,
            indent: 12,
            gapAfter: 4,
          });
        }
      }

      context = drawRule(context, 10);
    });
  }

  const bytes = await doc.save();
  const filename = buildPdfFilename(quiz.title, mode);

  return {
    buffer: Buffer.from(bytes),
    filename,
  };
}
