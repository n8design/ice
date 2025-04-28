#!/usr/bin/env node

import * as path from 'path';
import { performance } from 'perf_hooks';
import { parseArgs } from 'node:util';
import * as esbuild from 'esbuild';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import * as chokidar from 'chokidar';
import * as url from 'url';

// Import processors and utilities
import { setupDirectSassProcessor } from './scss/direct-processor.js';
import { setupTsProcessor } from './typescript/processor.js';
import { handlePartialChange } from './scss/partials.js';
import { createHmrServer, formatHmrMessage } from './hmr/index.js';
import { loadProjectConfig, loadTsConfig, detectSourceDirectory } from './config/index.js';
import { 
  logInfo, logSuccess, logError, logFileCompilation, formatSuccess, 
  getCurrentTime, formatDuration, logHotReload, logHotReloadDetail, 
  logHotReloadSuccess, logHotReloadError 
} from './utils/console.js';
import { reportError } from './utils/index.js';
import { cleanupCssJsFiles } from './utils/cleanup.js';
import { BuildContext, IceBuildConfig } from './types.js';

// Hipster-style ASCII art logo
const LOGO = `
${"\x1b[35m"}🧊 ICE BUILD${"\x1b[0m"}
${"\x1b[36m"}Artisanally crafted build tool${"\x1b[0m"}
`;

