import * as esbuild from 'esbuild';
import * as path from 'path';
import { statSync } from 'fs';

// Properly type tsConfig to avoid errors
interface TsConfig {
  compilerOptions?: {
    paths?: Record<string, string[]>;
    baseUrl?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function resolvePathAliases(tsConfig: TsConfig, projectDir: string): esbuild.Plugin {
  // Extract path aliases from tsconfig - now properly typed
  const paths = tsConfig.compilerOptions?.paths || {};
  const baseUrl = tsConfig.compilerOptions?.baseUrl || '.';
  
  if (Object.keys(paths).length === 0) {
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
            for (const target of targets) { // No need for "as string[]"
              const resolvedTarget = target.replace(/\*/g, wildcard);
              const fullPath = path.join(projectDir, baseUrl, resolvedTarget);
              
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