import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import { ESLint } from 'eslint';
import * as fs from 'fs/promises';
import * as path from 'path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import { fileURLToPath } from 'url';
import { glob } from 'glob'; // Add explicit import for glob

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI options with better help message
if (process.argv.includes('--help')) {
    console.log(`
ice-build: Build tool for SCSS and TypeScript with HMR support

Options:
  --project=<path>  Specify project directory (default: current directory)
  --verbose         Show detailed messages and errors
  --watch           Enable watch mode for live rebuilds
  --no-lint         Disable ESLint checking
  --help            Show this help message
    
Examples:
  ice-build --watch             Build and watch files in current directory
  ice-build --project=./app     Build files in the ./app directory
`);
    process.exit(0);
}

// Parse arguments
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const projectDir = projectArg 
  ? path.resolve(projectArg.split('=')[1])
  : process.cwd();
const isVerbose = process.argv.includes('--verbose');
const watchMode = process.argv.includes('--watch');
const skipLint = process.argv.includes('--no-lint');

console.log(`Building project at: ${projectDir}`);

// Initialize HMR Server
const hmr = new HotReloadServer(3001);
console.log(`[${new Date().toLocaleTimeString()}] 🚀 HMR Server started on ws://localhost:3001`);

// Helper function for paths (with error handling)
function resolveProjectPath(relativePath: string): string {
  try {
    return path.resolve(projectDir, relativePath);
  } catch (error) {
    console.error(`Error resolving path '${relativePath}':`, error);
    throw error;
  }
}

// Add this function to detect if a file is a SCSS partial
function isScssPartial(filePath: string): boolean {
  const basename = path.basename(filePath);
  return basename.startsWith('_') && basename.endsWith('.scss');
}

// Add this function to find main SCSS files that import a partial
async function findScssFilesImporting(partialPath: string): Promise<string[]> {
  // Get the partial name without leading underscore and path
  const partialName = path.basename(partialPath).substring(1);
  const partialDir = path.dirname(partialPath);
  
  // Find all non-partial SCSS files that might import this partial
  const allScssFiles = await glob('source/**/*.scss', { 
    cwd: projectDir,
    ignore: ['**/node_modules/**']
  });
  
  // Filter to non-partials only
  const mainScssFiles = allScssFiles.filter(file => !path.basename(file).startsWith('_'));
  
  // For complex projects, we'd need to parse each file to find @import or @use statements
  // For a simple approach, we'll check for files in the same directory and parent directories
  const potentialUsers = mainScssFiles.filter(file => {
    const fileDir = path.dirname(file);
    // Files in the same directory or parent directories are likely to import this partial
    return fileDir === partialDir || partialDir.startsWith(fileDir);
  });
  
  // Convert to absolute paths
  return potentialUsers.map(file => path.join(projectDir, file));
}

// ESLint setup with proper type
let eslintInstance: ESLint | null = null;
let isFlatConfig = false;
let flatConfigModule: any = null;

// Implement ESLint initialization
async function initESLint(): Promise<void> {
  try {
    // Check for flat config first
    const flatConfigPath = resolveProjectPath('eslint.config.js');
    try {
      await fs.access(flatConfigPath);
      console.log(`Found ESLint flat config at: ${flatConfigPath}`);
      isFlatConfig = true;
      
      // Dynamic import for flat config
      flatConfigModule = await import(flatConfigPath);
      eslintInstance = new ESLint({ overrideConfigFile: flatConfigPath });
    } catch (e) {
      // Check for legacy config
      const legacyConfigPaths = [
        '.eslintrc.js', 
        '.eslintrc.cjs',
        '.eslintrc.yaml',
        '.eslintrc.yml',
        '.eslintrc.json',
        '.eslintrc'
      ];
      
      let configFound = false;
      for (const configPath of legacyConfigPaths) {
        try {
          await fs.access(resolveProjectPath(configPath));
          console.log(`Found ESLint legacy config: ${configPath}`);
          configFound = true;
          eslintInstance = new ESLint({ cwd: projectDir });
          break;
        } catch (err) {
          // Config file not found, try next
        }
      }
      
      if (!configFound) {
        console.log('No ESLint config found, using default settings.');
        eslintInstance = new ESLint({ cwd: projectDir });
      }
    }
  } catch (error) {
    const err = error as Error;
    console.error('Failed to initialize ESLint:', err);
    return;
  }
}

