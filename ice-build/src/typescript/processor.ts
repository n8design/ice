import * as esbuild from 'esbuild';
import * as P from 'path';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types';
import { resolvePathAliases } from './path-alias-plugin';
import { reportError, normalizePath } from '../utils'; // Import normalizePath from utils
import * as fs from 'fs';
import * as url from 'url';

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

  const outbase = normalizePath(P.join(ctx.projectDir, ctx.sourceDir));
  const outdir = normalizePath(P.join(ctx.projectDir, ctx.outputDir));
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
    setup(build: esbuild.PluginBuild) {
      build.onEnd(async (result: esbuild.BuildResult) => {
        if (!hmr) return; // Don't run HMR logic if not in watch mode
        if (result.errors.length > 0) return;
        if (!result.metafile) {
          console.warn('TS build finished, but metafile is missing for HMR.');
          return;
        }

        let processedCount = 0;
        for (const outputPath in result.metafile.outputs) {
          if (!outputPath.endsWith('.js')) continue;
          processedCount++;
          try {
            const hmrPath = P.relative(outdir, outputPath).replace(/\\/g, '/');
            hmr.notifyClients('full', hmrPath); // Use the imported hmr instance
            console.log(`[${new Date().toLocaleTimeString()}] 🔄 JS update: ${hmrPath}`);
            tsFilesCount.value++;
          } catch (error) {
            reportError(`TS HMR (${P.basename(outputPath)})`, error as Error, ctx.isVerbose);
          }
        }
        if (processedCount > 0 && ctx.isVerbose) {
          console.log(`Notified HMR for ${processedCount} JS files.`);
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