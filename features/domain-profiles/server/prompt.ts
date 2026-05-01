import type { DomainEntityDto, ResolvedDomainContext } from "../types";

function formatScalarValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => formatScalarValue(item))
      .filter((item): item is string => Boolean(item));
    return values.length > 0 ? values.join(", ") : null;
  }

  if (typeof value === "object") {
    const values = Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const formatted = formatScalarValue(nestedValue);
        return formatted ? `${key} ${formatted}` : null;
      })
      .filter((item): item is string => Boolean(item));
    return values.length > 0 ? values.join(", ") : null;
  }

  return null;
}

function formatDataLines(
  data: Record<string, unknown>,
  limit: number,
): string[] {
  return Object.entries(data)
    .map(([key, value]) => {
      const formatted = formatScalarValue(value);
      return formatted ? `- ${key}: ${formatted}` : null;
    })
    .filter((line): line is string => Boolean(line))
    .slice(0, limit);
}

function formatEntityLine(entity: DomainEntityDto): string {
  const details = Object.values(entity.data)
    .map((value) => formatScalarValue(value))
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);

  return details.length > 0
    ? `- ${entity.entityType}: ${entity.name}, ${details.join(", ")}`
    : `- ${entity.entityType}: ${entity.name}`;
}

export function renderDomainContextPromptBlock(
  context: ResolvedDomainContext | null,
): string {
  if (!context) {
    return "";
  }

  const lines = [
    "<domain_context>",
    `Profile: ${context.profile.name}`,
    `Domain: ${context.profile.domain}`,
  ];

  const profileLines = formatDataLines(context.profile.data, 6);
  if (profileLines.length > 0) {
    lines.push("Known fields:");
    lines.push(...profileLines);
  }

  const entityLines = context.entities.map(formatEntityLine).slice(0, 8);
  if (entityLines.length > 0) {
    lines.push("Entities:");
    lines.push(...entityLines);
  }

  lines.push("</domain_context>");

  return `\n\n${lines.join("\n")}`;
}
