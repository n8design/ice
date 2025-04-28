import * as path from 'path';
import * as os from 'os';

/**
 * Normalize a path to use forward slashes, even on Windows
 */
export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

/**
 * Join path segments using POSIX style (forward slashes)
 */
export function joinPosixPath(...segments: string[]): string {
  return normalizePath(path.join(...segments));
}

/**
 * Platform-specific path separator and helper functions
 */
export const P = {
  sep: path.sep,
  normalize: normalizePath,
  join: joinPosixPath,
  isAbsolute: path.isAbsolute,
  dirname: (p: string) => normalizePath(path.dirname(p)),
  basename: path.basename,
  extname: path.extname,
};

/**
 * Resolve any path aliases defined in tsconfig.json
 * @param importPath Original import path
 * @param containingFile File containing the import
 * @param aliases Map of aliases to their replacements
 * @returns Resolved path
 */
export function resolvePathAliases(
  importPath: string, 
  containingFile: string, 
  aliases?: Record<string, string[]>
): string {
  if (!aliases || Object.keys(aliases).length === 0) {
    return importPath;
  }

  // Check if this import uses any of the defined aliases
  for (const [alias, replacements] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      // Try each possible replacement until we find one that exists
      for (const replacement of replacements) {
        const resolved = importPath.replace(alias, replacement);
        // In a real implementation we'd check if this file exists
        return resolved;
      }
    }
  }

  return importPath;
}

