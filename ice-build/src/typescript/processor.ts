import * as esbuild from 'esbuild';
import * as P from 'path';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types.js'; // Add .js
import { resolvePathAliases } from './path-alias-plugin.js'; // Add .js
import { reportError } from '../utils/index.js'; // Add .js (assuming index.js exists in utils)
import * as fs from 'fs';

export async function setupTsProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer,
  tsFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  // Update the glob pattern to include both .ts and .tsx files
  const globPattern = `${ctx.sourceDir}/**/*.{ts,tsx}`;
  // Filter to ensure we only process files, not directories
  const entryPoints = (await glob(globPattern, { cwd: ctx.projectDir }))
    .filter(file => {
      const fullPath = P.join(ctx.projectDir, file);
      return fs.statSync(fullPath).isFile();
    });

  // --- TEMPORARY LOGGING ---
  console.log(`[TS Processor] Glob pattern: ${globPattern}`);
  console.log(`[TS Processor] Found entry points: ${JSON.stringify(entryPoints)}`);
  if (entryPoints.length === 0) {
      console.warn(`[TS Processor] Warning: No TS entry points found matching pattern.`);
  }
  // --- END LOGGING ---

  const outbase = P.join(ctx.projectDir, ctx.sourceDir);
  const outdir = P.join(ctx.projectDir, ctx.outputDir);
  const target = ctx.tsConfig?.compilerOptions?.target as string || 'es2020';

  const plugins: esbuild.Plugin[] = [];

  // RE-ENABLE this section - Path Alias Plugin Handling
  // Remove the warning and uncomment the try/catch block
  if (ctx.tsConfig?.compilerOptions?.paths) {
    try {
      const pathAliasPlugin = resolvePathAliases(
        ctx.projectDir,
        ctx.sourceDir,
        ctx.tsConfig.compilerOptions.paths
      );
      plugins.push(pathAliasPlugin);
      if (ctx.isVerbose) {
        console.log("[TS] Path alias plugin enabled");
      }
    } catch (error) {
      reportError('Path alias plugin', error as Error, ctx.isVerbose);
    }
  }

  // --- HMR Notify Plugin ---
  plugins.push({
    name: 'ts-hmr-notify',
    setup(build) {
      build.onEnd(result => {
        console.log('[DEBUG TS onEnd] Triggered.'); // <-- Add Log
        console.log(`[DEBUG TS onEnd] Errors reported by esbuild: ${result.errors.length}`); // <-- Add Log
        // Optional: Log the actual errors
        // if (result.errors.length > 0) {
        //   console.log('[DEBUG TS onEnd] Errors:', JSON.stringify(result.errors, null, 2));
        // }

        if (!hmr) return;

        if (result.errors.length > 0) {
          console.log('[DEBUG TS onEnd] Calling reportError...'); // Your debug log
          // --->>> THIS LINE REPORTS ESBUILD ERRORS <<<---
          reportError('TypeScript build', result.errors.map(e => e.text).join('\n'), ctx.isVerbose);
        } else {
          // ... success logic ...
        }
      });
    }
  });

  // --- esbuild Context ---
  return esbuild.context({
    entryPoints: entryPoints, // Use the found entry points
    outdir: outdir,
    outbase: outbase,
    bundle: false,
    format: 'esm',
    platform: 'browser',
    target: target,
    sourcemap: 'external',
    logLevel: ctx.isVerbose ? 'info' : 'warning',
    write: true,
    metafile: true,
    plugins: plugins, // Pass the potentially empty plugins array
  });
}