# Thread Scroll Restoration Issue

## Overview

This document explains the bug where switching between chat threads caused the message pane to either:

- animate to the bottom as if the thread had just reloaded
- reset to the top instead of restoring the previous reading position

It also documents the production-safe pattern for fixing similar scroll-state issues in the future.

## User-Visible Symptoms

- Selecting a thread can trigger a visible scroll animation to the latest message
- After suppressing that animation, the thread may reopen at the top
- Returning to a previously viewed thread does not restore the last scroll position
- Long conversations feel like they re-render from scratch on each thread switch

## Root Cause

This issue was caused by a combination of scroll-state conflicts.

### 1. Sticky Bottom State Leaked Across Threads

The chat message pane uses `use-stick-to-bottom` through `Conversation` in:

- `components/ai-elements/conversation.tsx`
- `features/chat/components/chat-message-list.tsx`

That helper is appropriate for streaming chat output, but it keeps internal state such as:

- whether the view is currently considered at bottom
- whether the user escaped bottom-lock
- active animation state
- computed target scroll position

When thread selection changes without carefully resetting or overriding that state, the next thread can inherit behavior intended for the previous thread.

Result:

- a thread switch can look like a live streaming update
- the pane may animate toward the bottom even though the user only switched conversations

### 2. Restoring Scroll Too Early

Even after stopping the bottom animation, restoring `scrollTop` from the parent component was not reliable enough.

The failure mode was:

1. the selected thread changes
2. the new message pane mounts or updates
3. the scroll element is recreated or not fully ready yet
4. restoration runs before the final content height settles
5. the browser or scroll helper leaves the pane at the top

Result:

- saved scroll state exists
- but the visual pane still lands at the wrong position

### 3. Early Scroll Events Overwrote the Saved Position

A more subtle race also existed:

1. switch to a thread
2. the new pane emits an early scroll event while still at `0`
3. that event gets saved as the thread's current position
4. the real historical scroll position is lost

Result:

- subsequent revisits always restore to top because top became the stored value

## Final Implementation Strategy

The production-safe fix has three parts.

### A. Separate Thread Switching from Streaming Behavior

A thread switch should not be treated as a normal chat growth event.

On thread change:

- stop sticky-bottom behavior for the current pane
- avoid smooth bottom animation during restoration
- treat the thread switch as a viewport restore event

### B. Store Scroll Position Per Thread

Maintain a per-thread map of scroll positions in the message list layer.

Pattern:

- key by `threadId`
- save position when the user scrolls
- save again on cleanup when leaving the thread
- do not use one global scroll position for all threads

Conceptually:

- `visited thread` -> restore prior position
- `unvisited thread with messages` -> open near latest messages
- `new chat with no messages` -> open at top

### C. Restore Only After the Live Scroll Element Exists

The actual restore should happen inside the conversation context where the real scroll container is available.

Why this matters:

- the scroll element lives inside `StickToBottom.Content`
- parent timing can be too early
- restoring from the live context is more deterministic

The reliable sequence is:

1. detect thread change
2. mark restoration as pending
3. temporarily block scroll-position writes
4. wait until the live scroll element is mounted and content is present
5. restore saved `scrollTop`, or default to bottom for unvisited threads
6. unblock scroll-position writes
7. persist the restored position as the new baseline

## Files Involved

### Shared Scroll Primitive

- `components/ai-elements/conversation.tsx`
  - wraps `use-stick-to-bottom`
  - responsible for scroll container behavior and bottom-lock affordances

### Chat UI

- `features/chat/components/chat-message-list.tsx`
  - owns thread-specific scroll persistence and restoration
  - renders the conversation body
  - is the correct place to manage per-thread viewport behavior

### Thread Selection Source

- `features/chat/components/chat-sidebar.tsx`
- `features/chat/components/sidebar/sidebar-thread-list.tsx`
- `features/chat/hooks/use-threads.ts`

These files change the active thread, but they are not the right place to restore message-pane scroll state.

## Current UI Behavior

Expected behavior now should be:

1. Opening a thread for the first time lands at the latest messages without a forced smooth jump
2. Switching back to a previously viewed thread restores the prior reading position
3. Scrolling up in a thread does not get overridden by background sticky-bottom logic
4. Streaming continues to behave like a normal chat pane once the thread is active

## Debugging Checklist

If this issue appears again, check these items in order.

### 1. Confirm the Wrong Pane Is Actually Moving

There are two separate scrollable areas that can create confusion:

- the left sidebar thread list
- the main chat message pane

Questions:

- Is the jump happening in the sidebar because of `scrollIntoView(...)`?
- Or is the main message pane moving because of sticky-bottom logic?

Do not fix the sidebar if the real issue is the conversation pane.

### 2. Confirm Whether the Scroll State Is Shared Across Threads

Inspect:

- `features/chat/components/chat-message-list.tsx`
- `components/ai-elements/conversation.tsx`

Questions:

- Is the scroll state keyed by thread?
- Is a thread switch reusing sticky-bottom state from the previous thread?
- Is a remount wiping out the scroll container state unexpectedly?

### 3. Confirm Save Timing

Questions:

- Are you saving scroll position only after the thread is stable?
- Are you accidentally saving `0` immediately on mount?
- Are early scroll events overwriting the stored position before restore completes?

A common mistake is saving too eagerly.

### 4. Confirm Restore Timing

Questions:

- Does restore happen after the actual scroll element exists?
- Does it wait until messages are present for a populated thread?
- Is restore happening in a child that can access the live `scrollRef`?

A correct saved position is still useless if restore runs too early.

### 5. Confirm Sticky-Bottom Behavior Does Not Fight Restore

Questions:

- Does the scroll helper still think it should follow the bottom?
- Is there an in-flight animation still active from the previous thread?
- Should `stopScroll()` or equivalent be called on thread change?

If restore and bottom-lock both run, the final scroll position can be unstable.

## Recommended Pattern for Similar Issues

For threaded chat, inbox, or timeline interfaces:

- Keep viewport state scoped to the entity being viewed
- Restore from the live scroll container, not from an assumed parent ref
- Disable or pause auto-follow behavior during entity switches
- Block persistence during restoration to avoid saving transitional positions
- After restoration completes, resume normal scroll tracking
- Default unvisited threads to the most recent content, not top

## Anti-Patterns to Avoid

- Saving scroll position immediately on mount before content is ready
- Using one shared scroll value for all threads
- Letting sticky-bottom state survive a thread switch unchanged
- Restoring from a container that is not the actual scroll element
- Using smooth animation for thread restoration unless explicitly desired

## If This Happens Again

Start with this sequence:

1. Reproduce with two long threads
2. Scroll thread A to the middle
3. Switch to thread B
4. Switch back to thread A
5. Inspect whether the stored position changed unexpectedly to `0`
6. Inspect whether restore fired before the scroll element or message content was ready
7. Inspect whether the scroll helper re-applied bottom-follow behavior after restore

## Summary

The core lesson is:

- thread switching and live streaming are different scroll behaviors
- sticky-bottom helpers are useful for chat streaming but can interfere with thread restoration
- per-thread viewport state must be saved carefully and restored only when the live scroll element is ready
- the safest production approach is to guard restoration and persistence so temporary switch-time scroll events cannot overwrite the real saved position
