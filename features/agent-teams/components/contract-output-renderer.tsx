'use client';

import type { AgentTeamConfig } from '../types';

type ContractOutputRendererProps = {
  output: string;
  outputContract?: AgentTeamConfig['outputContract'];
  contractSections?: string[];
};

/**
 * Renders team run output according to the configured output contract.
 *
 * - 'markdown' (default): prose styled div
 * - 'json': formatted <pre> block; fallback to prose if not valid JSON
 * - 'sections': parses ## headings into cards; fallback to prose if no headings found
 */
export function ContractOutputRenderer({
  output,
  outputContract,
  contractSections,
}: ContractOutputRendererProps) {
  if (outputContract === 'json') {
    return <JsonOutput output={output} />;
  }

  if (outputContract === 'sections') {
    return <SectionsOutput output={output} contractSections={contractSections} />;
  }

  // Default: markdown / prose
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
      {output}
    </div>
  );
}

// ── JSON renderer ─────────────────────────────────────────────────────────────

function JsonOutput({ output }: { output: string }) {
  let formatted = output.trim();
  try {
    formatted = JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    // Not valid JSON — fall back to prose
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
        {output}
      </div>
    );
  }

  return (
    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre">
      {formatted}
    </pre>
  );
}

// ── Sections renderer ─────────────────────────────────────────────────────────

type Section = { title: string; body: string };

function parseSections(output: string): Section[] {
  // Split on lines starting with ## (not ###)
  const parts = output.split(/\n(?=## (?!#))/);
  const sections: Section[] = [];

  for (const part of parts) {
    const lines = part.split('\n');
    const heading = lines[0]?.trim();
    if (heading?.startsWith('## ')) {
      const title = heading.slice(3).trim();
      const body = lines.slice(1).join('\n').trim();
      sections.push({ title, body });
    } else if (sections.length === 0 && part.trim()) {
      // Content before first heading — add as preamble
      sections.push({ title: '', body: part.trim() });
    }
  }

  return sections;
}

function SectionsOutput({
  output,
  contractSections,
}: {
  output: string;
  contractSections?: string[];
}) {
  const sections = parseSections(output);

  if (sections.length === 0 || (sections.length === 1 && !sections[0]?.title)) {
    // No ## headings found — fall back to prose
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
        {output}
      </div>
    );
  }

  // Optionally sort sections by contractSections order
  const ordered = contractSections && contractSections.length > 0
    ? [
        ...contractSections.flatMap((name) => {
          const match = sections.find(
            (s) => s.title.toLowerCase() === name.toLowerCase(),
          );
          return match ? [match] : [];
        }),
        // Append any extra sections not in the contract
        ...sections.filter(
          (s) =>
            s.title &&
            !contractSections.some(
              (name) => name.toLowerCase() === s.title.toLowerCase(),
            ),
        ),
      ]
    : sections;

  return (
    <div className="space-y-3">
      {ordered.map((section, idx) => (
        <div key={idx} className="rounded-md border bg-muted/20 p-3">
          {section.title && (
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground shrink-0">
                {idx + 1}
              </span>
              <span className="text-sm font-semibold">{section.title}</span>
            </div>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {section.body}
          </div>
        </div>
      ))}
    </div>
  );
}
