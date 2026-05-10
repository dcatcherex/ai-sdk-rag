'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { SkillWithOwner } from '@/features/skills/types';
import { usePromptInputAttachments, usePromptInputController } from '@/components/ai-elements/prompt-input';

// ── DOM helpers ───────────────────────────────────────────────────────────────

/** Serialize contenteditable → plain text (badge spans → /trigger) */
export function serializeRich(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node instanceof HTMLElement) {
      const trigger = node.dataset.skillTrigger;
      if (trigger) {
        text += `/${trigger}`;
      } else if (node.tagName === 'BR') {
        text += '\n';
      } else {
        const inner = serializeRich(node);
        text += inner;
        if (node.tagName === 'DIV' && inner) text += '\n';
      }
    }
  });
  return text;
}

/** Create an inline non-editable badge DOM element for a skill */
function createSkillBadgeNode(skill: SkillWithOwner): HTMLSpanElement {
  const trigger = skill.trigger!.startsWith('/') ? skill.trigger!.slice(1) : skill.trigger!;
  const el = document.createElement('span');
  el.contentEditable = 'false';
  el.dataset.skillTrigger = trigger;
  el.dataset.skillId = skill.id;
  el.className =
    'inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-light mx-0.5 align-middle select-none';
  const labelSpan = document.createElement('span');
  labelSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px';
  labelSpan.appendChild(document.createTextNode(skill.name));
  el.title = `/${trigger}`;
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  el.appendChild(labelSpan);
  return el;
}

/** Replace the /token before cursor with an inline badge. Returns false if no slash token found. */
function insertSkillBadge(el: HTMLElement, skill: SkillWithOwner): boolean {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || !el.contains(range.startContainer)) return false;

  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) return false;

  const text = textNode.textContent ?? '';
  const cursorPos = range.startOffset;
  const before = text.slice(0, cursorPos);

  const slashIdx = before.lastIndexOf('/');
  if (slashIdx === -1 || before.slice(slashIdx).includes(' ')) return false;

  const replaceRange = document.createRange();
  replaceRange.setStart(textNode, slashIdx);
  replaceRange.setEnd(textNode, cursorPos);
  replaceRange.deleteContents();

  const badge = createSkillBadgeNode(skill);
  replaceRange.insertNode(badge);

  const after = document.createRange();
  after.setStartAfter(badge);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  return true;
}

// ── Component ─────────────────────────────────────────────────────────────────

export type RichInputHandle = { insertBadge: (skill: SkillWithOwner) => void };

/** Contenteditable div that syncs to PromptInputController and supports inline skill badges */
export const RichSkillInput = forwardRef<RichInputHandle, {
  className?: string;
  placeholder?: string;
}>(({ className, placeholder }, fwdRef) => {
  const controller = usePromptInputController();
  const attachments = usePromptInputAttachments();
  const divRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const lastSerialized = useRef('');

  // Sync externally-set controller value into the contenteditable (e.g. PreparedPromptBridge)
  useEffect(() => {
    const val = controller.textInput.value;
    if (val === lastSerialized.current) return;
    if (!divRef.current) return;
    lastSerialized.current = val;
    divRef.current.textContent = val;
    const range = document.createRange();
    range.selectNodeContents(divRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [controller.textInput.value]);

  const handleInsertBadge = useCallback((skill: SkillWithOwner) => {
    if (!divRef.current) return;
    const ok = insertSkillBadge(divRef.current, skill);
    if (!ok) return;
    const text = serializeRich(divRef.current);
    lastSerialized.current = text;
    controller.textInput.setInput(text);
    divRef.current.focus();
  }, [controller]);

  useImperativeHandle(fwdRef, () => ({ insertBadge: handleInsertBadge }), [handleInsertBadge]);

  const handleInput = useCallback(() => {
    if (!divRef.current) return;
    const text = serializeRich(divRef.current);
    lastSerialized.current = text;
    controller.textInput.setInput(text);
  }, [controller]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing.current) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      divRef.current?.closest('form')?.requestSubmit();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = Array.from(items).flatMap((item) => {
      if (item.kind !== 'file') return [];
      const f = item.getAsFile();
      return f ? [f] : [];
    });
    if (files.length > 0) {
      e.preventDefault();
      attachments.add(files);
    } else {
      e.preventDefault();
      const plain = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, plain);
    }
  }, [attachments]);

  return (
    <div
      ref={divRef}
      data-slot="input-group-control"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={className}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
      onPaste={handlePaste}
    />
  );
});
RichSkillInput.displayName = 'RichSkillInput';
