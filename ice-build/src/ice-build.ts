import chokidar from 'chokidar';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import { ESLint } from 'eslint'; // Basic ESLint import
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer'; // Make sure this is the correct import style for autoprefixer
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add this to your help text or argument parsing logic
if (process.argv.includes('--help')) {
    console.log(`
ice-build options:
  --project=<path>  Specify project directory
  --verbose         Show detailed error messages
  --no-lint         Disable ESLint
  --help            Show this help message
`);
    process.exit(0);
}

// Determine the project directory based on command line argument or current working directory
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const projectDir = projectArg 
  ? path.resolve(projectArg.split('=')[1])
  : process.cwd();  // Use current working directory instead of hardcoded test-core

console.log(`Building project at: ${projectDir}`);

// Near the top where you handle command line arguments
const verboseArg = process.argv.includes('--verbose');
const isVerbose = verboseArg || false;

// Initialize HMR Server
const hmr = new HotReloadServer(3001);

// Store ESLint instance and linting function
let eslintInstance: ESLint | null = null;
let isFlatConfig = false;
let flatConfigModule: any = null;

// Helper function to resolve paths relative to project root
function resolveProjectPath(relativePath: string): string {
  return path.resolve(projectDir, relativePath);
}

async function buildSass(filePath: string): Promise<boolean> {
    try {
        // Normalize paths
        const sourcePath = resolveProjectPath('source');
        const publicPath = resolveProjectPath('public');
        
        const relativePath = path.relative(sourcePath, filePath);
        const outputPath = path.join(publicPath, relativePath.replace('.scss', '.css'));
        
        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        console.log(`[${new Date().toLocaleTimeString()}] Building:
            Input:  ${path.basename(filePath)}
            Output: ${path.basename(outputPath)}
        `);

        // Get the SCSS output directly rather than writing to a file
        const result = await esbuild.build({
            entryPoints: [filePath],
            bundle: false,  // Change to false to avoid JS wrapping
            minify: true,
            sourcemap: true,
            write: false,   // Don't write to disk, return result instead
            plugins: [
                sassPlugin({
                    loadPaths: [sourcePath],
                    type: 'css'
                })
            ]
        });
        
        // Get the CSS content from result
        let cssContent = '';
        if (result.outputFiles && result.outputFiles.length > 0) {
            cssContent = new TextDecoder().decode(result.outputFiles[0].contents);
        } else {
            throw new Error('No output received from esbuild');
        }

        // Process with PostCSS (autoprefixer)
        try {
            const result = await postcss([autoprefixer]).process(cssContent, {
                from: filePath,
                to: outputPath,
                map: { inline: false }
            });

            // Write processed CSS to final output file
            await fs.writeFile(outputPath, result.css);
            if (result.map) {
                await fs.writeFile(`${outputPath}.map`, result.map.toString());
            }
        } catch (postcssError) {
            // Just write the unprocessed CSS if PostCSS fails
            await fs.writeFile(outputPath, cssContent);
            console.error('PostCSS processing error:', isVerbose ? postcssError : (postcssError as Error).message);
        }

        // Correctly format the path for HMR notification
        const cssPath = relativePath.replace('.scss', '.css');
        hmr.notifyClients('css', cssPath);
        console.log(`[${new Date().toLocaleTimeString()}] 📤 CSS update: ${cssPath}`);
        
        return true;
    } catch (error: unknown) {
        // Error handling with improved messages
        if (!isVerbose) {
            const errorMessage = (error as Error).message || '';
            const sassError = errorMessage.match(/error: (.*?)(?=\n\s+at|$)/s);
            
            if (sassError && sassError[1]) {
                console.error(`❌ SASS Error in ${path.basename(filePath)}:`);
                console.error(`   ${sassError[1].trim()}`);
            } else {
                console.error(`❌ Error processing ${path.basename(filePath)}:`);
                console.error(`   ${errorMessage.split('\n')[0]}`);
            }
        } else {
            // In verbose mode, show the full error
            console.error('Build error:', error);
        }
        
        return false;
    }
}

