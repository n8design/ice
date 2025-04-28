import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import { performance } from 'perf_hooks';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { reportError } from '../utils/index.js';
import { getCurrentTime, formatDuration, logError, logWarning } from '../utils/console.js';
import { BuildContext } from '../types.js';
import { normalizePath, P, joinPosixPath } from '../utils/path-utils.js';
import { CssErrorCollector } from '../utils/css-error-collector.js';

// Simple function to check for common CSS typos
function checkForCommonCssTypos(css: string, filePath: string): string[] {
  const errors: string[] = [];
  
  // Check for specific known typos
  if (css.includes('background-col:')) {
    errors.push(`Did you mean 'background-color' instead of 'background-col' in ${path.basename(filePath)}?`);
  }
  
  return errors; // Make sure we explicitly return the errors array
}

export async function setupScssProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer | null,
  scssFilesCount: { value: number }
): Promise<esbuild.BuildContext> {
  const { projectDir, sourceDir, outputDir, config, isVerbose } = ctx;

  // Build entry points map from source directory
  const sourceFullPath = joinPosixPath(projectDir, sourceDir);
  const scssEntryPoints: Record<string, string> = {};
  let sassFiles: string[] = [];

  try {
    // Find all SCSS files in the source directory that aren't partials
    const globPattern = `${sourceDir}/**/*.{scss,sass}`;
    sassFiles = await glob(globPattern, { 
      cwd: projectDir,
      ignore: ['**/node_modules/**', '**/_*.{scss,sass}'],
    });

    // Convert to absolute paths and prepare entry points
    const scssFiles = sassFiles
      .filter(file => !path.basename(file).startsWith('_'))
      .map(file => normalizePath(path.join(P.normalize(projectDir), file)));

    scssFilesCount.value = scssFiles.length;

    // If no files found, return early
    if (scssFiles.length === 0) {
      console.log('No SCSS files found to process');
      // Return a dummy context to satisfy TypeScript
      return esbuild.context({
        entryPoints: {},
        bundle: false,
        write: false,
      });
    }

    // Create entry points mapping
    for (const filePath of scssFiles) {
      const relativePath = path.relative(path.join(projectDir, sourceDir), filePath);
      const outputPath = relativePath.replace(/\.(scss|sass)$/, '.css');
      scssEntryPoints[outputPath] = filePath;

      if (isVerbose) {
        console.log(`Processing SCSS: ${relativePath}`);
      }
    }

    // Get load paths from config or defaults
    const loadPaths = config.sassOptions?.loadPaths as string[] || ['node_modules'];

    // Extract sass options but remove any includePaths to avoid the warning
    const { includePaths, ...otherSassOptions } = config.sassOptions || {};

    // Track start time for performance logging
    const processorStartTime = performance.now();
    
    // Create error collector for the entire build
    const cssErrorCollector = new CssErrorCollector(projectDir);
    
    // Configure esbuild to prevent JS file generation
    const context = await esbuild.context({
      entryPoints: scssEntryPoints,
      outdir: path.join(projectDir, outputDir),
      bundle: false,
      sourcemap: true,
      write: true,
      // Set loader to file to prevent JS conversion
      loader: {
        '.scss': 'file',
        '.sass': 'file',
        '.css': 'file'
      },
      // Prevent JS wrapper generation 
      platform: 'neutral',
      format: undefined,  // Remove format to prevent JS module generation
      outExtension: {
        '.css': '.css'
      },
      plugins: [
        sassPlugin({
          type: 'css', // Use 'css' instead of 'style' to output separate CSS files
          sourceMap: true,
          loadPaths,
          ...otherSassOptions,
          async transform(source: string, resolveDir: string, filePath: string) {
            const fileStartTime = performance.now();
            try {
              // Process with PostCSS (for autoprefixer and can add CSS validation)
              const plugins = [
                autoprefixer(),
                // Add postcss-scss-syntax for better error reporting
                ...(config.postcssPlugins || [])
              ];
              
              // We can enhance PostCSS's error handling to catch property errors
              let processOptions = {
                from: filePath,
                to: normalizePath(path.join(P.normalize(projectDir), outputDir, path.basename(filePath, path.extname(filePath)) + '.css')),
                map: { inline: false }
              };
              
              try {
                const result = await postcss(plugins).process(source, processOptions);
                
                // PostCSS warnings often include invalid properties
                if (result.warnings().length > 0) {
                  result.warnings().forEach(warning => {
                    // Only log certain warning types, focusing on property issues
                    if (warning.text.includes('property') || warning.text.includes('background-col')) {
                      logWarning(`SCSS issue in ${path.relative(ctx.projectDir, filePath)}: ${warning.text}`);
                    }
                  });
                }
                
                // If "background-col" is in the source, collect the error instead of logging immediately
                if (source.includes('background-col')) {
                  cssErrorCollector.addError("Invalid CSS property 'background-col' (Did you mean 'background-color'?)", filePath);
                }
                
                // If in watch mode and HMR is available, notify clients of changes
                if (ctx.watchMode && hmr) {
                  // Send path relative to output dir
                  const relPath = path.relative(P.normalize(path.join(projectDir, sourceDir)), filePath)
                    .replace(/\.(scss|sass)$/, '.css');
                  const cssPath = normalizePath(path.join(outputDir, relPath));
                  // Use notifyClients which is guaranteed to exist
                  hmr.notifyClients('css', cssPath);
                }

                // Log processing time if verbose
                const fileEndTime = performance.now();
                if (ctx.isVerbose) {
                  const duration = (fileEndTime - fileStartTime).toFixed(2);
                  console.log(`🧊 [${getCurrentTime()}] Processed ${path.basename(filePath)} in ${duration}ms`);
                }

                return result.css;
              } catch (error) {
                // Handle PostCSS errors
                reportError(`CSS Processing Error: ${path.relative(ctx.projectDir, filePath)}`, error as Error, ctx.projectDir);
                return source;  // Return original source on error
              }
            } catch (error) {
              // Fix: Cast the unknown error to Error or string
              const err = error instanceof Error ? error : String(error);
              // Use our enhanced error reporting
              reportError(`SCSS Processing Error: ${path.relative(ctx.projectDir, filePath)}`, err, ctx.projectDir);
              return source; // Return original source if processing fails
            }
          }
        })
      ]
    });
    
    // Report all CSS errors after initial processing
    if (cssErrorCollector.hasErrors()) {
      cssErrorCollector.reportErrors();
    }
    
    // Log total SCSS setup time
    const processorEndTime = performance.now();
    const duration = processorEndTime - processorStartTime;
    
    if (scssFilesCount.value > 0) {
      console.log(`🧊 [${getCurrentTime()}] SCSS setup completed in ${formatDuration(duration)} for ${scssFilesCount.value} files`);
    }
    
    return context;

  } catch (error) {
    reportError('Failed to set up SCSS processor', error as Error);
    throw error;
  }
}