import * as esbuild from 'esbuild';
import * as path from 'path';
import { glob } from 'glob';
import { ESLint } from 'eslint';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types';
import { safeWriteFile, reportError } from '../utils';
import { resolvePathAliases } from './path-aliases';
import { lintFile } from '../linting/eslint';

// Helper functions for converting TS settings to esbuild settings
export function convertTsTargetToEsbuild(tsTarget?: string): string {
  if (!tsTarget) return 'es2020';
  
  const targetMap: Record<string, string> = {
    'es3': 'es2015',
    'es5': 'es2015',
    'es6': 'es2015',
    'es2015': 'es2015',
    'es2016': 'es2016',
    'es2017': 'es2017',
    'es2018': 'es2018',
    'es2019': 'es2019',
    'es2020': 'es2020',
    'es2021': 'es2021',
    'es2022': 'es2022',
    'esnext': 'esnext',
  };
  
  return targetMap[tsTarget.toLowerCase()] || 'es2020';
}

export function convertTsModuleToEsbuild(tsModule?: string): esbuild.Format {
  if (!tsModule) return 'esm';
  
  const moduleMap: Record<string, esbuild.Format> = {
    'commonjs': 'cjs',
    'amd': 'esm',
    'umd': 'esm',
    'system': 'esm',
    'es6': 'esm',
    'es2015': 'esm',
    'es2020': 'esm',
    'esnext': 'esm',
    'node16': 'esm',
    'nodenext': 'esm',
  };
  
  return moduleMap[tsModule.toLowerCase()] || 'esm';
}

