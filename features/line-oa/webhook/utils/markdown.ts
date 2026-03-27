/**
 * Strip common markdown syntax so LINE text messages look clean.
 * LINE doesn't render any markdown — asterisks/hashes appear as literal chars.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{3}([\s\S]+?)\*{3}/g, '$1')
    .replace(/_{3}([\s\S]+?)_{3}/g, '$1')
    .replace(/\*{2}([\s\S]+?)\*{2}/g, '$1')
    .replace(/_{2}([\s\S]+?)_{2}/g, '$1')
    .replace(/(?<!\w)\*([\s\S]+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_([\s\S]+?)_(?!\w)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, (match) =>
      match.replace(/```[^\n]*\n?/g, '').replace(/\n?```/g, ''),
    )
    .replace(/^>\s*/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '──────────')
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
