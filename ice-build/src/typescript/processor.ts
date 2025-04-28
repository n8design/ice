import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import * as esbuild from 'esbuild';
import * as ts from 'typescript';
import { performance } from 'perf_hooks';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { reportError } from '../utils/index.js';
import { formatBuildError } from '../utils/error-formatter.js';
import { getCurrentTime, formatDuration } from '../utils/console.js';
import { BuildContext } from '../types.js';
import { normalizePath, P, resolvePathAliases } from '../utils/path-utils.js';

// Helper function to check if a file is a TypeScript declaration file
function isTypeDefinitionFile(file: string): boolean {
  return file.endsWith('.d.ts');
}

export async function setupTsProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer | null,
  tsFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  const { projectDir, sourceDir, outputDir, config, tsConfig, isVerbose } = ctx;

  try {
    // Find all TS files in the source directory
    const globPattern = `${sourceDir}/**/*.{ts,tsx}`;
    const tsFiles = await glob(globPattern, { 
      cwd: projectDir, 
      ignore: ['**/node_modules/**', '**/*.d.ts'] 
    });

    // Prepare entry points for compilation
    const entryPoints: Record<string, string> = {};
    
    // Filter out and count TypeScript files
    const filteredTsFiles = tsFiles
      .filter(file => !isTypeDefinitionFile(file))
      .map(file => normalizePath(path.join(P.normalize(projectDir), file)));

    tsFilesCount.value = filteredTsFiles.length;

    if (filteredTsFiles.length === 0) {
      console.log('No TypeScript files found to process');
      return {} as esbuild.BuildContext; // Just to satisfy TypeScript
    }

    // Create entry points mapping
    for (const filePath of filteredTsFiles) {
      const relativePath = path.relative(path.join(projectDir, sourceDir), filePath);
      // Handle .ts and .tsx files
      const outputPath = relativePath.replace(/\.tsx?$/, '.js');
      entryPoints[outputPath] = filePath;

      if (isVerbose) {
        console.log(`Processing TS: ${relativePath}`);
      }
    }

    // Extract path aliases from tsconfig if available
    const aliases = tsConfig?.options.paths 
      ? resolvePathAliases('', '', tsConfig?.options.paths as Record<string, string[]>) 
      : {};

    // Set up esbuild plugin for TypeScript
    const tsPlugin = {
      name: 'typescript',
      setup(build: esbuild.PluginBuild) {
        // Track build start time
        let buildStartTime = 0;
        
        build.onStart(() => {
          buildStartTime = performance.now();
        });
        
        // Notify HMR on build completion
        build.onEnd(async (result: esbuild.BuildResult) => {
          if (!hmr) return;
          
          // Calculate build duration
          const buildDuration = performance.now() - buildStartTime;
          const formattedTime = buildDuration.toFixed(2);

          if (result.errors.length > 0) {
            if (ctx.isVerbose) {
              console.log('[DEBUG TS onEnd] Calling reportError...');
            }
            
            // Process each error with better formatting
            result.errors.forEach(error => {
              // Create a more informative error message that includes the filename
              const errorMessage = error.location 
                ? `${error.location.file}:${error.location.line}:${error.location.column}: ${error.text}`
                : error.text;
                
              const errorObj = new Error(errorMessage);
              
              // Report each error with nice formatting
              reportError('TypeScript build', errorObj, ctx.projectDir);
            });
          } else {
            if (ctx.isVerbose) {
              console.log('[DEBUG TS onEnd] No errors, proceeding with HMR notify.');
            }
            
            console.log(`🧊 [${getCurrentTime()}] TypeScript build completed in ${formattedTime}ms`);
            hmr.notifyClients('full', '');
          }
        });
      }
    };

    // Get include paths from tsconfig or defaults
    const includePaths = tsConfig?.options.paths 
      ? Object.values(tsConfig.options.paths).flat() as string[]
      : [];

    // Set up esbuild context
    return await esbuild.context({
      entryPoints,
      outdir: path.join(projectDir, outputDir),
      bundle: false,
      platform: 'browser',
      format: tsConfig?.options.module === ts.ModuleKind.CommonJS ? 'cjs' : 'esm',
      sourcemap: true,
      target: 'es2018',
      jsx: tsConfig?.options.jsx === ts.JsxEmit.Preserve ? 'preserve' : 'transform', 
      jsxFactory: tsConfig?.options.jsxFactory || 'React.createElement',
      jsxFragment: tsConfig?.options.jsxFragmentFactory || 'React.Fragment',
      // Handle CSS imports in TypeScript
      loader: {
        '.css': 'file',
        '.scss': 'file',
        '.sass': 'file'
      },
      plugins: [tsPlugin],
      ...config.typescriptOptions
    });
  } catch (err) {
    reportError('Failed to set up TypeScript processor', err as Error);
    throw err;
  }
}