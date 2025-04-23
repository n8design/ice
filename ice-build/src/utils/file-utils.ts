import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { reportError } from './error-reporting'; // Correct import path
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { FSWatcher } from 'fs';
import { ESLint } from 'eslint';

// File hash cache for improved performance
const fileHashCache = new Map<string, string>();

export async function getFileHash(content: string): Promise<string> {
  return createHash('md5').update(content).digest('hex');
}

export function hasFileChanged(filePath: string, content: string): Promise<boolean> {
  return getFileHash(content).then(hash => {
    const previousHash = fileHashCache.get(filePath);
    fileHashCache.set(filePath, hash);
    return hash !== previousHash;
  });
}

export async function safeWriteFile(
  filePath: string, 
  content: string, 
  projectDir: string,
  isVerbose: boolean = false
): Promise<void> {
  try {
    // Check if file content has changed before writing
    let shouldWrite = true;
    
    try {
      await fs.readFile(filePath, 'utf-8');
      shouldWrite = await hasFileChanged(filePath, content);
      
      if (!shouldWrite && isVerbose) {
        console.log(`Skipping unchanged file: ${path.basename(filePath)}`);
        return;
      }
    } catch (_ignored) {
      // File doesn't exist yet, we need to write it
    }
    
    if (shouldWrite) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
      
      if (isVerbose) {
        console.log(`Wrote file: ${path.relative(projectDir, filePath)}`);
      }
    }
  } catch (error) {
    reportError(`File writing (${path.basename(filePath)})`, error as Error, isVerbose);
    throw new Error(`Failed to write file ${filePath}: ${(error as Error).message}`);
  }
}

export function resolveProjectPath(projectDir: string, relativePath: string): string {
  try {
    return path.resolve(projectDir, relativePath);
  } catch (error) {
    console.error(`Error resolving path '${relativePath}':`, error);
    throw error;
  }
}