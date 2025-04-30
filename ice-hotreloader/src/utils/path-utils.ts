/**
 * Utilities for handling paths consistently across the application
 */

/**
 * Normalize path to use forward slashes regardless of platform
 * @param path The path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(path: string): string {
  // First make sure it's a string
  if (typeof path !== 'string') {
    return path;
  }
  
  // Replace all backslashes with forward slashes
  let normalizedPath = path.replace(/\\/g, '/');
  
  // Remove trailing slashes
  normalizedPath = normalizedPath.replace(/\/+$/, '');
  
  return normalizedPath;
}

/**
 * Remove output directory prefix from a path
 * @param path The path to process
 * @param outputDir The output directory to remove
 * @returns Path without the output directory prefix
 */
export function removeOutputDirPrefix(path: string, outputDir: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedOutputDir = normalizePath(outputDir);
  
  const prefix = normalizedOutputDir + '/';
  
  return normalizedPath.startsWith(prefix)
    ? normalizedPath.substring(prefix.length)
    : normalizedPath;
}

/**
 * Create a URL with cache busting parameter
 * @param href Original URL string
 * @param timestamp Timestamp to use for cache busting (defaults to current time)
 * @returns URL object with cache busting parameter
 */
export function createCacheBustedUrl(href: string, timestamp: number = Date.now()): URL {
  const url = new URL(href);
  url.searchParams.set('t', timestamp.toString());
  return url;
}
