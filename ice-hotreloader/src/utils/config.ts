/**
 * Configuration management for hotreloader
 */

export interface HotReloaderOptions {
  /**
   * Port to use for WebSocket connection
   */
  port?: number;
  
  /**
   * Output directory to strip from file paths
   */
  outputDir?: string;
  
  /**
   * Whether to refresh all stylesheets when no matching stylesheet is found
   * @default true
   */
  refreshAllStylesheetsOnNoMatch?: boolean;
  
  /**
   * Debug mode - enables additional logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default configuration values
 */
export const defaultOptions: Required<HotReloaderOptions> = {
  port: 3001,
  outputDir: 'public',
  refreshAllStylesheetsOnNoMatch: true,
  debug: false
};

/**
 * Merge user-provided options with defaults
 * @param options User-provided options
 * @returns Complete configuration with defaults for missing options
 */
export function mergeWithDefaults(options: HotReloaderOptions = {}): Required<HotReloaderOptions> {
  return {
    ...defaultOptions,
    ...options
  };
}
