import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL as nodePathToFileURL } from 'url';

/**
 * Normalize a file path to use forward slashes consistently.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Join path segments using POSIX separators, then normalize.
 * Useful for generating paths for external tools or configurations.
 */
export function joinPosixPath(...segments: string[]): string {
  return normalizePath(path.posix.join(...segments));
}

/**
 * Resolve path segments using POSIX separators, then normalize.
 */
export function resolvePosixPath(...segments: string[]): string {
  return normalizePath(path.posix.resolve(...segments));
}

/**
 * Get the directory name using POSIX separators.
 */
export function posixDirname(filePath: string): string {
  return path.posix.dirname(normalizePath(filePath));
}

/**
 * Get the base name using POSIX separators.
 */
export function posixBasename(filePath: string, ext?: string): string {
  return path.posix.basename(normalizePath(filePath), ext);
}

/**
 * Get the extension name using POSIX separators.
 */
export function posixExtname(filePath: string): string {
  return path.posix.extname(normalizePath(filePath));
}

/**
 * Convert a file URL (string) to a normalized path.
 */
export function fileUrlToPath(fileUrl: string): string {
  return normalizePath(fileURLToPath(fileUrl));
}

/**
 * Convert a normalized file path to a file URL string.
 * Handles Windows drive letters correctly.
 */
export function pathToFileURL(filePath: string): string {
  return nodePathToFileURL(filePath).href;
}

/**
 * Check if path exists using fs.accessSync.
 */
export function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, create it recursively if it doesn't.
 */
export function ensureDir(dirPath: string): void {
  if (!pathExists(dirPath)) {
    // Use native path separator for mkdirSync
    fs.mkdirSync(path.normalize(dirPath), { recursive: true });
  }
}

