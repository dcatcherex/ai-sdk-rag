# Batch 3 — Remove media & web builders (video, music, speech tool, website builder, deploy)

Issue #3 · Branch `compaction/03-media-web` · Risk: Low–Medium (shared KIE provider code)

## Why
Not part of the shop-owner job. **Image generation stays** and shares the KIE provider
layer — be careful to remove only the video/audio/speech/web parts.

## Delete

```
features/video/
features/audio/                       (Suno music)
features/speech/                      (ElevenLabs speech tool)
features/website-builder/
features/deploy/
features/external-tools/web-publisher/
app/api/video/
app/api/audio/
app/api/speech/
app/api/website-builder/
app/api/deploy/
lib/website-service.ts
lib/models/kie-audio.ts
lib/providers/media/kie-audio-adapter.ts
lib/providers/media/kie-speech-adapter.ts
docs/kie-media-generation-implementation.md   (only if it is video/audio-specific — if it also documents image, edit instead)
```

## Edit

### Tool registry
- `client.ts`, `server.ts`, `page-loaders.ts` — remove `video`, `audio`, `speech`,
  `website-builder`, `deploy` manifests/agent tools/page loaders (5 each).

### external-tools (keep module, trim it)
- `features/external-tools/registry.ts` — remove the `WEB_PUBLISHER_URL` / `web-publisher`
  provider block (~lines 47–60).
- `features/external-tools/index.ts` — remove the `web-publisher` re-exports (~lines 48–56).
- `features/external-tools/__tests__/web-bridge.test.ts` — delete.
- Keep everything the `image` feature uses: `features/external-tools/media/metadata`
  (`KIE_MEDIA_PROVIDER_METADATA`), callbacks, polling, run-lifecycle.
- If `KIE_MEDIA_PROVIDER_METADATA` lists video/audio/speech capabilities, remove those entries.

### KIE provider (keep image paths only)
- `lib/providers/kieService.ts` — delete Veo (video), Suno (audio), ElevenLabs TTS methods
  (~lines 82–362 region; keep image create/poll methods and shared `createTask`).
- `app/api/generate/_shared/kieStatus.ts` — narrow `GenerationType` to the kinds still used
  (at least `'image'`, keep `'text'` if referenced), delete `audio` / `video` / `speech`
  branches and `AudioMeta`.
- `features/image/ui/provider-icon.tsx` — remove icons for Suno/ElevenLabs/Veo if present.

### AI config admin page — `features/ai-config/components/ai-config-page.tsx`
- Remove `VIDEO_MODEL_CONFIGS` import (line 24), `KIE_AUDIO_MODELS` import (line 25),
  the `videoModel` / `audioModel` slot rows (~lines 77–78), and the `speech` model filter (~124)
  if it only feeds the removed speech slot. Leave the stored slot data alone (no DB edits).

### LINE — video on request
- `features/line-oa/webhook/events/media-handlers.ts` — delete `wantsVideoGeneration`
  (~line 199) and `generateAndDeliverVideo` (~line 355).
- `features/line-oa/webhook/events/text-replies.ts` — remove the import (line 44) and the
  `if (wantsVideoGeneration(input.userText)) { ... }` branch. The `wantsImageGeneration`
  branch right after it stays.

### Stragglers
- `app/landing/page.tsx` — remove feature cards/links for website builder, video, music.
- `features/workspace/catalog.ts` — tool nav entries are generated from manifests; confirm
  nothing hard-codes these slugs.
- `CLAUDE.md` — remove mentions.

## Keep (explicitly)
- `app/api/tts/route.ts` + `features/chat/components/message-list/read-aloud-button.tsx` —
  chat "read aloud" is separate from the speech tool; keep it.
- `app/api/transcribe/` — LINE voice messages need it.
- `features/image/`, `features/gallery/`, stock images.

## Verify
- `grep -rniE "features/(video|audio|speech|website-builder|deploy)|web-publisher|website-service|kie-audio|kie-speech|suno|veo" app features lib components` → no hits.
- Web chat: generate an image end to end (KIE callback/polling still works).
