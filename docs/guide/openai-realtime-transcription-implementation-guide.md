# OpenAI Realtime Transcription Implementation Guide

Status: implementation guide for AI coders and developers

Last updated: May 11, 2026

## Implementation Progress

Current code status as of May 11, 2026:

- Done: dedicated realtime transcription route at `app/api/realtime/transcription-session/route.ts`
- Done: dedicated browser hook at `features/chat/hooks/use-live-transcription.ts`
- Done: composer mic button now starts live dictation instead of the older record-then-upload path
- Done: dictation and voice conversation remain split into separate controls
- Done: server route keeps `OPENAI_API_KEY` server-side and sends hashed `OpenAI-Safety-Identifier`
- Done: session request supports `language` and `latencyMode`
- Done: transcript handling reconciles `delta` and `completed` events by `item_id`
- Done: dictation stops on close/unmount and when voice conversation or normal send takes over
- Done: server helper + tests added in `features/chat/server/realtime-transcription.ts` and `features/chat/server/realtime-transcription.test.ts`

Still open / not yet implemented:

- UI for user-selectable dictation language preference
- UI for user-selectable latency mode
- formal browser/e2e coverage for realtime dictation behavior
- production eval pass across Thai accents, code-switching, numbers, and noisy audio

This guide describes how Vaja should implement live dictation/transcription with OpenAI Realtime transcription. This is separate from the `gpt-realtime-2` voice-agent path.

Use this guide when building or modifying the composer mic/dictation flow where the user speaks and Vaja turns speech into editable text before sending.

## 1. Goal

Live transcription should make Vaja easier to use for Thai users who prefer speaking over typing.

The goal is:

- user presses the mic/dictation button
- user speaks naturally
- transcript appears live in the composer
- user can review and edit the text
- user submits the text through the normal chat path

This is not a voice-agent conversation. The model should not speak back, call tools, activate skills directly, or persist messages by itself.

## 2. UX Split

Vaja should expose two different audio modes:

| UI control | User meaning | Model/API | Output |
| --- | --- | --- | --- |
| Mic / dictation button | "Type what I say" | OpenAI realtime transcription session | Editable composer text |
| Voice wave / realtime chat button | "Talk with Vaja" | `gpt-realtime-2` voice-agent session | Spoken assistant response with agent skills/tools |

This split is important. Users should not have to guess whether a button will only transcribe or start a live conversation.

Recommended labels:

- Dictation tooltip: `Dictate message`
- Voice conversation tooltip: `Talk with Vaja`

## 3. When To Use Each Audio Path

Use realtime transcription when:

- the user wants to dictate a message into the composer
- the user should be able to review/edit before sending
- the app needs streaming text but no spoken assistant response
- the interaction is short or medium-length live speech

Use realtime voice-agent when:

- the user wants a spoken back-and-forth conversation
- Vaja should respond with audio
- Vaja should use selected agent skills and tools during the voice session
- low-latency speech-to-speech is the product experience

Use request-based speech-to-text when:

- the input is a file upload
- the input is a LINE voice note
- the request is bounded and does not need live transcript deltas
- diarization, timestamps, or offline batch behavior matters more than live UI

## 4. Model Choice

Default live transcription model:

```txt
gpt-4o-mini-transcribe
```

Recommended env var:

