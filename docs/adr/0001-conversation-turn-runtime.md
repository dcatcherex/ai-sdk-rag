# Conversation Turn Runtime With Channel Adapters

Vaja has three agent conversation channels: authenticated web chat, shared web agent links, and LINE OA. We will keep the core conversation turn semantics in one Conversation Turn Runtime and put channel-specific access checks, limits, transport, rendering, and analytics in Channel Adapters, because the agent, skill, task-flow, tool, model, billing, and persistence ordering should stay consistent across channels.
