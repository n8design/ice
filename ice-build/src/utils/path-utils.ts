import * as path from 'path';

export function getRelativePaths(fromFile: string, toFile: string, sourceDir: string): string[] {
  const fromDir = path.dirname(fromFile);
  const toDir = path.dirname(toFile);
  
  // Get relative path from fromDir to toDir
  let relPath = path.relative(fromDir, toDir);
  if (relPath && !relPath.endsWith('/')) {
    relPath += '/';
  }
  
  // Also consider sass/scss load paths
  return [
    relPath,                    // Relative path
    '',                         // Same directory
    './',                       // Explicit current directory
    '../',                      // Parent directory
    `${sourceDir}/`,            // Source root
    `${sourceDir}/styles/`,     // Common styles folders
    `${sourceDir}/scss/`,
    `${sourceDir}/sass/`,
    `${sourceDir}/css/`
  ];
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