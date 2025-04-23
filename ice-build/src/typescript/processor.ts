import * as esbuild from 'esbuild';
import * as P from 'path';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types';
// Temporarily comment out the import to test the build without it
// import { resolvePathAliases } from './path-alias-plugin';
import { reportError } from '../utils';
import * as fs from 'fs';

export async function setupTsProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer,
  tsFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  const globPattern = `${ctx.sourceDir}/**/*.ts`;
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

  // --- Path Alias Plugin Handling (Temporarily Disabled) ---
  console.warn("Path alias plugin temporarily disabled for testing."); // Add a warning
  /*
  try {
    // This assumes the import worked if we reach here without crashing
    if (typeof resolvePathAliases === 'function') {
       if (ctx.tsConfig?.compilerOptions?.paths) {
         plugins.push(resolvePathAliases(ctx.tsConfig, ctx.projectDir));
         if (ctx.isVerbose) console.log("Path alias plugin enabled.");
       } else {
         if (ctx.isVerbose) console.log("Path alias plugin: No paths found in tsconfig.json.");
       }
    } else {
        console.warn("Path alias plugin: 'resolvePathAliases' function not found after import.");
    }
  } catch (e) {
      console.error(`\n---`);
      console.error(`⚠️ Error: Could not load the path alias plugin ('./path-alias-plugin').`);
      // ... rest of error message ...
      console.error(`---\n`);
  }
  */

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