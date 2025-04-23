import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FSWatcher } from 'fs';
import { sassPlugin } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { glob } from 'glob';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types';
import { safeWriteFile, reportError } from '../utils';
import { isScssPartial, findScssFilesImporting } from './partial-detection';

// Track which files were changed to process only those
const changedScssFiles: Set<string> = new Set();

// Add a function to track file changes
export function trackScssChange(filePath: string): void {
  changedScssFiles.add(filePath);
}

export async function setupScssProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer,
  scssFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  // Create esbuild watcher for SCSS with custom file tracking
  const scssContext = await esbuild.context({
    entryPoints: (await glob(`${ctx.sourceDir}/**/*.scss`, { cwd: ctx.projectDir }))
      .filter(file => !path.basename(file).startsWith('_')),
    outdir: path.join(ctx.projectDir, ctx.outputDir),
    outbase: path.join(ctx.projectDir, ctx.sourceDir),
    bundle: true,
    logLevel: ctx.isVerbose ? 'info' : 'warning',
    sourcemap: true,
    plugins: [
      // Custom plugin to track which files triggered the rebuild
      {
        name: 'track-changed-files',
        setup(build) {
          build.onLoad({ filter: /\.scss$/ }, async (args) => {
            trackScssChange(args.path);
            return null; // continue with default loading
          });
        }
      },
      sassPlugin({
        loadPaths: [path.join(ctx.projectDir, ctx.sourceDir)],
        ...ctx.config.sassOptions,
        type: 'css',
      }),
      // Modify postcss-and-hmr plugin to only process changed files
      {
        name: 'postcss-and-hmr',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0) {
              console.error('SCSS build failed:', result.errors);
              return;
            }
            
            if (!result.outputFiles) {
              console.warn('No output files generated from SCSS build');
              return;
            }
            
            // Skip processing if no files were changed (e.g. initial build)
            if (changedScssFiles.size === 0) {
              // For initial build, process all files
              const isInitialBuild = scssFilesCount.value === 0;
              if (!isInitialBuild) {
                return; // Skip if this is a rebuild with no tracked changes
              }
            }
            
            // Get list of changed base files (non-partials that were changed directly)
            const changedBaseFiles = Array.from(changedScssFiles)
              .filter(file => !isScssPartial(file));
            
            // Get list of changed partials
            const changedPartials = Array.from(changedScssFiles)
              .filter(file => isScssPartial(file));
            
            console.log(`SCSS rebuild triggered by: ${
              changedBaseFiles.length > 0 
                ? changedBaseFiles.map(f => path.basename(f)).join(', ') 
                : 'none'
            }`);
            
            if (changedPartials.length > 0) {
              console.log(`Changed partials: ${changedPartials.map(f => path.basename(f)).join(', ')}`);
            }
            
            // Function to check if an output file is affected by the changes
            const isAffectedOutput = (outputFile: esbuild.OutputFile): boolean => {
              // Extract the source file name this output came from
              const publicDir = path.join(ctx.projectDir, ctx.outputDir);
              const relativePath = path.relative(publicDir, outputFile.path);
              const sourceBaseName = path.basename(relativePath, '.css') + '.scss';
              
              // Check if this came from a directly changed file
              if (changedBaseFiles.some(f => path.basename(f) === sourceBaseName)) {
                return true;
              }
              
              // If we had partial changes, we'll need to process all non-partial outputs
              // since we can't reliably trace which outputs used which partials without parsing
              if (changedPartials.length > 0) {
                return !path.basename(outputFile.path).startsWith('_');
              }
              
              // Initial build - process everything
              if (changedScssFiles.size === 0) {
                return true;
              }
              
              return false;
            };
            
            // Process only affected output files
            let processedCount = 0;
            
            for (const outputFile of result.outputFiles) {
              if (!outputFile.path.endsWith('.css')) continue;
              
              // Skip files generated from partials
              const outputBasename = path.basename(outputFile.path);
              if (outputBasename.startsWith('_')) {
                continue;
              }
              
              // Skip files not affected by the changes
              if (!isAffectedOutput(outputFile)) {
                continue;
              }
              
              processedCount++;
              
              try {
                // The rest of the processing remains the same
                // Create properly normalized source path for PostCSS
                const sourceDirPath = path.join(ctx.projectDir, ctx.sourceDir);
                const publicDir = path.join(ctx.projectDir, ctx.outputDir);
                
                // Convert output path back to source path
                const relativePath = path.relative(publicDir, outputFile.path);
                const sourcePath = path.join(
                  sourceDirPath, 
                  relativePath.replace(/\.css$/, '.scss')
                );
                
                // Get the configured PostCSS plugins
                const postcssPlugins = ctx.config.postcssPlugins || [autoprefixer];
                
                // Process with PostCSS
                const css = await postcss(postcssPlugins).process(outputFile.text, {
                  from: sourcePath,
                  to: outputFile.path,
                  map: { inline: false }
                });
                
                // Write processed CSS and sourcemap
                await safeWriteFile(outputFile.path, css.css, ctx.projectDir, ctx.isVerbose);
                if (css.map) {
                  await safeWriteFile(
                    `${outputFile.path}.map`, 
                    css.map.toString(), 
                    ctx.projectDir, 
                    ctx.isVerbose
                  );
                }
                
                // Send HMR notification with properly normalized path
                const hmrPath = path.relative(publicDir, outputFile.path)
                  .replace(/\\/g, '/'); // Normalize path separators for URLs
                
                hmr.notifyClients('css', hmrPath);
                console.log(`[${new Date().toLocaleTimeString()}] 📤 CSS update: ${hmrPath}`);
                
                // Increment processed file counter
                scssFilesCount.value++;
              } catch (error) {
                reportError(`PostCSS (${path.basename(outputFile.path)})`, error as Error, ctx.isVerbose);
              }
            }
            
            // Reset the change tracking for the next build
            changedScssFiles.clear();
            
            console.log(`Processed ${processedCount} affected CSS files`);
          });
        }
      }
    ],
    write: false,
  });

  return scssContext;
}

