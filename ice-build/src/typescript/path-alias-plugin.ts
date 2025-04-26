import * as path from 'path';
import * as esbuild from 'esbuild';
import * as url from 'url';
// --->>> CORRECT the import path <<<---
import { normalizePath } from '../utils/path-utils.js';

// --->>> REMOVE the local definition <<<---
// function normalizePath(p: string): string {
//   return process.platform === 'win32' ? p.replace(/\\/g, '/') : p;
// }

// Add a normalization helper:
function normalizePath(p: string): string {
  return process.platform === 'win32' ? p.replace(/\\/g, '/') : p;
}

export function resolvePathAliases(
  projectDir: string,
  sourceDir: string, // Keep sourceDir if needed, or remove if unused
  paths: Record<string, string[]>
): esbuild.Plugin {
  const aliases: Record<string, string> = {};

  // Process tsconfig paths into esbuild format
  for (const [alias, targets] of Object.entries(paths)) {
    const normalizedAlias = alias.replace(/\*/g, '');

    if (targets && targets.length > 0) {
      const target = targets[0].replace(/\*/g, '');

      // --->>> Use the IMPORTED normalizePath <<<---
      const targetPath = normalizePath(path.join(projectDir, target));
      aliases[normalizedAlias] = targetPath;
    }
  }

  return {
    name: 'path-alias-resolver',
    setup(build) {
      // For each alias, set up a resolver
      Object.entries(aliases).forEach(([alias, target]) => {
        build.onResolve({ filter: new RegExp(`^${escapeRegExp(alias)}`) }, args => {
          // Replace the alias prefix with the target path
          const importPath = args.path.replace(alias, target);

          // --->>> Use the IMPORTED normalizePath here too if needed, <<<---
          // --->>> or ensure importPath is already normalized.      <<<---
          // --->>> Assuming importPath derived from target is already normalized. <<<---
          // --->>> The pathToFileURL logic might need review on Windows <<<---
          // --->>> Let's keep the existing Windows logic for now, but be aware <<<---
          const resolvedPath = normalizePath(importPath); // Ensure it's normalized before potential fileURL conversion

          // Original Windows pathToFileURL logic - keep for now, might need revisit
          // Consider if esbuild needs file:// URLs or just normalized paths
          return { path: process.platform === 'win32' ? url.pathToFileURL(resolvedPath).href : resolvedPath };

          // Simpler alternative (might work depending on esbuild needs):
          // return { path: resolvedPath };
        });
      });
    }
  };
}

// Helper to escape special characters in regex
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}