export async function startBuild(): Promise<void> {
  const startTime = performance.now();
  console.log(LOGO);
  logInfo('Starting build process...');

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
    logError(`Error parsing arguments: ${(e as Error).message}`);
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
    logError("Failed to load project configuration...");
    process.exit(1);
  }

  const config: IceBuildConfig = loadedConfig;

  // Override config with CLI args
  config.outputDir = args.values['output-dir'] || config.outputDir;
  config.sourceDir = args.values['source-dir'] || config.sourceDir;
  config.port = args.values.port ? parseInt(args.values.port, 10) : config.port;

  // Detect source directory *before* final config adjustments if needed
  const detectedSourceDir = await detectSourceDirectory(projectDir, config);
  config.sourceDir = detectedSourceDir;

  const outputDir = config.outputDir || 'public';
  const port = config.port || 3001;

  // Load tsConfig *after* all config values are finalized
  const tsConfig = await loadTsConfig(projectDir, config);

  // Ensure sourceDir is defined before creating context
  if (!config.sourceDir) {
    logError("❌ Error: Source directory could not be determined.");
    process.exit(1);
  }

  const ctx: BuildContext = {
    projectDir,
    sourceDir: config.sourceDir,
    outputDir,
    config,
    tsConfig,
    watchMode,
    isVerbose,
  };

  logInfo(`Source directory: ${ctx.sourceDir}`);
  logInfo(`Output directory: ${outputDir}`);
  if (watchMode) logInfo(`Watch mode enabled. HMR port: ${port}`);

  // --- Hot Reload Server ---
  let hmr: HotReloadServer | null = null;
  if (watchMode) {
    try {
      // Only pass the port parameter
      hmr = createHmrServer(port);
      logHotReload("Ready for changes");
    } catch (error) {
      logHotReloadError('Server failed to start', error as Error, isVerbose);
      process.exit(1);
    }
  }

  // --- Build Setup ---
  let scssProcessor: { rebuild: () => Promise<void>; dispose: () => Promise<void>; watch: () => void } | null = null;
  let tsContext: esbuild.BuildContext | null = null;
  const scssFilesCount = { value: 0 };
  const tsFilesCount = { value: 0 };

  try {
    // Use our new direct SCSS processor instead of the esbuild-based one
    scssProcessor = await setupDirectSassProcessor(ctx, hmr, scssFilesCount);
    tsContext = await setupTsProcessor(ctx, hmr, tsFilesCount);

    // --- Build Execution ---
    if (watchMode) {
      // Initial build and start watch mode
      logInfo('Initial build starting...');
      const initialBuildStart = performance.now();
      
      // Avoid duplicate processing by clearing any previous CSS.js files
      await cleanupCssJsFiles(path.join(ctx.projectDir, ctx.outputDir));
      
      // Process all files in one go
      await Promise.all([
        scssProcessor?.rebuild() ?? Promise.resolve(),
        tsContext?.rebuild() ?? Promise.resolve()
      ]);
      
      // Start watching
      scssProcessor?.watch();
      tsContext?.watch();
      
      const initialBuildEnd = performance.now();
      const initialBuildDuration = formatDuration(initialBuildEnd - initialBuildStart);
      
      logSuccess(`Initial build complete in ${initialBuildDuration}. Watching for changes...`);
      
      // Add directory watcher to detect NEW files
      const watcher = chokidar.watch(
        path.join(ctx.projectDir, ctx.sourceDir), 
        {
          ignoreInitial: true,
          awaitWriteFinish: true,
          ignored: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/public/**',
          ]
        }
      );
      
      // When new files are added or changed
      watcher.on('add', async (filePath) => {
        const relativePath = path.relative(ctx.projectDir, filePath);
        
        if (filePath.endsWith('.scss') || filePath.endsWith('.sass')) {
          if (path.basename(filePath).startsWith('_')) {
            // If it's a partial SCSS file, find and rebuild the dependent files
            logFileCompilation('SCSS Partial', relativePath);
            await handlePartialChange(ctx, hmr, filePath);
          } else {
            // For non-partial files, rebuild the entire SCSS context
            logFileCompilation('SCSS', relativePath);
            // Dispose old context and create a new one
            if (isVerbose) {
              logHotReloadDetail(`Rebuilding SCSS: ${relativePath}`, isVerbose);
            }
            await scssProcessor?.dispose();
            scssProcessor = await setupDirectSassProcessor(ctx, hmr, scssFilesCount);
            await scssProcessor?.rebuild();
            scssProcessor?.watch();
            if (!isVerbose) {
              logHotReloadSuccess(`Updated ${path.basename(filePath)}`);
            }
          }
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          logFileCompilation(filePath.endsWith('.tsx') ? 'TSX' : 'TypeScript', relativePath);
          // Rebuild TypeScript context with new entry point
          if (isVerbose) {
            logHotReloadDetail(`Rebuilding TypeScript: ${relativePath}`, isVerbose);
          }
          await tsContext?.dispose();
          tsContext = await setupTsProcessor(ctx, hmr, tsFilesCount);
          await tsContext?.rebuild();
          tsContext?.watch();
          if (!isVerbose) {
            logHotReloadSuccess(`Updated ${path.basename(filePath)}`);
          }
        }
      });
      
      // When files are changed, handle SCSS partials specially
      watcher.on('change', async (filePath) => {
        if ((filePath.endsWith('.scss') || filePath.endsWith('.sass')) && 
            path.basename(filePath).startsWith('_')) {
          const relativePath = path.relative(ctx.projectDir, filePath);
          logFileCompilation('SCSS Partial', relativePath);
          if (isVerbose) {
            logHotReloadDetail(`Processing changes to partial: ${relativePath}`, isVerbose);
          }
          await handlePartialChange(ctx, hmr, filePath);
          if (!isVerbose) {
            logHotReloadSuccess(`Updated styles from ${path.basename(filePath)}`);
          }
        }
      });
      
      logInfo('Watching for file changes... (Press Ctrl+C to stop)');
      if (isVerbose) {
        logHotReloadDetail("Full details enabled in verbose mode", isVerbose);
      } else {
        logHotReload("Updates will be shown when files change");
      }
      
      await new Promise(() => {});
    } else {
      // Single build run
      const singleBuildStart = performance.now();
      
      // Clean up before building
      await cleanupCssJsFiles(path.join(ctx.projectDir, ctx.outputDir));
      
      await Promise.all([
        scssProcessor?.rebuild() ?? Promise.resolve(),
        tsContext?.rebuild() ?? Promise.resolve()
      ]);
      
      await tsContext?.dispose();
      await scssProcessor?.dispose();
      
      const singleBuildEnd = performance.now();
      const singleBuildDuration = formatDuration(singleBuildEnd - singleBuildStart);
      
      logSuccess(`Build completed in ${singleBuildDuration}`);
    }

  } catch (error) {
    logError('Build setup or run failed', error as Error);
    if (scssProcessor) await scssProcessor.dispose();
    if (tsContext) await tsContext.dispose();
    process.exit(1);
  }

  // --- Watch Mode Handling & Shutdown ---
  if (watchMode) {
    const shutdown = async () => {
      logInfo('\nShutting down...');
      // Dispose contexts on shutdown
      await Promise.allSettled([
        scssProcessor?.dispose() ?? Promise.resolve(),
        tsContext?.dispose() ?? Promise.resolve(),
      ]);
      logInfo('Build contexts disposed. HMR server stopped.');
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // The await new Promise above keeps it alive until SIGINT/SIGTERM
  } else {
    const endTime = performance.now();
    const duration = endTime - startTime;
    logSuccess(`Total process finished in ${formatDuration(duration)}`);
    logInfo(`Processed ${scssFilesCount.value} SCSS files`);
    logInfo(`Processed ${tsFilesCount.value} TypeScript files`);
  }
}

function printHelp() {
  console.log(`
${LOGO}
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

// Auto-start if this is the main module
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  startBuild().catch(err => {
    logError('Unhandled error', err as Error);
    process.exit(1);
  });
}

