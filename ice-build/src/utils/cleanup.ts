import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { logInfo } from './console.js';

/**
 * Remove unnecessary CSS.js and CSS.js.map files
 * @param outputDir The output directory
 */
export async function cleanupCssJsFiles(outputDir: string): Promise<void> {
  try {
    // Find all CSS.js and CSS.js.map files
    const cssJsFiles = await glob('**/*.css.js*', {
      cwd: outputDir,
      absolute: true
    });

    // Delete each file
    for (const file of cssJsFiles) {
      try {
        fs.unlinkSync(file);
        logInfo(`Removed unnecessary file: ${path.basename(file)}`);
      } catch (err) {
        console.error(`Failed to remove file ${file}:`, err);
      }
    }

    if (cssJsFiles.length > 0) {
      logInfo(`Removed ${cssJsFiles.length} unnecessary CSS.js files`);
    }
  } catch (error) {
    console.error('Failed to clean up CSS.js files:', error);
  }
}
