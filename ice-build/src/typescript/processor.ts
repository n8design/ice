import * as esbuild from 'esbuild';
import * as P from 'path';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types.js';
import { resolvePathAliases } from './path-alias-plugin.js';
import { reportError } from '../utils/index.js';
import * as fs from 'fs';
import { normalizePath } from '../utils/path-utils.js'; // <--- Import normalizePath

export async function setupTsProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer | null, // Allow null hmr
  tsFilesCount: { value: number }
): Promise<esbuild.BuildContext> {

  // Use absolute paths for glob and normalize them
  const globPattern = normalizePath(P.join(ctx.projectDir, ctx.sourceDir, '**/*.{ts,tsx}'));
  console.log(`[TS Processor] Glob pattern: ${globPattern}`); // Keep this log

  const entryPoints = (await glob(globPattern, {
      ignore: ['node_modules/**', '**/*.d.ts'],
      absolute: true, // <--- Use absolute paths
      nodir: true,
    }))
    .map(normalizePath); // <--- Normalize results

  console.log(`[TS Processor] Found absolute entry points: ${JSON.stringify(entryPoints)}`);
  if (entryPoints.length === 0) {
      console.warn(`[TS Processor] Warning: No TS entry points found matching pattern.`);
  }

  // Ensure outbase and outdir are absolute and normalized
  const outbase = normalizePath(P.resolve(ctx.projectDir, ctx.sourceDir));
  // --->>> CHANGE THIS LINE <<<---
  const outdir = normalizePath(P.resolve(ctx.projectDir, ctx.outputDir, 'dist')); // Add 'dist'
  const target = ctx.tsConfig?.options?.target as string || 'es2020';

  console.log(`[TS Processor] esbuild outDir: ${outdir}`); // Log absolute paths
  console.log(`[TS Processor] esbuild outBase: ${outbase}`); // Log absolute paths

  const plugins: esbuild.Plugin[] = [];

  // Path Alias Plugin Handling
  if (ctx.tsConfig?.options?.paths) { // Assuming options exists
    try {
      const pathAliasPlugin = resolvePathAliases(
        ctx.projectDir, // Pass projectDir (used for resolving paths)
        outbase, // Pass absolute outbase (sourceDir)
        ctx.tsConfig.options.paths // Assuming options exists
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
    setup(build: esbuild.PluginBuild) { // Add type
      build.onEnd((result: esbuild.BuildResult) => { // Add type
        console.log('[DEBUG TS onEnd] Triggered.');
        console.log(`[DEBUG TS onEnd] Errors reported by esbuild: ${result.errors.length}`);
        console.log(`[DEBUG TS onEnd] Warnings reported by esbuild: ${result.warnings.length}`); // Log warnings

        // --->>> REINSTATE METAFILE LOGGING <<<---
        const outputCount = result.metafile ? Object.keys(result.metafile.outputs).filter(f => f.endsWith('.js')).length : 0; // Count only .js outputs
        console.log(`[DEBUG TS onEnd] Metafile JS output count: ${outputCount}`);
        tsFilesCount.value = outputCount; // Update count based on metafile

        if (!hmr) return;

        if (result.errors.length > 0) {
          console.log('[DEBUG TS onEnd] Calling reportError...');
          const errorMessages = result.errors.map((e: esbuild.Message) => e.text).join('\n'); // Add type
          reportError('TypeScript build', errorMessages, ctx.isVerbose);
        } else {
          console.log('[DEBUG TS onEnd] No errors, proceeding with HMR notify.');
          hmr.notifyClients('full', ''); // Assuming 'full' reload is desired
        }
      });
    }
  });

  plugins.push({
    name: 'ignore-scss-imports',
    setup(build: esbuild.PluginBuild) {
      // Mark .scss files as external so esbuild doesn't try to bundle them here
      build.onResolve({ filter: /\.scss$/ }, args => {
        if (ctx.isVerbose) {
          console.log(`[TS Processor] Ignoring SCSS import: ${args.path}`);
        }
        // Resolve the path relative to the importer, but mark as external
        return { path: args.path, external: true, namespace: 'ignore-scss' };
      });
    }
  });

  // --- esbuild Context ---
  return esbuild.context({
    entryPoints: entryPoints,
    outdir: outdir,           // Use updated outdir
    outbase: outbase,
    bundle: true,             // <--- SET BUNDLE TO TRUE
    format: 'esm',
    platform: 'browser',
    target: target,
    sourcemap: 'external',
    logLevel: ctx.isVerbose ? 'info' : 'warning',
    write: true,
    metafile: true,
    plugins: plugins,
  });
}