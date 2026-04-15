/**
 * Shared types for the media provider adapter layer.
 *
 * Each adapter (kie-image, kie-video, kie-audio, kie-speech) satisfies this
 * contract. Feature services call adapters and never import KieService directly.
 */

/** Minimum result returned by any media provider task creation call. */
export type MediaTaskResult = { taskId: string };
