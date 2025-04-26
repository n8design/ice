import * as esbuild from 'esbuild';
import * as P from 'path';
import * as fs from 'fs';
// Switch to a different plugin approach
import { sassPlugin } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types.js'; // Add .js
import { reportError } from '../utils/index.js'; // Add .js (assuming index.js exists in utils)

export async function setupScssProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer,
  scssFilesCount: { value: number }
): Promise<esbuild.BuildContext> {

  // ... (glob logic remains the same) ...

  // Ensure outbase and outdir are absolute and normalized
  const outbase = normalizePath(P.resolve(ctx.projectDir, ctx.sourceDir));
  // --->>> CHANGE THIS LINE <<<---
  const outdir = normalizePath(P.resolve(ctx.projectDir, ctx.outputDir, 'dist')); // Add 'dist'

  console.log(`[SCSS Processor] esbuild outDir: ${outdir}`); // Log absolute paths
  console.log(`[SCSS Processor] esbuild outBase: ${outbase}`); // Log absolute paths


  return esbuild.context({
    entryPoints: entryPoints.map(normalizePath), // Ensure entry points are normalized here too
    outdir: outdir,           // Use updated outdir
    outbase: outbase,
    bundle: true,
    logLevel: ctx.isVerbose ? 'info' : 'warning',
    sourcemap: 'external',
    write: true,
    metafile: true,
    plugins: [
      // Add a custom URL resolver plugin BEFORE sass processing
      {
        name: 'ignore-image-urls',
        setup(build) {
          // This runs before sass processing to handle URL patterns
          build.onResolve({ filter: /\.(png|jpg|jpeg|gif|svg|webp)($|\?)/ }, (args) => {
            if (ctx.isVerbose) {
              console.log(`[URL Resolver] Ignoring image reference: ${args.path}`);
            }
            // Return a path that will be ignored
            return { path: args.path, external: true };
          });
          
          // Also catch /images/ paths specifically
          build.onResolve({ filter: /^\/images\// }, (args) => {
            if (ctx.isVerbose) {
              console.log(`[URL Resolver] Ignoring image path: ${args.path}`);
            }
            return { path: args.path, external: true };
          });
        }
      },
      
      // Then the sass plugin with minimal options
      sassPlugin({
        type: 'css',
        loadPaths: [P.join(ctx.projectDir, ctx.sourceDir)],
        ...ctx.config.sassOptions,
        sourceMap: true,
        sourceMapIncludeSources: true
      }),
      
      // HMR notify plugin remains the same
      {
        name: 'scss-hmr-notify',
        setup(build) {
          build.onEnd(result => {
            console.log('[DEBUG SCSS onEnd] Triggered.'); // <-- Add Log
            console.log(`[DEBUG SCSS onEnd] Errors reported by esbuild: ${result.errors.length}`); // <-- Add Log
            // Optional: Log the actual errors
            // if (result.errors.length > 0) {
            //   console.log('[DEBUG SCSS onEnd] Errors:', JSON.stringify(result.errors, null, 2));
            // }

            // Explicitly check for errors here too for robustness
            if (result.errors.length > 0) {
               console.log('[DEBUG SCSS onEnd] Errors detected, suppressing HMR.'); // <-- Add Log
               // Optionally call reportError here as well if esbuild logLevel isn't sufficient
               // reportError('SCSS build', result.errors.map(e => e.text).join('\n'), ctx.isVerbose);
               return; // Prevent HMR notification on error
            }

            if (!hmr || !result.metafile) return;
            
            const publicDir = P.join(ctx.projectDir, ctx.outputDir);
            let count = 0;
            
            for (const outputPath in result.metafile.outputs) {
              if (!outputPath.endsWith('.css')) continue;
              count++;
              scssFilesCount.value++;
              
              if (hmr) {
                try {
                  const hmrPath = P.relative(publicDir, outputPath).replace(/\\/g, '/');
                  hmr.notifyClients('css', hmrPath);
                  console.log(`[${new Date().toLocaleTimeString()}] 📤 CSS update: ${hmrPath}`);
                } catch (e) {
                  console.error('Error sending HMR update:', e);
                }
              }
            }
            console.log('[DEBUG SCSS onEnd] No errors, proceeding with HMR notify.'); // <-- Add Log
          });
        }
      }
    ],
  });
}