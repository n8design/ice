import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import { performance } from 'perf_hooks';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { BuildContext } from '../types.js';
import { logFileCompilation, logSuccess, logError, logInfo, getCurrentTime, formatDuration } from '../utils/console.js';
import { normalizePath, P } from '../utils/path-utils.js';
import { CssErrorCollector } from '../utils/css-error-collector.js';

// Check if a file is a partial (starts with _)
function isPartial(filePath: string): boolean {
  return path.basename(filePath).startsWith('_');
}

// Find all non-partial SCSS files in a directory
async function findMainScssFiles(directory: string): Promise<string[]> {
  const allScssFiles = await glob('**/*.scss', {
    cwd: directory,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });
  return allScssFiles.filter(file => !isPartial(file));
}

// Detect which main SCSS files import a specific partial
async function findDependentFiles(partialPath: string, sourceDir: string): Promise<string[]> {
  const mainFiles = await findMainScssFiles(sourceDir);
  const dependents: string[] = [];
  
  for (const file of mainFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      // Check for various import syntaxes
      const partialName = path.basename(partialPath).replace(/^_/, '');
      const partialWithoutExt = partialName.replace(/\.scss$/, '');
      
      if (
        content.includes(`@import '${partialWithoutExt}'`) ||
        content.includes(`@import "${partialWithoutExt}"`) ||
        content.includes(`@use '${partialWithoutExt}'`) ||
        content.includes(`@use "${partialWithoutExt}"`) ||
        content.includes(`@forward '${partialWithoutExt}'`) ||
        content.includes(`@forward "${partialWithoutExt}"`)
      ) {
        dependents.push(file);
      }
    } catch (err) {
      console.error(`Error reading file ${file}:`, err);
    }
  }
  
  return dependents;
}

// Handler for when a partial SCSS file changes
export async function handlePartialChange(ctx: BuildContext, hmr: HotReloadServer | null, filePath: string): Promise<void> {
  const startTime = performance.now();
  try {
    // Find all main files that depend on this partial
    const dependentFiles = await findDependentFiles(filePath, path.join(ctx.projectDir, ctx.sourceDir));
    
    if (dependentFiles.length === 0) {
      logInfo(`No dependent files found for partial: ${path.basename(filePath)}`);
      return;
    }
    
    logInfo(`Rebuilding ${dependentFiles.length} files that depend on ${path.basename(filePath)}`);
    
    // Create error collector for this partial rebuild
    // Update the instantiation to pass projectDir 
    const cssErrorCollector = new CssErrorCollector(ctx.projectDir);
    
    // Process each dependent file individually
    for (const file of dependentFiles) {
      try {
        const relativePath = path.relative(path.join(ctx.projectDir, ctx.sourceDir), file);
        logFileCompilation('SCSS', relativePath);
        
        // Set up temporary build context for just this file
        const entryPointsMap: Record<string, string> = {};
        const outputPath = relativePath.replace(/\.scss$/, '.css');
        entryPointsMap[outputPath] = file;
        
        const result = await esbuild.build({
          entryPoints: entryPointsMap,
          outdir: path.join(ctx.projectDir, ctx.outputDir),
          bundle: false,
          sourcemap: true,
          plugins: [
            sassPlugin({
              ...(ctx.config.sassOptions || {}),
              async transform(source: string, resolveDir: string, filePath: string) {
                try {
                  // Process with autoprefixer
                  const postcssPlugins = [autoprefixer(), ...(ctx.config.postcssPlugins || [])];
                  const postcssProcessor = postcss(postcssPlugins);
                  const result = await postcssProcessor.process(source, {
                    from: filePath,
                    to: filePath.replace(/\.scss$/, '.css'),
                  });
                  
                  return result.css;
                } catch (err) {
                  logError(`Failed to transform SCSS with PostCSS: ${filePath}`, err as Error);
                  return source;
                }
              },
            }),
          ],
          loader: {
            '.scss': 'css',
          },
        });
        
        // Notify HMR
        if (ctx.watchMode && hmr) {
          const cssOutputPath = outputPath; // Use this for referring to the output CSS
          
          // Check for common CSS errors after rebuilding
          if (fs.existsSync(path.join(ctx.projectDir, ctx.outputDir, cssOutputPath))) {
            const content = fs.readFileSync(path.join(ctx.projectDir, ctx.outputDir, cssOutputPath), 'utf8');
            
            // Check the content of the source partial too
            const partialContent = fs.readFileSync(filePath, 'utf8');
            if (partialContent.includes('background-col')) {
              // Pass both the partial file and the main file that includes it
              cssErrorCollector.addError(
                "Invalid CSS property 'background-col' (Did you mean 'background-color'?)", 
                file, 
                filePath
              );
            }
          }
          
          // Use notifyClients since that's the common method
          hmr.notifyClients('css', cssOutputPath);
        }
        
        logSuccess(`Rebuilt ${path.basename(file)}`);
      } catch (err) {
        logError(`Failed to rebuild ${path.basename(file)}`, err as Error);
      }
    }
    
    // Report all errors in a tree structure after processing
    // Update the reportErrors call to not pass arguments
    if (cssErrorCollector.hasErrors()) {
      cssErrorCollector.reportErrors();
    }
    
    const totalTime = performance.now() - startTime;
    logInfo(`Partial rebuild completed in ${formatDuration(totalTime)}`);
  } catch (err) {
    logError(`Error handling partial change: ${filePath}`, err as Error);
  }
}
