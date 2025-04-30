/**
 * Error handling utilities for ice-build
 */

/**
 * Custom error class for build errors
 */
export class BuildError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'BuildError';
    
    // Set prototype explicitly for better instanceof behavior
    Object.setPrototypeOf(this, BuildError.prototype);
  }
}

/**
 * Wrap an async function with error handling
 * @param fn Function to wrap
 * @param errorMessage Message to show if function throws
 * @returns Wrapped function
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorMessage: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw new BuildError(
        `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`, 
        error instanceof Error ? error : undefined
      );
    }
  };
}

/**
 * Safely parse JSON with error handling
 * @param jsonString JSON string to parse
 * @param defaultValue Default value to return if parsing fails
 * @returns Parsed object or default value
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return defaultValue;
  }
}
