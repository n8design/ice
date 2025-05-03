/**
 * Create a centralized error handling utility
 */
import { Logger } from './logger.js';

const logger = new Logger('ErrorHandler');

/**
 * Error types
 */
export enum ErrorType {
  CONFIG = 'Configuration',
  BUILD = 'Build',
  WATCHER = 'Watcher',
  TYPESCRIPT = 'TypeScript',
  SCSS = 'SCSS',
  HTML = 'HTML',
  GENERAL = 'General'
}

/**
 * Custom error class for build errors (merged from error-handling.ts)
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
 * Format and log error with consistent structure
 */
export function handleError(
  error: any, 
  type: ErrorType = ErrorType.GENERAL, 
  context?: string
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const contextStr = context ? ` (${context})` : '';
  
  logger.error(`${type} Error${contextStr}: ${errorMessage}`);
  
  if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
    logger.debug(`Stack trace: ${error.stack}`);
  }
}

/**
 * Create a safe function wrapper that catches errors
 */
export function safeExecute<T>(
  fn: () => Promise<T>,
  type: ErrorType,
  context?: string
): Promise<T | null> {
  return fn().catch(error => {
    handleError(error, type, context);
    return null;
  });
}

/**
 * Safely parse JSON with error handling (merged from error-handling.ts)
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return defaultValue;
  }
}
