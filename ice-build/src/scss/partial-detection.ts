import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { getRelativePaths } from '../utils/path-utils';

export function isScssPartial(filePath: string): boolean {
  const basename = path.basename(filePath);
  return basename.startsWith('_') && basename.endsWith('.scss');
}

export async function findScssFilesImporting(
  partialPath: string,
  projectDir: string,
  sourceDir: string
): Promise<string[]> {
  const basename = path.basename(partialPath);
  const partialName = basename.substring(1); // Remove leading underscore
  const partialNameNoExt = partialName.replace('.scss', '');
  
  const allScssFiles = await glob(`${sourceDir}/**/*.scss`, { 
    cwd: projectDir,
    ignore: ['**/node_modules/**']
  });
  
  // Filter to non-partials only
  const mainScssFiles = allScssFiles.filter(file => !path.basename(file).startsWith('_'));
  const results: string[] = [];
  
  // Actually parse each file to check for imports
  for (const file of mainScssFiles) {
    const fullPath = path.join(projectDir, file);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Look for different import patterns
      const importPatterns = [
        new RegExp(`@import\\s+['"]_?${partialNameNoExt}['"]`, 'i'),
        new RegExp(`@import\\s+['"]_?${partialNameNoExt}\\.scss['"]`, 'i'),
        new RegExp(`@use\\s+['"]_?${partialNameNoExt}['"]`, 'i'),
        new RegExp(`@use\\s+['"]_?${partialNameNoExt}\\.scss['"]`, 'i'),
        new RegExp(`@forward\\s+['"]_?${partialNameNoExt}['"]`, 'i'),
        new RegExp(`@forward\\s+['"]_?${partialNameNoExt}\\.scss['"]`, 'i')
      ];
      
      // Check if any import pattern matches
      if (importPatterns.some(pattern => pattern.test(content))) {
        results.push(fullPath);
      } else {
        // Also check for path-based imports
        const relativePaths = getRelativePaths(fullPath, partialPath, sourceDir);
        for (const relPath of relativePaths) {
          for (const prefix of ['', '_']) {
            // Check import patterns with relative paths
            const relPatterns = [
              new RegExp(`@import\\s+['"]${relPath}${prefix}${partialNameNoExt}['"]`, 'i'),
              new RegExp(`@import\\s+['"]${relPath}${prefix}${partialNameNoExt}\\.scss['"]`, 'i'),
              new RegExp(`@use\\s+['"]${relPath}${prefix}${partialNameNoExt}['"]`, 'i'),
              new RegExp(`@use\\s+['"]${relPath}${prefix}${partialNameNoExt}\\.scss['"]`, 'i'),
              new RegExp(`@forward\\s+['"]${relPath}${prefix}${partialNameNoExt}['"]`, 'i'),
              new RegExp(`@forward\\s+['"]${relPath}${prefix}${partialNameNoExt}\\.scss['"]`, 'i')
            ];
            
            if (relPatterns.some(pattern => pattern.test(content))) {
              results.push(fullPath);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not check ${file} for imports: ${(error as Error).message}`);
    }
  }
  
  return results;
}