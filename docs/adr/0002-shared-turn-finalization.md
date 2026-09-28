# Shared Turn Finalization With Channel Persistence Adapters

All conversation channels — authenticated web chat, shared web agent links, and LINE OA (including LINE direct-intent shortcut replies such as weather, farm records, case drafts, and media generation) — finalize turns through the single shared finalizer in `features/chat/server/finalization.ts`. The finalizer owns persistence, billing, token metering, working memory, memory extraction, and audit ordering.

Channels differ only at two sanctioned points:

1. **Persistence** is a real seam. Each channel supplies a Channel Persistence Adapter: web/shared-link use full-thread rewrite (`persistChatResult`); LINE uses append-only writes at explicit positions. A partial implementation must never silently disable other finalization steps.
2. **Follow-up suggestion generation** is Channel Adapter policy (LINE generates before the reply is sent for quick replies; web generates during the stream). Adapters pass results into finalization for persistence only.

LINE turns bill the **channel owner** (`billingUserId`) with the same credit contract as web: model cost for AI text turns, image-model cost for media turns, an explicit 0 for non-model lookups. Channel-local persistence helpers that bypass the finalizer (e.g., the former `persistLineTurn`) are not permitted; they hide turns from billing, metering, and audit.
