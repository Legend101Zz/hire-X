/**
 * Polling utility for backend-v2 progress tracking
 * Since backend-v2 doesn't use WebSocket, we poll for updates
 */

export interface PollingOptions {
  interval?: number; // Polling interval in milliseconds (default: 2000)
  maxAttempts?: number; // Maximum number of polling attempts (default: Infinity)
  onUpdate?: (data: unknown) => void; // Callback for each update
  onComplete?: (data: unknown) => void; // Callback when polling completes
  onError?: (error: Error) => void; // Callback for errors
  shouldStop?: (data: unknown) => boolean; // Custom condition to stop polling
}

/**
 * Generic polling function
 */
export const startPolling = async <T>(
  fetchFn: () => Promise<T>,
  options: PollingOptions = {}
): Promise<T> => {
  const {
    interval = 2000,
    maxAttempts = Infinity,
    onUpdate,
    onComplete,
    onError,
    shouldStop,
  } = options;

  let attempts = 0;
  let isPolling = true;

  const poll = async (): Promise<T> => {
    try {
      attempts++;
      const data = await fetchFn();

      // Call onUpdate callback
      if (onUpdate) {
        onUpdate(data);
      }

      // Check if we should stop polling
      if (shouldStop && shouldStop(data)) {
        isPolling = false;
        if (onComplete) {
          onComplete(data);
        }
        return data;
      }

      // Check if we've reached max attempts
      if (attempts >= maxAttempts) {
        isPolling = false;
        if (onComplete) {
          onComplete(data);
        }
        return data;
      }

      // Continue polling
      if (isPolling) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        return poll();
      }

      return data;
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
      throw error;
    }
  };

  return poll();
};

/**
 * Stop condition for scorecard status polling
 */
export const isScorecardComplete = (data: {
  status: string;
  progress: number;
}): boolean => {
  return data.status === "completed" || data.progress === 100;
};

/**
 * Stop condition for enrichment progress polling
 */
export const isEnrichmentComplete = (data: {
  progress_percentage: number;
}): boolean => {
  return data.progress_percentage === 100;
};

/**
 * Polling manager class for better control
 */
export class PollingManager<T> {
  private isActive = false;
  private abortController: AbortController | null = null;

  constructor(
    private fetchFn: () => Promise<T>,
    private options: PollingOptions = {}
  ) {}

  /**
   * Start polling
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.warn("Polling is already active");
      return;
    }

    this.isActive = true;
    this.abortController = new AbortController();

    const {
      interval = 2000,
      maxAttempts = Infinity,
      onUpdate,
      onComplete,
      onError,
      shouldStop,
    } = this.options;

    let attempts = 0;

    const poll = async () => {
      if (!this.isActive) return;

      try {
        attempts++;
        const data = await this.fetchFn();

        if (onUpdate) {
          onUpdate(data);
        }

        if (shouldStop && shouldStop(data)) {
          this.stop();
          if (onComplete) {
            onComplete(data);
          }
          return;
        }

        if (attempts >= maxAttempts) {
          this.stop();
          if (onComplete) {
            onComplete(data);
          }
          return;
        }

        if (this.isActive) {
          setTimeout(poll, interval);
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
        this.stop();
      }
    };

    poll();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isActive = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if polling is active
   */
  isPolling(): boolean {
    return this.isActive;
  }
}
