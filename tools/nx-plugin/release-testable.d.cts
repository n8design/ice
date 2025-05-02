/**
 * Type declarations for release-testable.cjs
 */

/**
 * Release options
 */
export interface ReleaseOptions {
  releaseType: string;
  preid?: string;
  projectName: string;
}

/**
 * Result of the release operation
 */
export interface ReleaseResult {
  success: boolean;
}

/**
 * Handle the release operation
 */
export function handler(args: ReleaseOptions): Promise<ReleaseResult>;

/**
 * Build command line options
 */
export function builder(yargs: any): any;
