import * as path from 'path';
import { logError } from './console.js';

// Colors for better highlighting
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

/**
 * Class to collect and group CSS errors by type
 */
export class CssErrorCollector {
  private errors: Map<string, Map<string, Set<string>>> = new Map();
  private projectDir: string;
  
  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }
  
  /**
   * Add an error for a file
   * @param errorType Type of error (e.g. "Invalid property 'background-col'")
   * @param filePath Path to the file with the error
   * @param mainFile Optional path to the main file that includes this partial
   */
  addError(errorType: string, filePath: string, mainFile?: string): void {
    const relativePath = path.relative(this.projectDir, filePath);
    
    if (!this.errors.has(errorType)) {
      this.errors.set(errorType, new Map());
    }
    
    const filesMap = this.errors.get(errorType)!;
    
    // If it's a partial file (starts with _), prioritize reporting it
    if (path.basename(filePath).startsWith('_')) {
      if (!filesMap.has(relativePath)) {
        filesMap.set(relativePath, new Set());
      }
      
      // If we know what main file includes this partial, add it
      if (mainFile) {
        const relativeMainPath = path.relative(this.projectDir, mainFile);
        filesMap.get(relativePath)!.add(relativeMainPath);
      }
    } 
    // If this is a main file but the error originates from a partial
    else if (mainFile && path.basename(mainFile).startsWith('_')) {
      const relativeMainPath = path.relative(this.projectDir, mainFile);
      if (!filesMap.has(relativeMainPath)) {
        filesMap.set(relativeMainPath, new Set());
      }
      filesMap.get(relativeMainPath)!.add(relativePath);
    } 
    // Regular file error
    else {
      if (!filesMap.has(relativePath)) {
        filesMap.set(relativePath, new Set());
      }
    }
  }
  
  /**
   * Update the relationship between a file with an error and its main file
   * @param filePath Path to the file with the error (typically a partial)
   * @param mainFile Path to the main file that includes this partial
   */
  updateErrorRelationship(filePath: string, mainFile?: string): void {
    if (!mainFile) return;
    
    const relativePath = path.relative(this.projectDir, filePath);
    const relativeMainPath = path.relative(this.projectDir, mainFile);
    
    // Search through all error types for this file
    this.errors.forEach((filesMap) => {
      if (filesMap.has(relativePath)) {
        const includedIn = filesMap.get(relativePath)!;
        includedIn.add(relativeMainPath);
      }
    });
  }
  
  /**
   * Reports all collected errors in a tree-like structure
   */
  reportErrors(): void {
    if (this.errors.size === 0) return;
    
    logError(`CSS issues found in ${this.getTotalFilesCount()} files`);
    
    this.errors.forEach((filesMap, errorType) => {
      // Highlight error type in yellow
      console.log(`  ${colors.yellow(errorType)}`);
      
      // Process and display files with errors
      const files = Array.from(filesMap.entries());
      
      files.sort((a, b) => a[0].localeCompare(b[0])).forEach(([filePath, includedIn]) => {
        // If it's a partial (source of error)
        if (path.basename(filePath).startsWith('_')) {
          const usedIn = Array.from(includedIn).join(', ');
          console.log(`    - ${colors.cyan(filePath)} ${colors.gray(`(used in: ${usedIn})`)} `);
        }
        // If it's a main file with direct error
        else if (includedIn.size === 0) {
          console.log(`    - ${colors.magenta(filePath)}`);
        }
        // Other cases
        else {
          console.log(`    - ${colors.magenta(filePath)}`);
        }
      });
    });
    
    console.log(''); // Add space after the error report
  }
  
  /**
   * Get total number of unique files with errors
   */
  getTotalFilesCount(): number {
    const allFiles = new Set<string>();
    this.errors.forEach(filesMap => {
      filesMap.forEach((includedIn, file) => {
        allFiles.add(file);
        includedIn.forEach(included => allFiles.add(included));
      });
    });
    return allFiles.size;
  }
  
  /**
   * Check if any errors were collected
   */
  hasErrors(): boolean {
    return this.errors.size > 0;
  }
  
  /**
   * Clear all collected errors
   */
  clearErrors(): void {
    this.errors.clear();
  }
}