// Check for ESLint configuration files
async function findESLintConfig(projectDir: string): Promise<{path?: string, isFlatConfig: boolean}> {
  // Check for modern flat config
  const flatConfigPath = path.join(projectDir, 'eslint.config.js');
  try {
    await fs.access(flatConfigPath);
    console.log(`Found ESLint flat config at: ${flatConfigPath}`);
    return { path: flatConfigPath, isFlatConfig: true };
  } catch (e) {
    // File doesn't exist
  }
  
  // Check for legacy config
  const legacyConfigPath = path.join(projectDir, '.eslintrc.js');
  try {
    await fs.access(legacyConfigPath);
    console.log(`Found ESLint legacy config at: ${legacyConfigPath}`);
    return { path: legacyConfigPath, isFlatConfig: false };
  } catch (e) {
    // File doesn't exist
  }
  
  // Try .eslintrc.json as well
  const jsonConfigPath = path.join(projectDir, '.eslintrc.json');
  try {
    await fs.access(jsonConfigPath);
    console.log(`Found ESLint JSON config at: ${jsonConfigPath}`);
    return { path: jsonConfigPath, isFlatConfig: false };
  } catch (e) {
    // File doesn't exist
  }
  
  console.log('No ESLint config found, will use ESLint defaults');
  return { isFlatConfig: false };
}

async function initESLint() {
  const configInfo = await findESLintConfig(projectDir);
  isFlatConfig = configInfo.isFlatConfig;
  
  if (configInfo.isFlatConfig) {
    try {
      // Try to dynamically import the ESLint module and load a version with flat config support
      // This works with ESLint v9+ that has flat config support
      const eslintModule = await import('eslint');
      
      // Use loadESLint with flat config option
      try {
        const FlatESLint = await eslintModule.loadESLint({ useFlatConfig: true });
        if (FlatESLint) {
          eslintInstance = new FlatESLint({
            // Your configuration options here
          });
          flatConfigModule = eslintModule;
        } else {
          throw new Error("FlatESLint not available in your ESLint version");
        }
      } catch (error) {
        console.error("Failed to load ESLint:", error);
      }
    } catch (error) {
      console.error('Failed to initialize FlatESLint:', error);
      console.log('Skipping linting. To enable linting, use .eslintrc.js instead of eslint.config.js');
      eslintInstance = null;
    }
  } else {
    // For legacy config, use ESLint
    console.log('Using ESLint legacy config format');
    
    const options: ESLint.Options = {
      fix: true,
      errorOnUnmatchedPattern: false,
      cwd: projectDir
    };
    
    // Only add override if legacy config file was found
    if (configInfo.path) {
      options.overrideConfigFile = configInfo.path;
    }
    
    try {
      eslintInstance = new ESLint(options);
    } catch (error) {
      console.error('Failed to initialize ESLint:', error);
      eslintInstance = null;
    }
  }
}

async function lintFiles(filePath: string): Promise<boolean> {
    // Skip linting if ESLint isn't initialized
    if (!eslintInstance) {
        console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Skipping lint for ${path.basename(filePath)} (ESLint not initialized)`);
        return true;
    }
  
    try {
        // Only process TypeScript files
        if (!filePath.endsWith('.ts')) {
            return true;
        }
        
        try {
            console.log(`[${new Date().toLocaleTimeString()}] Linting ${path.basename(filePath)} with ${isFlatConfig ? 'flat' : 'legacy'} config`);
            
            let results;
            if (isFlatConfig && eslintInstance && flatConfigModule) {
                // Use FlatESLint API if available
                results = await eslintInstance.lintFiles([filePath]);
                if (results.length > 0 && results.some(r => r.messages.length > 0)) {
                    await flatConfigModule.outputFixes(results);
                }
            } else {
                // Use regular ESLint API
                results = await eslintInstance.lintFiles([filePath]);
                await ESLint.outputFixes(results);
            }
            
            const hasErrors = results.some(result => result.errorCount > 0);
            if (hasErrors) {
                // Format output
                const formatter = await eslintInstance.loadFormatter('stylish');
                const resultText = await formatter.format(results);
                console.error(`[${new Date().toLocaleTimeString()}] 🔥 ESLint errors:`);
                console.error(resultText);
                return false;
            }
            return true;
        } catch (lintError: any) {
            // If ESLint fails, log a warning but allow the build to continue
            console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ ESLint skipped:`, lintError.message);
            return true; // Continue with build despite linting failure
        }
    } catch (error) {
        console.error('Linting error:', error);
        return false;
    }
}

