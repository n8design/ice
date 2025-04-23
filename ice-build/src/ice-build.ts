#!/usr/bin/env node
import { fileURLToPath } from 'url';
import * as path from 'path';
import { BuildContext, BuildResult, EslintState } from './types';
import { loadProjectConfig, detectSourceDirectory, loadTsConfig } from './config';
import { reportError } from './utils';
import { setupScssProcessor, setupScssWatcher } from './scss';
import { setupTsProcessor } from './typescript';
import { initESLint } from './linting';
import { createHmrServer } from './hmr';
import { HotReloadServer } from '@n8d/ice-hotreloader'; // Add this import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function parseCliArgs(): Promise<{
  projectDir: string;
  isVerbose: boolean;
  watchMode: boolean;
  skipLint: boolean;
}> {
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

  return { projectDir, isVerbose, watchMode, skipLint };
}

async function startBuild(): Promise<BuildResult> {
  const { projectDir, isVerbose, watchMode, skipLint } = await parseCliArgs();
  console.log(`Building project at: ${projectDir}`);
  
  // Track build times
  const buildStart = Date.now();
  
  // File counters
  const scssFilesCount = { value: 0 };
  const tsFilesCount = { value: 0 };
  
  try {
    // Load configuration
    const config = await loadProjectConfig(projectDir);
    
    // Detect source directory
    const sourceDir = await detectSourceDirectory(projectDir, config);
    const outputDir = config.outputDir || 'public';
    
    // Initialize HMR Server
    const hmrPort = config.port || 3001;
    const hmr = createHmrServer(hmrPort);
    
    // Create build context
    const ctx: BuildContext = {
      projectDir,
      sourceDir,
      outputDir,
      isVerbose,
      watchMode,
      skipLint,
      config
    };
    
    // Initialize ESLint if needed
    const eslintState = !skipLint ? await initESLint(projectDir) : { instance: null, isFlatConfig: false, flatConfigModule: null };
    
    // Create SCSS processor
    const scssContext = await setupScssProcessor(ctx, hmr, scssFilesCount);
    
    // Setup SCSS watcher if in watch mode
    const scssWatcher = await setupScssWatcher(ctx, scssContext);
    
    // Load TypeScript config
    const tsConfig = await loadTsConfig(projectDir, config);
    
    // Create TypeScript processor - explicitly cast to Record<string, unknown>
    const tsContext = await setupTsProcessor(
      ctx, 
      hmr, 
      tsConfig as Record<string, unknown>, 
      eslintState.instance, 
      tsFilesCount
    );
    
    // Run initial builds
    await scssContext.rebuild();
    await tsContext.rebuild();
    
    // Report build performance
    const buildTime = Date.now() - buildStart;
    console.log(`Built ${scssFilesCount.value} SCSS and ${tsFilesCount.value} TypeScript files in ${buildTime}ms`);
    
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
      if (scssWatcher) scssWatcher.close();
      await scssContext.dispose();
      await tsContext.dispose();
      process.exit(0);
    });
    
    return { 
      scssFiles: scssFilesCount.value, 
      tsFiles: tsFilesCount.value, 
      buildTime 
    };
  } catch (error) {
    reportError('Build setup', error as Error, isVerbose);
    throw error;
  }
}

// Start the build process
startBuild().catch(error => {
  const err = error as Error;
  console.error('Build process failed:', err.message);
  process.exit(1);
});
