#!/usr/bin/env node

import * as path from 'path';
import { performance } from 'perf_hooks';
import { parseArgs } from 'node:util';
import * as esbuild from 'esbuild';
import { HotReloadServer } from '@n8d/ice-hotreloader';
// Add .js extensions
import { setupScssProcessor } from './scss/index.js';
import { setupTsProcessor } from './typescript/index.js';
import { loadProjectConfig, loadTsConfig, detectSourceDirectory } from './config/index.js';
import { reportError } from './utils/index.js';
import { BuildContext, IceBuildConfig } from './types.js';
import * as chokidar from 'chokidar';
import * as url from 'url'; // Keep this import for pathToFileURL if used later

export async function startBuild(): Promise<void> {
  const startTime = performance.now();
  console.log('Starting ice-build...');

  // --- Argument Parsing ---
  const options = {
    watch: { type: 'boolean', short: 'w', default: false },
    'output-dir': { type: 'string', short: 'o' },
    'source-dir': { type: 'string', short: 's' },
    port: { type: 'string', short: 'p' },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  } as const;

  let args;
  try {
    args = parseArgs({ options, allowPositionals: true });
  } catch (e) {
    console.error(`Error parsing arguments: ${(e as Error).message}`);
    printHelp();
    process.exit(1);
  }

  if (args.values.help) {
    printHelp();
    return;
  }

  const watchMode = args.values.watch;
  const isVerbose = args.values.verbose;

  // --- Configuration Loading ---
  const projectDir = process.cwd();
  // For Windows compatibility with ESM
  const projectDirUrl = process.platform === 'win32' 
    ? url.pathToFileURL(projectDir).href
    : projectDir;

  const loadedConfig: IceBuildConfig | undefined = await loadProjectConfig(projectDir);

  if (!loadedConfig) {
    console.error("Failed to load project configuration...");
    process.exit(1);
  }

  const config: IceBuildConfig = loadedConfig; // config is guaranteed IceBuildConfig here

  // Override config with CLI args
  config.outputDir = args.values['output-dir'] || config.outputDir;
  config.sourceDir = args.values['source-dir'] || config.sourceDir;
  config.port = args.values.port ? parseInt(args.values.port, 10) : config.port;

  // Detect source directory *before* final config adjustments if needed
  // Pass the whole config object
  const detectedSourceDir = await detectSourceDirectory(projectDir, config);
  config.sourceDir = detectedSourceDir; // Assign the detected path back

  const outputDir = config.outputDir || 'public';
  const port = config.port || 3001;

  // Load tsConfig *after* all config values are finalized
  const tsConfig = await loadTsConfig(projectDir, config); // Pass the final config object

  // Ensure sourceDir is defined before creating context (detectSourceDirectory should handle this)
  if (!config.sourceDir) {
    console.error("❌ Error: Source directory could not be determined.");
    process.exit(1);
  }

  const ctx: BuildContext = {
    projectDir,
    sourceDir: config.sourceDir, // Use the validated sourceDir
    outputDir,
    config,
    tsConfig,
    watchMode,
    isVerbose,
  };

  console.log(`Source directory: ${ctx.sourceDir}`);
  console.log(`Output directory: ${outputDir}`);
  if (watchMode) console.log(`Watch mode enabled. HMR port: ${port}`);

  // --- Hot Reload Server ---
  let hmr: HotReloadServer | null = null;
  if (watchMode) {
    try {
      hmr = new HotReloadServer(port);
    } catch (error) {
      reportError('HMR Server failed to start', error as Error, isVerbose);
      process.exit(1);
    }
  }

  // --- Build Setup ---
  let scssContext: esbuild.BuildContext | null = null;
  let tsContext: esbuild.BuildContext | null = null;
  const scssFilesCount = { value: 0 };
  const tsFilesCount = { value: 0 };

  try {
    // Use non-null assertion carefully, assuming hmr is needed by processors in watch mode
    scssContext = await setupScssProcessor(ctx, hmr!, scssFilesCount);
    tsContext = await setupTsProcessor(ctx, hmr!, tsFilesCount);

    // --- Build Execution ---
    if (watchMode) {
      // Initial build and start esbuild's watch mode (this handles changes to existing files)
      console.log('Initial build starting...');
      await Promise.all([
        scssContext?.rebuild() ?? Promise.resolve(), // Use ?.
        tsContext?.rebuild() ?? Promise.resolve()   // Use ?.
      ]);
      console.log('Initial build complete. Watching for changes...');
      
      // Start esbuild watching (for changes to EXISTING files)
      scssContext?.watch(); // Use ?.
      tsContext?.watch();   // Use ?.
      
      // Add directory watcher to detect NEW files
      const watcher = chokidar.watch(
        path.join(ctx.projectDir, ctx.sourceDir), 
        {
          ignoreInitial: true,
          awaitWriteFinish: true
        }
      );
      
      // When new files are added that match our patterns
      watcher.on('add', async (filePath) => {
        const relativePath = path.relative(ctx.projectDir, filePath);
        
        if (filePath.endsWith('.scss')) {
          // Only rebuild for non-partial SCSS files (don't start with _)
          if (!path.basename(filePath).startsWith('_')) {
            console.log('Rebuilding SCSS context with new entry points...');
            // Dispose old context and create a new one
            await scssContext?.dispose(); // Use ?.
            scssContext = await setupScssProcessor(ctx, hmr!, scssFilesCount);
            await scssContext?.rebuild(); // Add null check here
            scssContext?.watch();
          }
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) { // Ensure .tsx is handled
          console.log('Rebuilding TypeScript context with new entry points...');
          // Dispose old context and create a new one
          await tsContext?.dispose(); // Use ?.
          tsContext = await setupTsProcessor(ctx, hmr!, tsFilesCount);
          await tsContext?.rebuild(); // Add null check here
          tsContext?.watch();
        }
      });
      
      console.log('Watching for file changes and new files... (Press Ctrl+C to stop)');
      await new Promise(() => {});
    } else {
      // Single build run
      await Promise.all([
        scssContext?.rebuild() ?? Promise.resolve(), // Use ?.
        tsContext?.rebuild() ?? Promise.resolve()   // Use ?.
      ]);
      await scssContext?.dispose(); // Use ?.
      await tsContext?.dispose();   // Use ?.
    }

  } catch (error) {
    reportError('Build setup or run failed', error as Error, isVerbose);
    if (scssContext) await scssContext.dispose();
    if (tsContext) await tsContext.dispose();
    process.exit(1);
  }

  // --- Watch Mode Handling & Shutdown ---
  if (watchMode) {
    const shutdown = async () => {
      console.log('\nShutting down...');
      // Dispose contexts on shutdown
      await Promise.allSettled([
        scssContext?.dispose() ?? Promise.resolve(), // Use ?.
        tsContext?.dispose() ?? Promise.resolve(),   // Use ?.
      ]);
      console.log('Build contexts disposed. HMR server stopped.');
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // The await new Promise above keeps it alive until SIGINT/SIGTERM
  } else {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ Build finished in ${duration.toFixed(2)}ms`);
    console.log(`   Processed ${scssFilesCount.value} SCSS files.`);
    console.log(`   Processed ${tsFilesCount.value} TypeScript files.`);
  }
}

function printHelp() {
  console.log(`
Usage: ice-build [options]

Options:
  -w, --watch         Enable watch mode with Hot Module Reloading (HMR).
  -o, --output-dir    Specify the output directory (default: public).
  -s, --source-dir    Specify the source directory (default: detected source/src).
  -p, --port          Specify the HMR server port (default: 3001).
  -v, --verbose       Enable verbose logging.
  -h, --help          Display this help message.
`);
}

