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
 * Normalizes file paths to use forward slashes, which is important
 * for cross-platform compatibility, especially in Windows environments.
 * 
 * @param p The path to normalize
 * @returns The normalized path with forward slashes
 */
export function normalizePath(p: string): string {
  return process.platform === 'win32' ? p.replace(/\\/g, '/') : p;
}