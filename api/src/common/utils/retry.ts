import { Logger } from '@nestjs/common';

/**
 * Configuration options for the retry logic.
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  retryableStatuses?: number[];
  /**
   * Optional fixed retry schedule (ms) used instead of exponential backoff.
   * Index 0 is the delay before retry #1, index 1 before retry #2, etc.
   * If shorter than maxRetries-1, remaining retries fall back to exponential backoff.
   */
  delaySequenceMs?: number[];
}

const logger = new Logger('RetryUtility');

/**
 * Execute a function with exponential backoff retry logic.
 * Specifically handles network-level failures and specific HTTP status codes.
 *
 * @param fn The function to execute (must return a Promise)
 * @param options Retry configuration options
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    retryableStatuses = [429, 502, 503, 504],
    delaySequenceMs,
  } = options;

  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status =
        error?.status ||
        error?.response?.status ||
        error?.response?.data?.error?.code;
      const errorMessage = error?.message || 'Unknown error';

      // Check if it's a network-level failure or a retryable HTTP status
      const isNetworkError =
        /fetch failed/i.test(errorMessage) ||
        error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ECONNRESET' ||
        error?.name === 'ConnectTimeoutError';

      const isRetryableStatus = status && retryableStatuses.includes(status);

      if (isNetworkError || isRetryableStatus) {
        if (i < maxRetries - 1) {
          const scheduledDelay =
            Array.isArray(delaySequenceMs) && delaySequenceMs[i] != null
              ? Number(delaySequenceMs[i])
              : null;

          const backoff =
            typeof scheduledDelay === 'number' && Number.isFinite(scheduledDelay)
              ? Math.max(0, scheduledDelay)
              : Math.min(initialDelay * Math.pow(factor, i), maxDelay);
          const jitter = Math.random() * 1000;
          const delay = backoff + jitter;
          logger.warn(
            `[RetryDiag] Error: ${errorMessage} | Status: ${status || 'N/A'} | Code: ${error?.code || 'N/A'}. ` +
              `Retrying sequence ${i + 1}/${maxRetries} in ${(delay / 1000).toFixed(2)}s...`,
          );
          if (isNetworkError) {
            logger.verbose(
              `[RetryDiag] Stack trace for network error: ${error.stack}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // If not retryable or max retries reached, throw the error
      throw error;
    }
  }

  throw lastError;
}
