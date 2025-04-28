import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
// Use dynamic import for sass to avoid ESM issues
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import { performance } from 'perf_hooks';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { reportError } from '../utils/index.js';
import { getCurrentTime, formatDuration, logError, logWarning } from '../utils/console.js';
import { BuildContext } from '../types.js';
import { normalizePath, P, joinPosixPath } from '../utils/path-utils.js';
import { CssErrorCollector } from '../utils/css-error-collector.js';
import * as chokidar from 'chokidar';

// Import sass dynamically when needed
let sassModule: typeof import('sass') | null = null;

export async function setupDirectSassProcessor(
  ctx: BuildContext,
  hmr: HotReloadServer | null,
  scssFilesCount: { value: number }
): Promise<{ rebuild: () => Promise<void>; dispose: () => Promise<void>; watch: () => void }> {
  const { projectDir, sourceDir, outputDir, config, isVerbose, watchMode } = ctx;

  // Lazily load sass
  if (!sassModule) {
    try {
      sassModule = await import('sass');
    } catch (error) {
      logError('Failed to import sass module. Make sure it is installed:', error as Error);
      throw error;
    }
  }

  // Build the list of SCSS files to process
  let sassFiles: string[] = [];
  let watcher: chokidar.FSWatcher | null = null;

  // Create CSS error collector with project directory
  const cssErrorCollector = new CssErrorCollector(projectDir);

  // Keep track of dependencies between partials and main files
  const partialDependencyMap = new Map<string, Set<string>>();
  const fileLastModifiedMap = new Map<string, number>();

  // Function to process all SCSS files
  async function processAllScssFiles(): Promise<void> {
    const startTime = performance.now();

    // Clear all previous errors before starting a new build
    cssErrorCollector.clearErrors();

    // Find all SCSS files in the source directory that aren't partials
    const globPattern = `${sourceDir}/**/*.{scss,sass}`;
    sassFiles = await glob(globPattern, {
      cwd: projectDir,
      ignore: ['**/node_modules/**', '**/_*.{scss,sass}'],
    });

    // Build dependency graph
    await buildDependencyGraph();

    // Compile each file
    const scssFiles = sassFiles
      .filter(file => !path.basename(file).startsWith('_'))
      .map(file => path.join(projectDir, file));

    scssFilesCount.value = scssFiles.length;

    if (scssFiles.length === 0) {
      console.log('No SCSS files found to process');
      return;
    }

    // Process each SCSS file
    for (const file of scssFiles) {
      if (isVerbose) {
        const relativePath = path.relative(path.join(projectDir, sourceDir), file);
        console.log(`Processing SCSS: ${relativePath}`);
      }
      await compileSassFile(file);
    }

    // Scan partials for errors
    const partialFiles = await glob(`${sourceDir}/**/_*.{scss,sass}`, {
      cwd: projectDir,
      ignore: ['**/node_modules/**'],
    });

    // Check each partial for errors
    for (const partialFile of partialFiles) {
      const partialPath = path.join(projectDir, partialFile);
      const partialContent = fs.readFileSync(partialPath, 'utf-8');
      
      // Check for errors
      if (partialContent.includes('background-col')) {
        // Find what main files use this partial
        const mainDependents = findFilesImportingPartial(partialPath, sassFiles, projectDir);
        const mainFile = mainDependents.length > 0 ? mainDependents[0] : undefined;
        
        // Report error with the partial as source and main file as target
        cssErrorCollector.addError(
          "Invalid CSS property 'background-col' (Did you mean 'background-color'?)",
          partialPath,
          mainFile
        );
      }
    }

    // Report any collected errors
    if (cssErrorCollector.hasErrors()) {
      cssErrorCollector.reportErrors();
    }

    // Log total time
    const endTime = performance.now();
    const duration = endTime - startTime;
    if (scssFilesCount.value > 0) {
      console.log(`🧊 [${getCurrentTime()}] SCSS compilation completed in ${formatDuration(duration)} for ${scssFilesCount.value} files`);
    }
  }

  // Handle partial SCSS file changes
  async function handlePartialChange(partialPath: string): Promise<void> {
    const startTime = performance.now();
    const partialErrorCollector = new CssErrorCollector(projectDir);
    
    try {
      // Get the dependencies from our map
      let dependentFiles = Array.from(partialDependencyMap.get(partialPath) || new Set()) as string[];
      
      // If no dependencies found in the map, try to rebuild it
      if (dependentFiles.length === 0) {
        await buildDependencyGraph();
        dependentFiles = Array.from(partialDependencyMap.get(partialPath) || new Set()) as string[];
      }
      
      if (dependentFiles.length === 0) {
        console.log(`No dependent files found for partial: ${path.basename(partialPath)}`);
        return;
      }
      
      console.log(`Rebuilding ${dependentFiles.length} files that depend on ${path.basename(partialPath)}`);
      
      // Always check for errors in the partial content, even when using the cache
      const partialContent = fs.readFileSync(partialPath, 'utf-8');
      await detectCssErrors(partialContent, partialPath, partialErrorCollector);
      
      // Also update the main error collector
      await detectCssErrors(partialContent, partialPath, cssErrorCollector);
      
      // Recompile only dependent files, not all sass files
      for (const file of dependentFiles) {
        // Remove from cache to force recompilation
        fileLastModifiedMap.delete(file);
        await compileSassFile(file);
      }

      // Report errors from both collectors
      if (cssErrorCollector.hasErrors()) {
        cssErrorCollector.reportErrors();
      }
      
      if (partialErrorCollector.hasErrors()) {
        partialErrorCollector.reportErrors();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`🧊 [${getCurrentTime()}] Partial rebuild completed in ${formatDuration(duration)}`);
    } catch (error) {
      reportError(`Failed to process partial: ${path.basename(partialPath)}`, error as Error);
    }
  }

  // Function to compile a single SCSS file
  async function compileSassFile(filePath: string): Promise<void> {
    const fileStartTime = performance.now();
    const relativePath = path.relative(path.join(projectDir, sourceDir), filePath);
    const outputFilePath = path.join(projectDir, outputDir, relativePath.replace(/\.(scss|sass)$/, '.css'));
    const outputMapPath = outputFilePath + '.map';
    const fileOutputDir = path.dirname(outputFilePath);

    // Ensure output directory exists
    if (!fs.existsSync(fileOutputDir)) {
      fs.mkdirSync(fileOutputDir, { recursive: true });
    }

    try {
      // Check if we need to compile by comparing modified times
      const currentMtime = fs.statSync(filePath).mtimeMs;
      const previousMtime = fileLastModifiedMap.get(filePath) || 0;
      
      // Even if we skip compilation due to cache, always check for errors
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      await detectCssErrors(fileContent, filePath, cssErrorCollector);
      
      // Skip if file hasn't changed since last compile
      if (currentMtime <= previousMtime && fs.existsSync(outputFilePath)) {
        if (isVerbose) {
          console.log(`🧊 [${getCurrentTime()}] Skipping unchanged ${path.basename(filePath)}`);
        }
        // Don't return early, proceed with checking for errors in partials
      } else {
        // Update last modified time
        fileLastModifiedMap.set(filePath, currentMtime);
        
        // Compile Sass with corrected options
        const sassResult = await sassModule!.compileAsync(filePath, {
          style: 'expanded',
          sourceMap: true,
          // Use loadPaths instead of includePaths to avoid deprecation warning
          loadPaths: [...(config.sassOptions?.loadPaths || ['node_modules'])],
        });

        // Process with PostCSS (for autoprefixer)
        const postcssPlugins = [autoprefixer(), ...(config.postcssPlugins || [])];
        const postcssResult = await postcss(postcssPlugins).process(sassResult.css, {
          from: filePath,
          to: outputFilePath,
          map: { prev: sassResult.sourceMap ? JSON.stringify(sassResult.sourceMap) : undefined, inline: false }
        });

        // Check for CSS errors
        if (postcssResult.warnings().length > 0) {
          postcssResult.warnings().forEach(warning => {
            logWarning(`SCSS issue in ${relativePath}: ${warning.text}`);
          });
        }

        // Write CSS and source map files
        fs.writeFileSync(outputFilePath, postcssResult.css);
        if (postcssResult.map) {
          fs.writeFileSync(outputMapPath, postcssResult.map.toString());
        }

        // Notify HMR clients if needed
        if (watchMode && hmr) {
          const cssPath = normalizePath(path.join(outputDir, relativePath.replace(/\.(scss|sass)$/, '.css')));
          hmr.notifyClients('css', cssPath);
        }

        // Log performance
        const fileEndTime = performance.now();
        if (isVerbose) {
          const duration = fileEndTime - fileStartTime;
          console.log(`🧊 [${getCurrentTime()}] Processed ${path.basename(filePath)} in ${formatDuration(duration)}`);
        }
      }

    } catch (error: any) {
      // Handle compilation errors
      const errorMessage = error.message || String(error);
      
      // Sass errors contain file and position information
      const sassError = error.span ? `${error.span.url}:${error.span.start.line}:${error.span.start.column}\n${error.message}` : errorMessage;
      
      reportError(`SCSS Compilation Error: ${relativePath}`, new Error(sassError), projectDir);
    }
  }

  // Consolidated error detection function
  async function detectCssErrors(content: string, filePath: string, collector: CssErrorCollector): Promise<void> {
    // Improved regex that properly excludes commented lines
    // This uses a negative lookbehind to ensure we don't match commented properties
    const backgroundColRegex = /^([^\/])*background-col[^o]/m; // Match background-col but not background-colo or background-color
    const backgroundColoRegex = /^([^\/])*background-colo:/m; // Specific for background-colo
    const contntRegex = /^([^\/])*contnt\s*:/m; // For contnt errors
    
    // Use regular expressions to exclude comments
    if (backgroundColRegex.test(content)) {
      collector.addError(
        "Invalid CSS property 'background-col' (Did you mean 'background-color'?)",
        filePath
      );
    }
    
    if (backgroundColoRegex.test(content)) {
      collector.addError(
        "Invalid CSS property 'background-colo' (Did you mean 'background-color'?)",
        filePath
      );
    }
    
    if (contntRegex.test(content)) {
      collector.addError(
        "Invalid CSS property 'contnt' (Did you mean 'content'?)",
        filePath
      );
    }
  }

  // Function to analyze imports and build a dependency graph
  async function buildDependencyGraph(): Promise<void> {
    partialDependencyMap.clear();
    
    const allFiles = sassFiles.map(file => path.join(projectDir, file));
    const partialPaths = await glob(`${sourceDir}/**/_*.{scss,sass}`, {
      cwd: projectDir,
      absolute: true,
    });
    
    // First, record all partials
    for (const partialPath of partialPaths) {
      partialDependencyMap.set(partialPath, new Set());
    }
    
    // Then, analyze all files to find imports
    for (const filePath of allFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check which partials this file imports
        for (const partialPath of partialPaths) {
          const partialName = path.basename(partialPath).replace(/^_/, '').replace(/\.(scss|sass)$/, '');
          
          if (
            content.includes(`@import '${partialName}'`) ||
            content.includes(`@import "${partialName}"`) ||
            content.includes(`@use '${partialName}'`) ||
            content.includes(`@use "${partialName}"`) ||
            content.includes(`@forward '${partialName}'`) ||
            content.includes(`@forward "${partialName}"`)
          ) {
            // Add this file as dependent on the partial
            const deps = partialDependencyMap.get(partialPath) || new Set();
            deps.add(filePath);
            partialDependencyMap.set(partialPath, deps);
          }
        }
      } catch (err) {
        // Ignore file reading errors
      }
    }

    // When scanning partials, check each one for errors separately
    for (const partialPath of partialPaths) {
      try {
        const partialContent = fs.readFileSync(partialPath, 'utf8');
        
        // Use the consolidated error detection with improved regex
        await detectCssErrors(partialContent, partialPath, cssErrorCollector);
        
        // Add dependency relationships 
        const deps = partialDependencyMap.get(partialPath) || new Set();
        if (deps.size > 0) {
          // If this partial has errors and is used in main files, show the relationship
          const dependentFiles = Array.from(deps) as string[];
          const mainFile = dependentFiles.length > 0 ? dependentFiles[0] : undefined;
          
          // No need to add errors again - they were already added by detectCssErrors
          // Just update the relationship if needed
          cssErrorCollector.updateErrorRelationship(partialPath, mainFile);
        }
      } catch (err) {
        // Ignore file reading errors
      }
    }
  }

  // Setup file watching
  function setupWatcher(): chokidar.FSWatcher {
    const sassDir = path.join(projectDir, sourceDir);
    const sassWatcher = chokidar.watch('**/*.{scss,sass}', { 
      cwd: sassDir,
      ignoreInitial: true,
      ignored: '**/node_modules/**'
    });
    
    sassWatcher.on('add', async (file) => {
      const filePath = path.join(sassDir, file);
      if (path.basename(file).startsWith('_')) {
        // For partials, rebuild dependent files
        await handlePartialChange(filePath);
      } else {
        // For regular files, just build the file
        await compileSassFile(filePath);
      }
    });
    
    sassWatcher.on('change', async (file) => {
      const filePath = path.join(sassDir, file);
      if (path.basename(file).startsWith('_')) {
        // For partials, rebuild dependent files
        await handlePartialChange(filePath);
      } else {
        // For regular files, just build the file
        await compileSassFile(filePath);
      }
    });
    
    return sassWatcher;
  }

  return {
    rebuild: async () => {
      // Clear errors before starting a new build
      cssErrorCollector.clearErrors();
      await processAllScssFiles();
    },
    dispose: async () => {
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
      // Clear our caches
      partialDependencyMap.clear();
      fileLastModifiedMap.clear();
    },
    watch: () => {
      if (watchMode && !watcher) {
        watcher = setupWatcher();
      }
    }
  };
}

// Helper function to find main files that import a given partial
// Add projectDir as a parameter
function findFilesImportingPartial(partialPath: string, mainFiles: string[], projectDir: string): string[] {
  const result: string[] = [];
  const partialName = path.basename(partialPath).replace(/^_/, '').replace(/\.(scss|sass)$/, '');
  
  for (const mainFile of mainFiles) {
    try {
      const mainFilePath = path.join(projectDir, mainFile);
      const content = fs.readFileSync(mainFilePath, 'utf8');
      
      if (
        content.includes(`@import '${partialName}'`) ||
        content.includes(`@import "${partialName}"`) ||
        content.includes(`@use '${partialName}'`) ||
        content.includes(`@use "${partialName}"`) ||
        content.includes(`@forward '${partialName}'`) ||
        content.includes(`@forward "${partialName}"`)
      ) {
        result.push(mainFilePath);
      }
    } catch (err) {
      // Ignore file reading errors
    }
  }
  
  return result;
}
