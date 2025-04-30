import { Command } from 'commander';
import { Logger } from '../utils/logger.js';
import { ConfigManager } from '../config/index.js';
import { BuildManager } from '../builders/index.js';
import { HotReloadManager } from '../hotreload/index.js';
import { FileWatcher } from '../watcher/index.js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const logger = new Logger('CLI');

// Read the version from package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

export class CLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  private setupProgram(): void {
    // Main program with options instead of subcommands
    this.program
      .name('ice-build')
      .description('Frontend build tool for TypeScript and SCSS')
      .version(packageJson.version)
      .option('-c, --config <path>', 'Path to config file')
      .option('-w, --watch', 'Watch for changes and rebuild')
      .option('--clean', 'Clean output directory before building')
      .option('-v, --verbose', 'Enable verbose logging')
      .action((options) => {
        // Important: Always perform the default action when no subcommand is specified
        if (options.watch) {
          logger.info('Starting in watch mode...');
          this.executeWatch(options).catch(error => {
            logger.error(`Watch failed: ${error.message}`);
            process.exit(1);
          });
        } else {
          logger.info('Starting build...');
          this.executeBuild(options).catch(error => {
            logger.error(`Build failed: ${error.message}`);
            process.exit(1);
          });
        }
      });
  }

  private async executeBuild(options: any): Promise<void> {
    logger.info('Starting build');

    // Set debug mode if verbose option is provided
    if (options.verbose) {
      process.env.DEBUG = 'true';
    }

    // Load config
    const configManager = new ConfigManager(options.config);
    const config = configManager.getConfig();
    const outputPath = configManager.getOutputPath();

    // Initialize build manager
    const buildManager = new BuildManager(config, outputPath);

    // Clean if requested
    if (options.clean) {
      await buildManager.cleanAll();
    }

    // Run the build
    await buildManager.buildAll();

    logger.success('Build completed');
  }

  private async executeWatch(options: any): Promise<void> {
    logger.info('Starting watch mode');

    // Set debug mode if verbose option is provided
    if (options.verbose) {
      process.env.DEBUG = 'true';
    }

    // Load config
    const configManager = new ConfigManager(options.config);
    const config = configManager.getConfig();
    const outputPath = configManager.getOutputPath();

    // Initialize build manager
    const buildManager = new BuildManager(config, outputPath);

    // Clean if requested
    if (options.clean) {
      await buildManager.cleanAll();
    }

    // Initialize hot reload manager
    const hotReloadManager = new HotReloadManager(config);
    await hotReloadManager.initialize();

    // Initial build
    await buildManager.buildAll();

    // Start file watcher
    const watcher = new FileWatcher(config, buildManager, hotReloadManager);
    await watcher.start();

    // Handle process termination
    const cleanup = () => {
      watcher.stop();
      hotReloadManager.disconnect();
      logger.info('Watch mode stopped');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    logger.success('Watch mode started');
    logger.info(chalk.cyan('Press Ctrl+C to exit'));
  }

  public async run(argv: string[]): Promise<void> {
    try {
      // Process the arguments and ensure the action is called
      await this.program.parseAsync(argv);
      
      // Remove this block that's showing help - this is interfering with our command execution
      // const options = this.program.opts();
      // if (Object.keys(options).length === 0 || 
      //    (Object.keys(options).length === 1 && options.version)) {
      //   this.program.help();
      // }
    } catch (error: any) {
      logger.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }
}
