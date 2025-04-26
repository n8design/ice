import * as esbuild from 'esbuild';
import * as P from 'path';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { sassPlugin } from 'esbuild-sass-plugin';
import { BuildContext } from '../types.js';
import { reportError } from '../utils/index.js';
// --->>> IMPORT normalizePath <<<---
import { normalizePath, joinPosixPath, resolvePosixPath } from '../utils/path-utils.js';

export async function setupScssProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer | null, // Allow null hmr
  scssFilesCount: { value: number }
): Promise<esbuild.BuildContext> {

  // Glob for non-partial SCSS files
  const entryPointPattern = joinPosixPath(ctx.projectDir, ctx.sourceDir, '**/*.scss');
  console.log(`[SCSS Processor] Glob pattern: ${entryPointPattern}`);

  const allScssFiles = await glob(entryPointPattern, {
    ignore: ['node_modules/**'],
    absolute: true, // Use absolute paths
    nodir: true,
  });

  // --->>> DEFINE entryPoints by filtering out partials <<<---
  const entryPoints = allScssFiles.filter(file => !P.basename(file).startsWith('_'));

  console.log(`[SCSS Processor] Raw glob results (non-partials): ${JSON.stringify(entryPoints)}`);
  const normalizedEntryPoints = entryPoints.map(normalizePath); // Use imported normalizePath
  console.log(`[SCSS Processor] Normalized entry points for esbuild: ${JSON.stringify(normalizedEntryPoints)}`);

  if (normalizedEntryPoints.length === 0) {
    console.warn('[SCSS Processor] Warning: No SCSS entry points found.');
  }

  // Ensure outbase and outdir are absolute and normalized
  const outbase = normalizePath(P.resolve(ctx.projectDir, ctx.sourceDir)); // Use imported normalizePath
  const outdir = normalizePath(P.resolve(ctx.projectDir, ctx.outputDir, 'dist')); // Use imported normalizePath

  console.log(`[SCSS Processor] esbuild outDir: ${outdir}`);
  console.log(`[SCSS Processor] esbuild outBase: ${outbase}`);


  return esbuild.context({
    entryPoints: normalizedEntryPoints, // Use normalizedEntryPoints which uses normalizePath
    outdir: outdir,
    outbase: outbase,
    // ... rest of options ...
    plugins: [
      // ... ignore-image-urls plugin ...
      {
        name: 'ignore-image-urls',
        setup(build: esbuild.PluginBuild) {
          build.onResolve({ filter: /\.(png|jpg|jpeg|gif|svg|webp)($|\?)/ }, (args: esbuild.OnResolveArgs) => {
            if (ctx.isVerbose) {
              console.log(`[URL Resolver] Ignoring image reference: ${args.path}`);
            }
            return { path: args.path, external: true };
          });

          build.onResolve({ filter: /^\/images\// }, (args: esbuild.OnResolveArgs) => {
            if (ctx.isVerbose) {
              console.log(`[URL Resolver] Ignoring image path: ${args.path}`);
            }
            return { path: args.path, external: true };
          });
        }
      },
      sassPlugin({
        type: 'css',
        loadPaths: [normalizePath(P.join(ctx.projectDir, ctx.sourceDir))], // Use imported normalizePath
        ...ctx.config.sassOptions,
        sourceMap: true,
        sourceMapIncludeSources: true
      }),
      // ... scss-hmr-notify plugin ...
      {
        name: 'scss-hmr-notify',
        setup(build: esbuild.PluginBuild) {
          build.onEnd((result: esbuild.BuildResult) => {
            console.log('[DEBUG SCSS onEnd] Triggered.');
            console.log(`[DEBUG SCSS onEnd] Errors reported by esbuild: ${result.errors.length}`);
            console.log(`[DEBUG SCSS onEnd] Warnings reported by esbuild: ${result.warnings.length}`);

            if (!result.metafile) {
                console.log('[DEBUG SCSS onEnd] No metafile found.');
                return;
            }

            const outputCount = Object.keys(result.metafile.outputs).filter(f => f.endsWith('.css')).length;
            console.log(`[DEBUG SCSS onEnd] Metafile CSS output count: ${outputCount}`);
            scssFilesCount.value = outputCount;

            if (result.errors.length > 0) {
               console.log('[DEBUG SCSS onEnd] Errors detected, suppressing HMR.');
               return;
            }

            if (!hmr) return;

            // Simplified HMR logic for CSS
            Object.keys(result.metafile.outputs).forEach(outputFile => {
              if (outputFile.endsWith('.css')) {
                // Extract the original source file name if possible, or use output name
                const sourceFileName = P.basename(outputFile); // Simple basename
                hmr.notifyClients('css', sourceFileName);
              }
            });
          });
        }
      }
    ],
  });
}