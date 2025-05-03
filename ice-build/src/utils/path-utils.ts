/**
 * Path utilities for consistent path handling across the application
 */

import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

/**
 * Normalize path to use forward slashes regardless of platform
 * @param filePath The path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  if (typeof filePath !== 'string') {
    return filePath;
  }
  
  // Replace backslashes with forward slashes
  let normalizedPath = filePath.replace(/\\/g, '/');
  
  // Remove trailing slashes
  normalizedPath = normalizedPath.replace(/\/+$/, '');
  
  return normalizedPath;
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath Directory path to ensure
 */
export async function ensureDir(dirPath: string): Promise<void> {
  const normalizedPath = normalizePath(dirPath);
  
  try {
    await fs.promises.access(normalizedPath);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(normalizedPath, { recursive: true });
  }
}

/**
 * Combine and normalize multiple path segments
 * @param segments Path segments to join
 * @returns Normalized combined path
 */
export function joinPaths(...segments: string[]): string {
  return normalizePath(path.join(...segments));
}

/**
 * Get the relative path between two absolute paths
 * @param from Source path
 * @param to Target path
 * @returns Normalized relative path
 */
export function getRelativePath(from: string, to: string): string {
  return normalizePath(path.relative(from, to));
}

/**
 * Check if a path is a partial file (starts with underscore)
 * @param filePath File path to check
 * @returns True if the file is a partial
 */
export function isPartial(filePath: string): boolean {
  return path.basename(filePath).startsWith('_');
}

/**
 * Resolve a path relative to the project root
 * @param relativePath Path relative to project root
 * @returns Absolute path
 */
export function resolveProjectPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

/**
 * Get output path based on configuration
 * @param config Configuration object
 * @returns Resolved output path
 */
export function getOutputPath(config: any): string {
  if (typeof config.output === 'string') {
    return resolveProjectPath(config.output);
  } else if (config.output && typeof config.output === 'object' && 'path' in config.output) {
    return resolveProjectPath(config.output.path);
  }
  return resolveProjectPath('dist'); // Default fallback
}

/**
 * Find files matching patterns with cross-platform safety
 * @param patterns Glob patterns to match
 * @param options Options for glob
 * @returns Array of matching file paths
 */
export async function findFiles(patterns: string[], options = {}): Promise<string[]> {
  const results: string[] = [];
  
  for (const pattern of patterns) {
    // Use glob with normalization
    const matches = await glob(normalizePath(pattern), options);
    results.push(...matches.map(p => normalizePath(p)));
  }
  
  return results;
}
