# Batch 9 — Remove real-time voice conversation (keep dictation + transcription)

Issue #9 · Branch `compaction/09-realtime-voice` · Risk: Medium
⚠️ **Gate: the owner must confirm on issue #9 before starting.** This was the most
recent work (commits b4d5bb8, f45e0e9). If the owner says "keep", close the issue and
skip this batch.

## Why
Two real-time providers (OpenAI Realtime + Gemini Live), a separate tool-call bridge,
and a separate public-link voice path — the heaviest-maintenance, fastest-changing code
in the app, for a feature no shop owner has asked for.

## Scope — what goes vs. stays

| Goes (voice *conversation*) | Stays (speech *input*) |
|---|---|
| `use-live-voice` (Gemini Live + OpenAI Realtime duplex) | `use-live-transcription` (dictation into the composer) |
| `/api/live-token`, `/api/realtime/session`, `/api/realtime/tool-call` | `/api/realtime/transcription-session` |
| `/api/voice-turn`, `/api/agent/[token]/voice-turn` | `/api/transcribe` (LINE voice messages + shared-link mic) |
| `/api/agent/[token]/realtime/*` | `/api/tts` + read-aloud button |
| `VoiceMode` UI | |

## Delete

```
features/chat/hooks/use-live-voice.ts
features/chat/components/voice-mode.tsx
features/chat/server/realtime-voice.ts            (after moving anything still needed — see below)
app/api/live-token/
app/api/realtime/session/
app/api/realtime/tool-call/
app/api/voice-turn/
app/api/agent/[token]/realtime/                   (session, tool-call)
app/api/agent/[token]/voice-turn/
documents/google/live_api/
documents/google/live api with web socket.md
```

## Edit

### Shared-link helpers live in the wrong file — move them first
`features/agents/server/public-realtime-voice.ts` exports helpers the **non-voice**
shared-link thread route uses:
- `resolvePublicAgentShare`, `ensurePublicAgentThread`, `assertPublicAgentThread`
  → move to a new `features/agents/server/public-agent-share.ts` (same code, no changes).
- Update `app/api/agent/[token]/thread/route.ts` (and any other importer) to the new path.
- Then delete `public-realtime-voice.ts` (the remaining exports are voice-only:
  `publicRealtime*Schema`, `preparePublicRealtimeVoiceRun`, `executePublicRealtimeToolCall`).

Likewise in `features/chat/server/realtime-voice.ts`: if `/api/realtime/transcription-session`
or anything else still imports from it (e.g. `assertOwnedThread`), move that function to an
appropriate existing module before deleting the file.

### Web chat — `features/chat/components/composer/chat-composer.tsx`
- Remove the `useLiveVoice` import (line 9), `VoiceHistoryTurn` / `VoiceState` usage, the
  voice-mode state, `handleVoiceTurnComplete` (posts to `/api/voice-turn`, ~line 332),
  `getRealtimeVoiceContext` (~355), and the `<VoiceMode>` render.
- `composer-action-buttons.tsx` — remove the "start voice conversation" button; keep the
  dictation (`useLiveTranscription`) mic button.
- `features/chat/types.ts` — remove `VoiceTurnMetadata` if now unused.

### Shared link — `app/agent/[token]/chat/page.tsx`
- Remove `useLiveVoice` import (line 40) and the voice-conversation UI/state.
- Keep the mic → `/api/transcribe` flow (~line 170).

### Other
- `app/page.tsx` / `app/landing/page.tsx` — remove "real-time voice" marketing if present.
- `features/chat/server/finalization.test.ts` — remove voice-turn cases.
- Env: remove `GEMINI_LIVE_*` / live-token-only env vars from `.env.example` if they exist
  solely for live voice. Keep `OPENAI_API_KEY` (used elsewhere).
- `CLAUDE.md` — remove `use-live-voice.ts` from the tree and "Gemini Live API docs" line.

## Verify
- `grep -rnE "use-live-voice|useLiveVoice|VoiceMode|live-token|/api/voice-turn|realtime/session|realtime/tool-call|public-realtime-voice" app features lib components` → no hits.
- Web chat: dictation mic still fills the composer.
- Shared link: page loads, previous thread restores (`/thread` route), mic transcription works.
