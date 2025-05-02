#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs'; // Import fs
import { fileURLToPath } from 'url'; // Import fileURLToPath
// Re-introduce ConfigManager import
import { ConfigManager } from '../config/index.js'; // Assuming index exports ConfigManager
import { BuildManager } from '../builders/index.js';
import { FileWatcher } from '../watcher/index.js';
import { HotReloadManager } from '../hotreload/index.js';
import { Logger } from '../utils/logger.js';

// --- Get version from package.json ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Adjust the relative path if src/bin is nested differently relative to package.json
const packageJsonPath = path.resolve(__dirname, '../../package.json');
let cliVersion = '0.0.0'; // Default version
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  cliVersion = packageJson.version || cliVersion;
} catch (error) {
  // Log error or handle case where package.json is not found/readable
  console.error(`Warning: Could not read version from ${packageJsonPath}. Using default version ${cliVersion}.`);
}
// --- End get version ---

const program = new Command();
const logger = new Logger('CLI');

program
  .name('ice-build')
  .description('Modern build tool for TypeScript and SCSS')
  .version(cliVersion); // Use dynamic version

program
  .command('watch')
  .description('Start the build process in watch mode with hot reloading')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    if (options.verbose) {
      process.env.DEBUG = 'true';
    }
    logger.info('Starting in watch mode...');
    try {
      // --- Use ConfigManager again ---
      const configManager = new ConfigManager(options.config); // Instantiate ConfigManager
      const config = configManager.getConfig(); // Get config from manager
      const outputPath = configManager.getOutputPath(); // Get output path from manager
      // --- End ConfigManager usage ---

      // Initialize core managers
      const buildManager = new BuildManager(config, outputPath);
      // Pass the full config object to HotReloadManager constructor
      const hotReloadManager = new HotReloadManager(config);
      const fileWatcher = new FileWatcher(config, buildManager, hotReloadManager);

      // Perform initial build
      await buildManager.buildAll();

      // Start watching
      await fileWatcher.start();

      logger.info('Watching for changes...');
    } catch (error) {
      logger.error(`Watch mode failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Build the project')
  .option('-c, --config <path>', 'Path to config file')
  .option('--clean', 'Clean output directory before building')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    if (options.verbose) {
      process.env.DEBUG = 'true';
    }
    logger.info('Starting build...');
    try {
      // --- Use ConfigManager again ---
      const configManager = new ConfigManager(options.config); // Instantiate ConfigManager
      const config = configManager.getConfig(); // Get config from manager
      const outputPath = configManager.getOutputPath(); // Get output path from manager
      // --- End ConfigManager usage ---

      // Initialize BuildManager
      const buildManager = new BuildManager(config, outputPath);

      if (options.clean) {
        logger.info('Cleaning output directory...');
        try {
          fs.rmSync(outputPath, { recursive: true, force: true });
          fs.mkdirSync(outputPath, { recursive: true }); // Recreate empty dir
          logger.success('Output directory cleaned.');
        } catch (error: any) {
          logger.error(`Failed to clean output directory: ${error.message}`);
        }
      }

      await buildManager.buildAll();

      logger.success('Build finished successfully.');
    } catch (error) {
      logger.error(`Build failed: ${error}`);
      process.exit(1);
    }
  });

async function run() {
  program.parse(process.argv);
}

// Re-apply explicit 'any' cast to the catch parameter - Line 100 Error Target
run().catch((error: any) => { // Ensure ': any' is present here
  // Now we can access properties directly, but less safely
  if (error && error.message) {
    logger.error(`Unhandled error: ${error.message}`);
  } else {
    // Attempt to stringify if no message property
    try {
      logger.error(`Unhandled error: ${JSON.stringify(error)}`);
    } catch (stringifyError) {
      // Fallback if stringify fails (e.g., circular references)
      logger.error(`Unhandled error: [Could not stringify error]`);
    }
  }
  process.exit(1);
});