async function buildTypeScript(filePath: string): Promise<void> {
    const sourceTsPath = resolveProjectPath('source/ts');
    const publicJsPath = resolveProjectPath('public/js');
    
    const relativePath = path.relative(sourceTsPath, filePath);
    const outputPath = path.join(publicJsPath, relativePath.replace('.ts', '.js'));

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await esbuild.build({
        entryPoints: [filePath],
        outfile: outputPath,
        bundle: false,
        minify: false,
        sourcemap: true,
        format: 'esm',
        target: 'es2020',
    });

    console.log(`[${new Date().toLocaleTimeString()}] 📤 HMR: TypeScript update sent for ${relativePath}`);
    hmr.notifyClients('full', relativePath); // Reload page for JS changes
}

// Improved SCSS watcher implementation

// Replace the interface definition with this:
interface WatchersContainer {
  scss?: ReturnType<typeof chokidar.watch>;
  ts?: ReturnType<typeof chokidar.watch>;
}

// Use the modern approach for global augmentation
declare global {
  var watchers: WatchersContainer | undefined;
}

// Initialize watcher container
global.watchers = global.watchers || {};

// Close any existing watchers to prevent duplicates
if (global.watchers?.scss) {
  global.watchers.scss.close();
}

// Define SCSS source pattern
const scssSourcePattern = path.join(projectDir, 'source', '**', '*.scss');
console.log(`Watching SCSS files at: ${scssSourcePattern}`);

// Create watcher with better options
const scssWatcher = chokidar.watch(scssSourcePattern, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  },
  ignored: [
    /(^|[\/\\])\../,
    '**/node_modules/**'
  ]
});

// Store watcher globally
global.watchers.scss = scssWatcher;

// Add proper event handlers
scssWatcher
  .on('add', async (filePath) => {
    console.log(`[${new Date().toLocaleTimeString()}] SCSS file added: ${path.basename(filePath)}`);
    await buildSass(filePath);
  })
  .on('change', async (filePath) => {
    console.log(`[${new Date().toLocaleTimeString()}] SCSS file changed: ${path.basename(filePath)}`);
    await buildSass(filePath);
  })
  .on('error', (error) => {
    console.error(`SCSS watcher error: ${error}`);
  })
  .on('ready', () => {
    const watchedPaths = scssWatcher.getWatched();
    const dirCount = Object.keys(watchedPaths).length;
    console.log(`SCSS watcher ready. Watching ${dirCount} directories`);
  });

// Properly shutdown watchers on exit
process.on('SIGINT', () => {
  console.log('Shutting down watchers...');
  if (global.watchers?.scss) {
    global.watchers.scss.close();
  }
  if (global.watchers?.ts) {
    global.watchers.ts.close();
  }
  process.exit(0);
});

// Update the TypeScript watcher path
const sourceTsGlob = resolveProjectPath('source/ts/**/*.ts');
console.log(`Watching TypeScript files at: ${sourceTsGlob}`);

const tsWatcher = chokidar.watch(sourceTsGlob, {
    ignored: [/(^|[\/\\])\../, '**/node_modules/**'],
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
    }
});

tsWatcher.on('ready', () => {
    console.log(`TypeScript watcher ready. Watching ${Object.keys(tsWatcher.getWatched()).length} directories`);
});

tsWatcher.on('change', async (filePath) => {
    console.log(`[${new Date().toLocaleTimeString()}] TypeScript changed: ${filePath}`);
    const lintSuccess = await lintFiles(filePath);
    if (lintSuccess) {
        await buildTypeScript(filePath);
    }
});

// Initial setup
async function init() {
  // Initialize ESLint
  await initESLint();
  
  // Build SCSS files
  const scssFiles = await glob(resolveProjectPath('source/**/*.scss'));
  console.log(`Found ${scssFiles.length} SCSS files to build`);
  for (const file of scssFiles) {
    await buildSass(file);
  }
  
  // Build TypeScript files
  const tsFiles = await glob(resolveProjectPath('source/ts/**/*.ts'));
  console.log(`Found ${tsFiles.length} TypeScript files to build`);
  for (const file of tsFiles) {
    const lintSuccess = await lintFiles(file);
    if (lintSuccess) {
      await buildTypeScript(file);
    }
  }
  
  console.log(`[${new Date().toLocaleTimeString()}] ✅ Build completed. Watching for changes...`);
}

// Check for watch flag
const watchMode = process.argv.includes('--watch');
if (watchMode) {
    console.log('Starting in watch mode...');
}

// Start the build process
init().catch(error => {
    console.error('Build process failed:', error);
    process.exit(1);
});// Test comment for changelog
// Another test comment
// Final test comment
// Final test comment
