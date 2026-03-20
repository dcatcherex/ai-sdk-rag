import { ModelDefinition } from "@/types/execution";

/**
 * KIE.ai audio models — Suno (music) and ElevenLabs (speech/TTS).
 * Capabilities: audio, speech
 *
 * Suno endpoint:  POST /api/v1/generate  |  status: GET /api/v1/generate/record-info
 * ElevenLabs:     POST /api/v1/jobs/createTask  |  status: GET /api/v1/jobs/recordInfo
 */
export const KIE_AUDIO_MODELS: ModelDefinition[] = [

    // --- Suno (Music) ---
    {
        id: "suno-v4",
        name: "Suno V4",
        description: "AI music generation with improved vocals. Max 4 minutes.",
        capabilities: ["audio"],
        provider: 'kie',
        costPerGeneration: 10,
        isNew: true,
        maxPromptLength: 3000,  // Custom mode: 3000 chars for V4
        maxPromptTokens: 750,
        warningThreshold: 0.8
    },
    {
        id: "suno-v4.5",
        name: "Suno V4.5",
        description: "Smart prompts, richer sound. Max 8 minutes, faster generation.",
        capabilities: ["audio"],
        provider: 'kie',
        costPerGeneration: 15,
        isNew: true,
        maxPromptLength: 5000,  // Custom mode: 5000 chars for V4.5+
        maxPromptTokens: 1250,
        warningThreshold: 0.8
    },
    {
        id: "suno-v5",
        name: "Suno V5",
        description: "Latest Suno model — superior musicality, faster generation. Max 8 minutes.",
        capabilities: ["audio"],
        provider: 'kie',
        costPerGeneration: 20,
        isNew: true,
        maxPromptLength: 5000,
        maxPromptTokens: 1250,
        warningThreshold: 0.8
    },

    // --- ElevenLabs (Speech / TTS) ---
    {
        id: "elevenlabs/text-to-speech-multilingual-v2",
        name: "ElevenLabs TTS V2",
        description: "High-quality single-voice text-to-speech with 120+ voices, multilingual support, and fine-grained voice controls.",
        capabilities: ["speech"],
        provider: 'kie',
        costPerGeneration: 5,
        isNew: true,
        maxPromptLength: 5000,
        maxPromptTokens: 1250,
        warningThreshold: 0.8
    },
    {
        id: "elevenlabs/text-to-dialogue-v3",
        name: "ElevenLabs Dialogue V3",
        description: "Multi-speaker dialogue generation with emotion tags. Build conversations with different voices per line.",
        capabilities: ["speech"],
        provider: 'kie',
        costPerGeneration: 10,
        isNew: true,
        maxPromptLength: 5000,  // Total text across all dialogue lines
        maxPromptTokens: 1250,
        warningThreshold: 0.8
    },
];
