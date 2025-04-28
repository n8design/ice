import * as esbuild from 'esbuild';
import * as path from 'path';
import { statSync } from 'fs';

// Update function signature to match how it's called in processor.ts
export function resolvePathAliases(
  projectDir: string,
  outbase: string,
  paths: Record<string, string[]>
): esbuild.Plugin {
  if (!paths || Object.keys(paths).length === 0) {
    return {
      name: 'no-path-aliases',
      setup() {} // Empty plugin if no aliases
    };
  }
  
  console.log('Setting up TypeScript path aliases:');
  Object.entries(paths).forEach(([alias, targets]) => {
    console.log(`  ${alias} -> ${targets.join(', ')}`);
  });
  
  return {
    name: 'ts-path-aliases',
    setup(build) {
      // Handle path aliases during import resolution
      build.onResolve({ filter: /.*/ }, args => {
        // Check if import path matches any alias
        for (const [alias, targets] of Object.entries(paths)) {
          const aliasRegex = new RegExp(`^${alias.replace(/\*/g, '(.*)').replace(/\//g, '\\/')}$`);
          const match = args.path.match(aliasRegex);
          
          if (match) {
            const wildcard = match[1] || '';
            
            // Try each target path
            for (const target of targets) {
              const resolvedTarget = target.replace(/\*/g, wildcard);
              const fullPath = path.join(projectDir, resolvedTarget);
              
              try {
                const stats = statSync(fullPath);
                if (stats.isFile()) {
                  return { path: fullPath };
                }
              } catch (_ignored) {
                // Path doesn't exist, try next one
              }
            }
          }
        }
        
        return null; // Let esbuild handle it
      });
    }
  };
}