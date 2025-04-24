import * as esbuild from 'esbuild';
import * as P from 'path';
import * as fs from 'fs';
// Switch to a different plugin approach
import { sassPlugin } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types';
import { reportError, normalizePath } from '../utils'; // Import normalizePath from utils

export async function setupScssProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer,
  scssFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  const globPattern = `${ctx.sourceDir}/**/*.scss`;
  const entryPoints = (await glob(globPattern, { cwd: ctx.projectDir }))
    .filter(file => {
      const fullPath = P.join(ctx.projectDir, file);
      return fs.statSync(fullPath).isFile() && !P.basename(file).startsWith('_');
    });

  if (ctx.isVerbose) {
    console.log(`[SCSS] Found ${entryPoints.length} entry points`);
  }

  // Use in path operations:
  const outdir = normalizePath(P.join(ctx.projectDir, ctx.outputDir));
  const outbase = normalizePath(P.join(ctx.projectDir, ctx.sourceDir));

  return esbuild.context({
    entryPoints: entryPoints,
    outdir: outdir,
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
          });
        }
      }
    ],
  });
}