export async function setupTsProcessor(
  ctx: BuildContext, 
  hmr: HotReloadServer, 
  tsConfig: Record<string, unknown>,
  eslintInstance: ESLint | null,
  tsFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  // Use a typed interface for compiler options
  interface CompilerOptions {
    target?: string;
    module?: string;
    sourceMap?: boolean;
    [key: string]: unknown;
  }

  // Cast the compilerOptions to the proper type
  const compilerOptions = (tsConfig.compilerOptions || {}) as CompilerOptions;

  // Create a context for TypeScript builds with enhanced config support
  const tsContext = await esbuild.context({
    entryPoints: await glob(`${ctx.sourceDir}/**/*.ts`, { cwd: ctx.projectDir }),
    outdir: path.join(ctx.projectDir, ctx.outputDir, 'js'),
    // Apply TypeScript configuration - no need for "as string" anymore
    target: convertTsTargetToEsbuild(compilerOptions.target),
    format: convertTsModuleToEsbuild(compilerOptions.module),
    plugins: [
      // Add path alias resolution support
      resolvePathAliases(tsConfig, ctx.projectDir),
      // Fix errors in the flatten-ts-structure plugin
      {
        name: 'flatten-ts-structure',
        setup(build) {
          build.onResolve({ filter: /\.ts$/ }, args => {
            // Keep the normal behavior for resolve
            return null;
          });
          
          build.onEnd(async (result) => {
            if (!result.outputFiles) return;
            
            // Move output files
            for (const outputFile of result.outputFiles) {
              // Only process JS files (not maps) at this stage
              if (!outputFile.path.endsWith('.js')) continue;
              
              const originalPath = outputFile.path;
              let newPath = originalPath;
              
              // Check if this file came from the ts folder
              // Convert output path back to source path
              const publicJsDir = path.join(ctx.projectDir, ctx.outputDir, 'js');
              const relativePath = path.relative(publicJsDir, outputFile.path);
              
              // If the file has a ts/ directory in its path, flatten it
              if (relativePath.startsWith(`${ctx.sourceDir.split('/')[0]}/ts/`) || 
                  relativePath.startsWith('ts/')) {
                // Move to public/js directly, removing the ts/ part
                newPath = path.join(publicJsDir, path.basename(outputFile.path));
                
                // Copy the file to the new location
                await safeWriteFile(newPath, outputFile.text, ctx.projectDir, ctx.isVerbose);
                
                // Also move the sourcemap if it exists
                const sourceMapFile = result.outputFiles.find(
                  (f: esbuild.OutputFile) => f.path === `${outputFile.path}.map`
                );
                
                if (sourceMapFile) {
                  const newMapPath = `${newPath}.map`;
                  
                  // Update the sourcemap content to reflect the new path
                  const sourceMap = JSON.parse(sourceMapFile.text);
                  sourceMap.file = path.basename(newPath);
                  
                  await safeWriteFile(
                    newMapPath, 
                    JSON.stringify(sourceMap), 
                    ctx.projectDir, 
                    ctx.isVerbose
                  );
                }
                
                console.log(`Flattened: ${relativePath} → ${path.basename(outputFile.path)}`);
              } else {
                // For TS files not in the ts directory, keep the original path
                await safeWriteFile(
                  outputFile.path, 
                  outputFile.text, 
                  ctx.projectDir, 
                  ctx.isVerbose
                );
                
                const sourceMapFile = result.outputFiles.find(
                  (f: esbuild.OutputFile) => f.path === `${outputFile.path}.map`
                );
                
                if (sourceMapFile) {
                  await safeWriteFile(
                    sourceMapFile.path, 
                    sourceMapFile.text, 
                    ctx.projectDir, 
                    ctx.isVerbose
                  );
                }
              }
            }
          });
        }
      },
      // Keep your existing eslint-and-hmr plugin
      {
        name: 'eslint-and-hmr',
        setup(build) {
          // Run ESLint on each file before build
          build.onLoad({ filter: /\.ts$/ }, async (args) => {
            if (!ctx.skipLint && eslintInstance) {
              const lintSuccess = await lintFile(args.path, eslintInstance, ctx.isVerbose);
              if (!lintSuccess) {
                return {
                  errors: [{ text: 'ESLint errors found, see console output' }],
                };
              }
            }
            return null; // Continue with default loading
          });
          
          // Handle HMR after build
          build.onEnd(async (result) => {
            if (result.errors.length > 0) {
              console.error('TypeScript build failed:', result.errors);
              return;
            }
            
            // Reset the counter for statistics
            tsFilesCount.value = 0;
            
            // For each output file, send HMR notification
            if (!result.outputFiles) {
              console.warn('No output files generated from TypeScript build');
              return;
            }
            
            for (const outputFile of result.outputFiles) {
              // Skip source maps and non-JS files
              if (outputFile.path.endsWith('.map') || !outputFile.path.endsWith('.js')) continue;
              
              // Count JS files
              tsFilesCount.value++;
              
              try {
                // Determine correct path for HMR notifications
                const publicJsDir = path.join(ctx.projectDir, ctx.outputDir, 'js');
                let hmrPath;
                
                // Check if this came from the ts folder
                const relativePath = path.relative(publicJsDir, outputFile.path);
                if (relativePath.startsWith(`${ctx.sourceDir.split('/')[0]}/ts/`) || 
                    relativePath.startsWith('ts/')) {
                  // Use flattened path for HMR
                  hmrPath = path.basename(outputFile.path);
                } else {
                  // Use normal relative path
                  hmrPath = relativePath;
                }
                
                // Normalize path separators for URLs
                hmrPath = hmrPath.replace(/\\/g, '/');
                
                // Send HMR notification
                hmr.notifyClients('full', hmrPath);
                console.log(`[${new Date().toLocaleTimeString()}] 📤 JS update: ${hmrPath}`);
              } catch (error) {
                reportError(
                  `JS processing (${path.basename(outputFile.path)})`, 
                  error as Error, 
                  ctx.isVerbose
                );
              }
            }
          });
        }
      }
    ],
    outbase: path.join(ctx.projectDir, ctx.sourceDir),
    bundle: false,
    sourcemap: compilerOptions.sourceMap !== false,
    logLevel: ctx.isVerbose ? 'info' : 'warning',
    write: false, // Don't write directly, we'll handle that in the plugins
  });

  return tsContext;
}