```txt
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

Implementation note:

- the current Vaja code defaults to `gpt-4o-mini-transcribe`
- this is configurable via `OPENAI_REALTIME_TRANSCRIPTION_MODEL`
- keep request-based models for file uploads and bounded audio workflows

## 5. Session Type

Realtime transcription uses:

```json
{
  "type": "transcription"
}
```

This is not the same as a voice-agent conversation session.

Important differences:

- no assistant spoken response
- no normal assistant turn lifecycle
- no `response.create`
- no tools
- no agent prompt
- no skill injection
- transcript events stream as audio arrives

## 6. Connection Method

Use WebRTC for browser composer dictation.

Why:

- browser captures microphone audio directly
- OpenAI can stream transcript deltas with low latency
- no server media pipeline is needed
- API keys stay server-side during session creation

Use WebSocket only when the server already receives raw audio from another source, such as telephony, worker processes, or media ingest.

## 7. File Map

### Client

Implemented hook:

```txt
features/chat/hooks/use-live-transcription.ts
```

Responsibilities:

- create browser WebRTC connection
- request microphone permission
- send audio to OpenAI transcription session
- receive transcript deltas and completion events
- update composer text live
- reconcile final transcripts by `item_id`
- stop microphone and close peer connection on completion

Composer integration:

```txt
features/chat/components/composer/composer-action-buttons.tsx
```

Current behavior:

- the dictation hook updates composer text state
- it does not auto-submit
- it stops cleanly when voice conversation opens or message send begins
- manual edits during dictation lock prior text and future finalized turns append only

### Server

Implemented route:

```txt
app/api/realtime/transcription-session/route.ts
```

Responsibilities:

- require authenticated user
- create a transcription session with OpenAI
- send privacy-preserving `OpenAI-Safety-Identifier`
- return SDP answer to browser
- never expose `OPENAI_API_KEY`

Do not reuse `/api/realtime/session` if that route remains voice-agent specific. Keeping the routes separate prevents session-type confusion.

## 8. Session Creation Contract

Client request:

```txt
POST /api/realtime/transcription-session
```

Body:

```ts
{
  sdp: string;
  language?: "th" | "en" | string;
  latencyMode?: "fast" | "balanced" | "accurate";
}
```

Response:

```txt
Content-Type: application/sdp
```

The response body is the SDP answer from OpenAI.

## 9. Suggested Session Config

Start with a balanced configuration for Thai/English composer dictation:

```json
{
  "type": "transcription",
  "audio": {
    "input": {
      "transcription": {
        "model": "gpt-realtime-whisper"
      },
      "turn_detection": {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 500
      }
    }
  }
}
```

Current implementation note:

- the code currently builds the same session shape but uses `gpt-4o-mini-transcribe` by default
- latency presets map to different `server_vad` values:
  - `fast`: lower silence threshold for quicker turn commits
  - `balanced`: `threshold: 0.5`, `prefix_padding_ms: 300`, `silence_duration_ms: 500`
  - `accurate`: longer silence duration for steadier finalization

Language hint:

- pass `language: "th"` when the UI knows the user is dictating Thai
- pass `language: "en"` when the UI knows the user is dictating English
- omit the hint when language is unknown or users commonly code-switch

Do not overfit the default before testing real Thai audio.

## 10. Transcript Events

Handle incremental deltas:

```txt
conversation.item.input_audio_transcription.delta
```

Handle final transcript:

```txt
conversation.item.input_audio_transcription.completed
```

Use `item_id` to match partial and final transcripts. Ordering between completion events from different turns is not guaranteed.

Client state should track:

```ts
type LiveTranscriptItem = {
  itemId: string;
  partialText: string;
  finalText?: string;
};
```

Recommended behavior:

- display partial deltas live in the composer
- replace partial text with final transcript when completion arrives
- append new turns with spacing that feels natural
- never duplicate final text after partial text
- allow the user to edit the composer text at any time

## 11. Composer Integration

Dictation should behave like smart typing.

Rules:

- Do not submit automatically.
- Do not call `/api/chat`.
- Do not persist a chat message until the user submits.
- Do not activate skills/tools directly.
- Do not overwrite text the user manually edited unless the dictation session owns that text span.
- Preserve skill badges and rich input behavior where possible.

Recommended first implementation:

- While dictating, append transcript text to the plain text input.
- If the user edits during dictation, stop auto-replacement and only append future finalized turns.
- Keep this simple before trying complex span-level reconciliation.

## 12. Skills And Tools

Live transcription does not use agent skills or tools directly.

Reason:

- transcription produces user text
- user text is submitted through normal chat
- normal chat then activates agent, skills, tools, memory, brand context, and routing

This keeps architecture clean:

```txt
speech -> editable text -> normal chat submit -> canonical agent runtime
```

Do not inject agent prompts or skill instructions into transcription sessions.

## 13. Latency And Accuracy Tuning

Pick target behavior before tuning.

Suggested latency modes:

| Mode | Target | Use when |
| --- | --- | --- |
| `fast` | around 0.4s | user wants very fast visual feedback |
| `balanced` | around 0.8-1.2s | default composer dictation |
| `accurate` | around 1.5-2.0s | noisy audio or domain vocabulary matters more |

Do not choose a default from clean synthetic audio. Test with:

- phone microphones
- laptop microphones
- Thai speakers
- English speakers
- Thai/English code-switching
- background noise
- agricultural terms
- product names
- numbers, prices, dates, phone numbers, and email addresses

## 14. Thai-Specific Considerations

Vaja's audience includes Thai users, SMEs, farmers, teachers, and creators. Transcription should be evaluated with real Thai phrasing, not only formal Thai.

Test:

- informal Thai
- regional accents
- Thai mixed with English brand/product names
- spoken prices and quantities
- farm terms such as fertilizer, pests, crop names, weather terms
- LINE-style short commands
- long natural sentences without punctuation

Composer behavior should not assume spaces or punctuation will be perfect. The normal chat model can clean up the text after submit if needed.

## 15. Failure Modes

### Duplicate text

Cause:

- partial transcript is appended, then final transcript is appended again

Fix:

- track `item_id`
- replace partial text with final text

### Text jumps while user edits

Cause:

- dictation continues to mutate the full input while the user manually edits

Fix:

- stop replacing previous text after manual edit
- append future finalized turns only

### Wrong language

Cause:

- overly strong language hint
- code-switching

Fix:

- omit language hint for mixed-language users
- provide a user setting for preferred dictation language later

### Bad numbers or emails

Cause:

- voice transcription ambiguity

Fix:

- do not auto-submit
- let user review/edit before sending
- add UI helper text for high-precision values: "Review numbers and names before sending."

### Mic stays on

Cause:

- peer connection or media tracks not closed

Fix:

- always stop all media tracks on close/unmount
- close data channel and peer connection
- reset UI state

## 16. Production Checklist

Before shipping live transcription:

- `OPENAI_API_KEY` is configured server-side.
- Browser never receives the API key.
- Transcription route sends hashed `OpenAI-Safety-Identifier`.
- Dictation and voice-agent buttons have distinct labels/tooltips.
- Closing dictation stops microphone tracks.
- Partial and final transcript events do not duplicate text.
- User can edit before submit.
- Thai and English test cases pass.
- No tools or skills are invoked during transcription.
- Normal chat submit still uses canonical agent runtime.

Current status on this checklist as of May 11, 2026:

- complete: server-side API key handling
- complete: separate dictation and voice-agent controls
- complete: microphone cleanup on stop/unmount
- complete: no skill/tool invocation inside transcription session
- complete: no auto-submit or direct `/api/chat` call from dictation
- pending: broader Thai/English real-audio validation
- pending: user-facing settings for language and latency

## 17. Eval Checklist

Minimum eval set:

- Thai casual message
- Thai formal message
- English message
- Thai/English mixed message
- noisy Thai audio
- spoken price
- phone number
- email address
- farm/crop vocabulary
- product or brand name
- long sentence with no punctuation
- user pauses mid-sentence
- user corrects themselves mid-sentence

Track:

- time to first partial transcript
- final transcript accuracy
- duplicate text rate
- language correctness
- numeric/entity accuracy
- user edit experience
- microphone cleanup reliability

## 18. Future Work

Recommended next steps:

- Run a real-device eval pass for Thai, English, and Thai/English mixed speech.
- Add language preference for dictation.
- Add latency mode setting.
- Add e2e coverage for start, stop, submit, and manual-edit behavior during dictation.
- Add transcript confidence/logprob support if the selected endpoint supports it.
- Add a small eval harness with real Thai audio samples.
- Keep LINE voice notes on request-based transcription unless live streaming LINE audio becomes a product requirement.
