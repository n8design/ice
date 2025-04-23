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