/**
 * Polling Configuration Constants
 *
 * Centralized configuration for generation polling behavior.
 * All time values are in milliseconds.
 */

export const POLLING_CONFIG = {
  /** Interval between status check polls (5 seconds) */
  POLL_INTERVAL: 5000,

  /** Maximum duration to poll before timing out (5 minutes) */
  MAX_POLL_DURATION: 300000,

  /** Interval for updating elapsed timer display (100ms for smooth updates) */
  TIMER_UPDATE_INTERVAL: 100,

  /** Delay before refreshing generation history after successful generation (1.5 seconds) */
  HISTORY_REFRESH_DELAY: 1500,

  /** Toast notification duration for background/detached completions (5 seconds) */
  BACKGROUND_TOAST_DURATION: 5000,
} as const;

/** Type-safe access to polling config keys */
export type PollingConfigKey = keyof typeof POLLING_CONFIG;