// Implement linting function with proper types
async function lintFile(filePath: string): Promise<boolean> {
  if (skipLint || !eslintInstance) return true;
  
  try {
    const results = await eslintInstance.lintFiles([filePath]);
    const formatter = await eslintInstance.loadFormatter('stylish');
    const resultText = await formatter.format(results);
    
    if (resultText.trim()) {
      console.log(resultText);
    }
    
    // Check if there are any errors (not just warnings)
    const hasErrors = results.some(
      result => result.errorCount > 0 || result.fatalErrorCount > 0
    );
    
    return !hasErrors;
  } catch (error) {
    const err = error as Error;
    console.error(`ESLint error for ${path.basename(filePath)}:`, 
      isVerbose ? err : err.message);
    return false;
  }
}

// Safe file write helper (with directory creation)
async function safeWriteFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to write file ${filePath}: ${err.message}`);
  }
}

// Track which files were changed to process only those
let changedScssFiles: Set<string> = new Set();

// Add a debounced function to track file changes
function trackScssChange(filePath: string): void {
  changedScssFiles.add(filePath);
}

// Default TypeScript configuration to use as fallback
const DEFAULT_TS_CONFIG = {
  compilerOptions: {
    target: "es2020",
    module: "es2020",
    moduleResolution: "node",
    esModuleInterop: true,
    sourceMap: true,
    declaration: false,
    strict: true
  }
};

// Function to load TypeScript configuration with fallback
async function loadTsConfig(): Promise<any> {
  // Try to find tsconfig.json in the project directory
  const tsconfigPath = path.join(projectDir, 'tsconfig.json');
  
  try {
    // Check if tsconfig exists
    await fs.access(tsconfigPath);
    console.log(`Found TypeScript config at: ${tsconfigPath}`);
    
    // Read and parse tsconfig.json
    const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(tsconfigContent);
    
    console.log('Using project TypeScript configuration');
    return tsconfig;
  } catch (error) {
    const err = error as Error;
    
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No tsconfig.json found, using default TypeScript settings');
    } else {
      console.error(`Error parsing tsconfig.json: ${err.message}`);
      console.log('Falling back to default TypeScript settings');
    }
    
    return DEFAULT_TS_CONFIG;
  }
}

// Helper functions for converting TS settings to esbuild settings
function convertTsTargetToEsbuild(tsTarget: string): string {
  if (!tsTarget) return 'es2020';
  
  const targetMap: Record<string, string> = {
    'es3': 'es2015',
    'es5': 'es2015',
    'es6': 'es2015',
    'es2015': 'es2015',
    'es2016': 'es2016',
    'es2017': 'es2017',
    'es2018': 'es2018',
    'es2019': 'es2019',
    'es2020': 'es2020',
    'es2021': 'es2021',
    'es2022': 'es2022',
    'esnext': 'esnext',
  };
  
  return targetMap[tsTarget.toLowerCase()] || 'es2020';
}

function convertTsModuleToEsbuild(tsModule: string): esbuild.Format {
  if (!tsModule) return 'esm';
  
  const moduleMap: Record<string, esbuild.Format> = {
    'commonjs': 'cjs',
    'amd': 'esm',
    'umd': 'esm',
    'system': 'esm',
    'es6': 'esm',
    'es2015': 'esm',
    'es2020': 'esm',
    'esnext': 'esm',
    'node16': 'esm',
    'nodenext': 'esm',
  };
  
  return moduleMap[tsModule.toLowerCase()] || 'esm';
}

// Main build function using esbuild's watch mode
async function startBuild() {
  // Initialize ESLint
  if (!skipLint) {
    await initESLint();
  }
  
  // Track build times
  const buildStart = Date.now();
  let scssFiles = 0;
  let tsFiles = 0;
  
  try {
    // Create esbuild watcher for SCSS with custom file tracking
    const scssContext = await esbuild.context({
      entryPoints: (await glob('source/**/*.scss', { cwd: projectDir }))
        .filter(file => !path.basename(file).startsWith('_')),
      outdir: path.join(projectDir, 'public'),
      outbase: path.join(projectDir, 'source'),
      bundle: true,
      logLevel: isVerbose ? 'info' : 'warning',
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
          loadPaths: [path.join(projectDir, 'source')],
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
                const isInitialBuild = scssFiles === 0;
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
                const publicDir = path.join(projectDir, 'public');
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
                  const sourceDir = path.join(projectDir, 'source');
                  const publicDir = path.join(projectDir, 'public');
                  
                  // Convert output path back to source path
                  const relativePath = path.relative(publicDir, outputFile.path);
                  const sourcePath = path.join(
                    sourceDir, 
                    relativePath.replace(/\.css$/, '.scss')
                  );
                  
                  // Process with PostCSS
                  const css = await postcss([autoprefixer]).process(outputFile.text, {
                    from: sourcePath,
                    to: outputFile.path,
                    map: { inline: false }
                  });
                  
                  // Write processed CSS and sourcemap
                  await safeWriteFile(outputFile.path, css.css);
                  if (css.map) {
                    await safeWriteFile(`${outputFile.path}.map`, css.map.toString());
                  }
                  
                  // Send HMR notification with properly normalized path
                  const hmrPath = path.relative(publicDir, outputFile.path)
                    .replace(/\\/g, '/'); // Normalize path separators for URLs
                  
                  hmr.notifyClients('css', hmrPath);
                  console.log(`[${new Date().toLocaleTimeString()}] 📤 CSS update: ${hmrPath}`);
                  
                  // Increment processed file counter
                  scssFiles++;
                } catch (error) {
                  const err = error as Error;
                  console.error(`PostCSS processing error for ${path.basename(outputFile.path)}:`, 
                    isVerbose ? err : err.message);
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
    
    // We also need to add custom file tracking for SCSS files
    // Use Node's fs.watch to detect SCSS changes
    if (watchMode) {
      // Setup a separate watcher for SCSS partials
      const { watch } = await import('node:fs');
      
      // Watch the source directory for SCSS changes
      const sourceDir = path.join(projectDir, 'source');
      
      // Function to handle partial changes
      async function handleScssPartialChange(partialPath: string) {
        console.log(`Partial changed: ${path.basename(partialPath)}`);
        // Find files that might import this partial
        const affectedFiles = await findScssFilesImporting(partialPath);
        
        if (affectedFiles.length > 0) {
          console.log(`Found ${affectedFiles.length} files that might import this partial`);
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
      
      // Use a filesystem watcher to catch partial changes
      const fsWatcher = watch(sourceDir, { recursive: true }, async (eventType, filename) => {
        if (!filename || !filename.endsWith('.scss')) return;
        
        const filePath = path.join(sourceDir, filename);
        
        // If it's a partial, handle it specially
        if (isScssPartial(filePath)) {
          await handleScssPartialChange(filePath);
        }
        // Regular SCSS files are handled by esbuild watcher
      });
      
      // Clean up the watcher on exit
      process.on('SIGINT', () => {
        fsWatcher?.close();
      });
    }
    
    // Load TypeScript configuration with fallback
    const tsConfig = await loadTsConfig();
    const compilerOptions = tsConfig.compilerOptions || DEFAULT_TS_CONFIG.compilerOptions;

    // Create a context for TypeScript builds with config support
    const tsContext = await esbuild.context({
      entryPoints: await glob('source/**/*.ts', { cwd: projectDir }),
      outdir: path.join(projectDir, 'public/js'),
      // Apply TypeScript configuration
      target: convertTsTargetToEsbuild(compilerOptions.target),
      format: convertTsModuleToEsbuild(compilerOptions.module),
      plugins: [
        // Fix errors in the flatten-ts-structure plugin
        {
          name: 'flatten-ts-structure',
          setup(build) {
            build.onResolve({ filter: /\.ts$/ }, args => {
              // Keep the normal behavior for resolve
              return null;
            });
            
            build.onEnd(async (result) => {
              if (!result.outputFiles) return;
              
              // Move output files
              for (const outputFile of result.outputFiles) {
                // Only process JS files (not maps) at this stage
                if (!outputFile.path.endsWith('.js')) continue;
                
                const originalPath = outputFile.path;
                let newPath = originalPath;
                
                // Check if this file came from the ts folder
                // Convert output path back to source path
                const publicJsDir = path.join(projectDir, 'public/js');
                const relativePath = path.relative(publicJsDir, outputFile.path);
                
                // If the file has a ts/ directory in its path, flatten it
                if (relativePath.startsWith('ts/')) {
                  // Move to public/js directly, removing the ts/ part
                  newPath = path.join(publicJsDir, path.basename(outputFile.path));
                  
                  // Copy the file to the new location
                  await safeWriteFile(newPath, outputFile.text);
                  
                  // Also move the sourcemap if it exists
                  const sourceMapFile = result.outputFiles.find(
                    (f: esbuild.OutputFile) => f.path === `${outputFile.path}.map`
                  );
                  
                  if (sourceMapFile) {
                    const newMapPath = `${newPath}.map`;
                    
                    // Update the sourcemap content to reflect the new path
                    const sourceMap = JSON.parse(sourceMapFile.text);
                    sourceMap.file = path.basename(newPath);
                    
                    await safeWriteFile(newMapPath, JSON.stringify(sourceMap));
                  }
                  
                  console.log(`Flattened: ${relativePath} → ${path.basename(outputFile.path)}`);
                } else {
                  // For TS files not in the ts directory, keep the original path
                  await safeWriteFile(outputFile.path, outputFile.text);
                  
                  const sourceMapFile = result.outputFiles.find(
                    (f: esbuild.OutputFile) => f.path === `${outputFile.path}.map`
                  );
                  
                  if (sourceMapFile) {
                    await safeWriteFile(sourceMapFile.path, sourceMapFile.text);
                  }
                }
              }
            });
          }
        },
        // Keep your existing eslint-and-hmr plugin
        {
          name: 'eslint-and-hmr',
          setup(build) {
            // Run ESLint on each file before build
            build.onLoad({ filter: /\.ts$/ }, async (args) => {
              if (!skipLint && eslintInstance) {
                const lintSuccess = await lintFile(args.path);
                if (!lintSuccess) {
                  return {
                    errors: [{ text: 'ESLint errors found, see console output' }],
                  };
                }
              }
              return null; // Continue with default loading
            });
            
            // Handle HMR after build - removed file writing since we now do it in the flatten-ts-structure plugin
            build.onEnd(async (result) => {
              if (result.errors.length > 0) {
                console.error('TypeScript build failed:', result.errors);
                return;
              }
              
              // Reset the counter for statistics
              tsFiles = 0;
              
              // For each output file, send HMR notification
              if (!result.outputFiles) {
                console.warn('No output files generated from TypeScript build');
                return;
              }
              
              for (const outputFile of result.outputFiles) {
                // Skip source maps and non-JS files
                if (outputFile.path.endsWith('.map') || !outputFile.path.endsWith('.js')) continue;
                
                // Count JS files
                tsFiles++;
                
                try {
                  // Determine correct path for HMR notifications
                  const publicJsDir = path.join(projectDir, 'public/js');
                  let hmrPath;
                  
                  // Check if this came from the ts folder
                  const relativePath = path.relative(publicJsDir, outputFile.path);
                  if (relativePath.startsWith('ts/')) {
                    // Use flattened path for HMR
                    hmrPath = path.basename(outputFile.path);
                  } else {
                    // Use normal relative path
                    hmrPath = relativePath;
                  }
                  
                  // Normalize path separators for URLs
                  hmrPath = hmrPath.replace(/\\/g, '/');
                  
                  // Send HMR notification
                  hmr.notifyClients('full', hmrPath);
                  console.log(`[${new Date().toLocaleTimeString()}] 📤 JS update: ${hmrPath}`);
                } catch (error) {
                  const err = error as Error;
                  console.error(`Error processing JS file ${path.basename(outputFile.path)}:`, 
                    isVerbose ? err : err.message);
                }
              }
            });
          }
        }
      ],
      outbase: path.join(projectDir, 'source'),
      bundle: false,
      sourcemap: compilerOptions.sourceMap !== false,
      logLevel: isVerbose ? 'info' : 'warning',
      write: false, // Don't write directly, we'll handle that in the plugins
    });
    
    // Run initial builds
    await scssContext.rebuild();
    await tsContext.rebuild();
    
    // Report build performance
    const buildTime = Date.now() - buildStart;
    console.log(`Built ${scssFiles} SCSS and ${tsFiles} TypeScript files in ${buildTime}ms`);
    
    // Start watching if in watch mode
    if (watchMode) {
      console.log('Starting watch mode...');
      await Promise.all([
        scssContext.watch(),
        tsContext.watch()
      ]);
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Build completed. Watching for changes...`);
    } else {
      // Clean up contexts
      await scssContext.dispose();
      await tsContext.dispose();
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Build completed.`);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await scssContext.dispose();
      await tsContext.dispose();
      process.exit(0);
    });
  } catch (error) {
    const err = error as Error;
    console.error('Build setup failed:', isVerbose ? err : err.message);
    if (isVerbose && err.stack) {
      console.error(err.stack);
    }
    throw error;
  }
}

// Start the build process
startBuild().catch(error => {
  const err = error as Error;
  console.error('Build process failed:', err.message);
  process.exit(1);
});
