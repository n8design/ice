/**
 * Path utilities for consistent path handling across the application
 */

import * as path from 'path';
import * as fs from 'fs';

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
