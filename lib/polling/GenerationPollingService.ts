/**
 * Generation Polling Service
 *
 * Handles polling for asynchronous generation task completion.
 * Consolidates foreground and background polling logic into a single,
 * testable service.
 */

import { persistGeneration } from '@/lib/clientPersist';
import { POLLING_CONFIG } from './constants';

export interface PollTask {
  taskId: string;
  generationId: string;
  modelId: string;
  promptId: string;
  promptTitle: string;
}

export interface PollStatusResponse {
  status: 'pending' | 'processing' | 'success' | 'failed';
  output?: string;
  error?: string;
  latency?: number;
  type?: string;
  audioMeta?: {
    tracks?: unknown[];
  };
  needsPersist?: boolean;
  generationId?: string;
}

export interface PollResult {
  status: 'success' | 'failed' | 'timeout' | 'aborted';
  output?: string;
  error?: string;
  latency?: number;
  type?: string;
  audioMeta?: {
    tracks?: unknown[];
  };
  generationId?: string;
  needsPersist?: boolean;
}

export interface PollOptions {
  /** Callback fired when poll stage changes (e.g., 'processing', 'finalizing') */
  onStageChange?: (stage: 'processing' | 'finalizing') => void;

  /** Callback to check if polling should abort */
  shouldAbort?: () => boolean;

  /** Whether to persist generation result to Supabase in background */
  autoPersist?: boolean;
}

/**
 * Service for polling generation task status
 *
 * Provides unified polling logic for both foreground (user waiting)
 * and background (user navigated away) generation tasks.
 */
export class GenerationPollingService {
  /** Tracks active background polls to prevent duplicates */
  private activePollIds = new Set<string>();

  /**
   * Polls for generation task completion
   *
   * @param task - Task information
   * @param options - Polling options
   * @returns Poll result with status and output
   */
  async poll(task: PollTask, options: PollOptions = {}): Promise<PollResult> {
    const { onStageChange, shouldAbort, autoPersist = true } = options;
    const pollStart = Date.now();

    onStageChange?.('processing');

    while (Date.now() - pollStart < POLLING_CONFIG.MAX_POLL_DURATION) {
      // Check for abort signal
      if (shouldAbort?.()) {
        return { status: 'aborted' };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLLING_CONFIG.POLL_INTERVAL));

      // Check abort again after wait
      if (shouldAbort?.()) {
        return { status: 'aborted' };
      }

      // Fetch status from API
      try {
        const statusResponse = await this.fetchStatus(task.taskId, task.generationId);

        // Handle success
        if (statusResponse.status === 'success' && statusResponse.output) {
          // Persist to Supabase in background if needed
          if (autoPersist && statusResponse.needsPersist && statusResponse.output) {
            this.persistInBackground(
              statusResponse.generationId || task.generationId,
              statusResponse.output
            );
          }

          onStageChange?.('finalizing');

          return {
            status: 'success',
            output: statusResponse.output,
            latency: statusResponse.latency,
            type: statusResponse.type,
            audioMeta: statusResponse.audioMeta,
            generationId: statusResponse.generationId,
            needsPersist: statusResponse.needsPersist,
          };
        }

        // Handle failure
        if (statusResponse.status === 'failed') {
          return {
            status: 'failed',
            error: statusResponse.error || 'Generation failed',
          };
        }

        // Otherwise continue polling (status is 'pending' or 'processing')
      } catch (error) {
        console.error('[poll] Error during status check:', error);
        // Continue polling despite error (might be transient network issue)
      }
    }

    // Max poll duration exceeded
    return { status: 'timeout' };
  }

  /**
   * Starts a detached background poll
   *
   * Used when user navigates away from prompt but generation is still running.
   * Prevents duplicate polls for the same generation and cleans up when done.
   *
   * @param task - Task information
   */
  async pollDetached(task: PollTask): Promise<void> {
    // Prevent duplicate background polls
    if (this.activePollIds.has(task.generationId)) {
      return;
    }

    this.activePollIds.add(task.generationId);

    try {
      const result = await this.poll(task, {
        autoPersist: true,
        // No stage callbacks or abort checks for detached polls
      });

      // Log result for debugging
      if (result.status === 'success') {
        console.log('[poll] Detached poll succeeded:', task.generationId);
      } else if (result.status === 'failed') {
        console.error('[poll] Detached poll failed:', task.generationId, result.error);
      } else if (result.status === 'timeout') {
        console.warn('[poll] Detached poll timed out:', task.generationId);
      }
    } catch (error) {
      console.error('[poll] Detached polling error:', error);
    } finally {
      // Always clean up to prevent memory leak
      this.activePollIds.delete(task.generationId);
    }
  }

  /**
   * Fetches generation status from API
   *
   * @param taskId - KIE task ID
   * @param generationId - Database generation ID
   * @returns Status response
   */
  private async fetchStatus(taskId: string, generationId: string): Promise<PollStatusResponse> {
    const response = await fetch(
      `/api/generate/status?taskId=${taskId}&generationId=${generationId}`
    );

    if (!response.ok) {
      throw new Error(`Status fetch failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Persists generation to Supabase in background
   *
   * Catches errors to avoid breaking the poll flow.
   *
   * @param generationId - Database generation ID
   * @param sourceUrl - Temporary generation URL
   */
  private persistInBackground(generationId: string, sourceUrl: string): void {
    persistGeneration(generationId, sourceUrl)
      .then(result => {
        if (result.success && result.publicUrl) {
          console.log(`[persist] ${result.method}: ${result.publicUrl}`);
        }
      })
      .catch(error => {
        console.warn('[persist] Background persist failed:', error);
      });
  }

  /**
   * Checks if a generation is currently being polled in background
   *
   * @param generationId - Database generation ID
   * @returns True if actively polling
   */
  isPollingInBackground(generationId: string): boolean {
    return this.activePollIds.has(generationId);
  }

  /**
   * Gets count of active background polls
   *
   * @returns Number of active background polls
   */
  getActiveBackgroundPollCount(): number {
    return this.activePollIds.size;
  }

  /**
   * Clears all background poll tracking
   *
   * Should be called on component unmount or app cleanup.
   * Does NOT abort in-flight polls, just clears tracking.
   */
  cleanup(): void {
    this.activePollIds.clear();
  }
}

/**
 * Singleton instance for app-wide use
 *
 * Using a singleton ensures background polls persist even if
 * the component that started them unmounts.
 */
let globalPollingService: GenerationPollingService | null = null;

/**
 * Gets the global polling service instance
 *
 * @returns Shared polling service instance
 */
export function getPollingService(): GenerationPollingService {
  if (!globalPollingService) {
    globalPollingService = new GenerationPollingService();
  }
  return globalPollingService;
}

/**
 * Creates a new isolated polling service instance
 *
 * Use this for testing or when you need isolated polling state.
 *
 * @returns New polling service instance
 */
export function createPollingService(): GenerationPollingService {
  return new GenerationPollingService();
}
