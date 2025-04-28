import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { BuildContext } from '../types.js';
import { logFileCompilation, logSuccess, logError, logInfo, logWarning } from '../utils/console.js';

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

export async function setupScssProcessor(
  ctx: BuildContext,
  hmr: any,
  fileCount: { value: number }
): Promise<esbuild.BuildContext | null> {
  const { projectDir, sourceDir, outputDir, config, isVerbose } = ctx;
  
  try {
    const scssFiles = await glob('**/*.scss', { 
      cwd: path.join(projectDir, sourceDir),
      ignore: ['**/node_modules/**'],
      absolute: true,
    });
    
    // Filter out partials - they will be built when their main files are built
    const entryPoints = scssFiles.filter(file => !isPartial(file));
    fileCount.value = entryPoints.length;
    
    if (entryPoints.length === 0) {
      if (isVerbose) {
        logInfo('No SCSS files found to process');
      }
      return null;
    }
    
    // Set up autoprefixer with the config or defaults
    const postcssPlugins = [autoprefixer(), ...(config.postcssPlugins || [])];
    const postcssProcessor = postcss(postcssPlugins);
    
    // Create a map of entry points for esbuild
    const entryPointsMap: Record<string, string> = {};
    entryPoints.forEach(file => {
      const relativePath = path.relative(path.join(projectDir, sourceDir), file);
      const outputPath = relativePath.replace(/\.scss$/, '.css');
      entryPointsMap[outputPath] = file;
      
      if (isVerbose) {
        logFileCompilation('SCSS', relativePath);
      }
    });
    
    // Set up the esbuild context
    return await esbuild.context({
      entryPoints: entryPointsMap,
      outdir: path.join(projectDir, outputDir),
      bundle: false,
      sourcemap: true,
      plugins: [
        sassPlugin({
          ...config.sassOptions,
          async transform(source, resolveDir, filePath) {
            try {
              // Process with autoprefixer
              const result = await postcssProcessor.process(source, {
                from: filePath,
                to: filePath.replace(/\.scss$/, '.css'),
              });
              
              // Notify HMR if in watch mode and we have a file change
              if (ctx.watchMode && hmr) {
                const outputCssPath = filePath.replace(sourceDir, outputDir).replace(/\.scss$/, '.css');
                hmr.notifyClientOfChange(outputCssPath, 'css');
              }
              
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
  } catch (err) {
    logError('Failed to set up SCSS processor', err as Error);
    return null;
  }
}

// Handler for when a partial SCSS file changes
export async function handlePartialChange(ctx: BuildContext, hmr: any, filePath: string): Promise<void> {
  try {
    // Find all main files that depend on this partial
    const dependentFiles = await findDependentFiles(filePath, path.join(ctx.projectDir, ctx.sourceDir));
    
    if (dependentFiles.length === 0) {
      logInfo(`No dependent files found for partial: ${path.basename(filePath)}`);
      return;
    }
    
    logInfo(`Rebuilding ${dependentFiles.length} files that depend on ${path.basename(filePath)}`);
    
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
              ...ctx.config.sassOptions,
              async transform(source, resolveDir, filePath) {
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
          const outputCssPath = file.replace(ctx.sourceDir, ctx.outputDir).replace(/\.scss$/, '.css');
          hmr.notifyClientOfChange(outputCssPath, 'css');
        }
        
        logSuccess(`Rebuilt ${path.basename(file)}`);
      } catch (err) {
        logError(`Failed to rebuild ${path.basename(file)}`, err as Error);
      }
    }
  } catch (err) {
    logError(`Error handling partial change: ${filePath}`, err as Error);
  }
}