// Handle SCSS partial changes
export async function handleScssPartialChange(
  partialPath: string, 
  ctx: BuildContext,
  scssContext: esbuild.BuildContext
): Promise<void> {
  console.log(`Partial changed: ${path.basename(partialPath)}`);
  // Find files that might import this partial
  const affectedFiles = await findScssFilesImporting(partialPath, ctx.projectDir, ctx.sourceDir);
  
  if (affectedFiles.length > 0) {
    console.log(`Found ${affectedFiles.length} files that import this partial`);
    // Track these files to rebuild
    affectedFiles.forEach(file => trackScssChange(file));
    // Add the partial itself
    trackScssChange(partialPath);
    // Trigger rebuild
    await scssContext.rebuild();
  } else {
    console.log(`No files found that import this partial`);
  }
}

// Setup file watcher for SCSS partials
export async function setupScssWatcher(
  ctx: BuildContext, 
  scssContext: esbuild.BuildContext
): Promise<FSWatcher | null> {
  if (!ctx.watchMode) return null;
  
  // Setup a separate watcher for SCSS partials
  const { watch } = await import('node:fs');
  
  // Watch the source directory for SCSS changes
  const sourceDirPath = path.join(ctx.projectDir, ctx.sourceDir);
  
  // Use a filesystem watcher to catch partial changes
  const fsWatcher = watch(sourceDirPath, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.scss')) return;
    
    const filePath = path.join(sourceDirPath, filename);
    
    // If it's a partial, handle it specially
    if (isScssPartial(filePath)) {
      await handleScssPartialChange(filePath, ctx, scssContext);
    }
    // Regular SCSS files are handled by esbuild watcher
  });
  
  return fsWatcher;
}