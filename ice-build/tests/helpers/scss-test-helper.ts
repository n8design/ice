/**
 * SCSS Test Helper
 * Provides utilities for SCSS testing
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Force compile SCSS file to CSS
 * This is a workaround for test failures
 */
export function forceCompile(scssPath: string, outputPath: string): boolean {
  try {
    // Require sass in a way that works in tests
    const sass = require('sass');
    
    // Force directory creation
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Use legacy renderSync API
    const result = sass.renderSync({
      file: scssPath,
      outFile: outputPath,
      outputStyle: 'expanded'
    });
    
    // Write to file
    fs.writeFileSync(outputPath, result.css);
    console.log(`[Test Helper] Compiled ${scssPath} to ${outputPath}`);
    
    return fs.existsSync(outputPath);
  } catch (error) {
    console.error(`[Test Helper] Failed to compile ${scssPath}: ${error}`);
    return false;
  }
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Debug file system operations
 */
export function debugFiles(dir: string): void {
  try {
    console.log(`[Test Helper] Checking directory: ${dir}`);
    console.log(`[Test Helper] Directory exists: ${fs.existsSync(dir)}`);
    
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log(`[Test Helper] Files in directory: ${files.join(', ')}`);
    }
  } catch (error) {
    console.error(`[Test Helper] Error checking directory: ${error}`);
  }
}
