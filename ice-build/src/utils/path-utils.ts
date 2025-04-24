import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

/**
 * Normalize a file path for the current platform
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/[\/\\]/g, path.sep);
}

/**
 * Resolve paths in a cross-platform way
 */
export function resolvePath(...pathSegments: string[]): string {
  return path.resolve(...pathSegments);
}

/**
 * Join paths in a cross-platform way
 */
export function joinPath(...pathSegments: string[]): string {
  return path.join(...pathSegments);
}

/**
 * Convert a file URL to a path
 */
export function fileUrlToPath(fileUrl: string): string {
  return fileURLToPath(fileUrl);
}

/**
 * Convert a path to a file URL
 * Critical for ESM imports on Windows
 */
export function pathToUrl(filePath: string): URL {
  return pathToFileURL(filePath);
}

/**
 * Get the directory name from a path
 */
export function getDirname(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get the file name from a path
 */
export function getBasename(filePath: string, ext?: string): string {
  return path.basename(filePath, ext);
}

/**
 * Get the extension of a file
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Check if path exists
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
 * Ensure directory exists, create it if it doesn't
 */
export function ensureDir(dirPath: string): void {
  if (!pathExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get platform-specific path separator
 */
export const separator = path.sep;

/**
 * Parse a path into its components
 */
export function parsePath(filePath: string): path.ParsedPath {
  return path.parse(filePath);
}

/**
 * Get relative path between two paths
 */
export function relativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}