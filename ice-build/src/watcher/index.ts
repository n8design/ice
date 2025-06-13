import * as chokidar from 'chokidar';
import { IceConfig } from '../types.js';
import { Builder } from '../builders/index.js'; // Changed from BuildManager to Builder
import { Logger } from '../utils/logger.js';
import path from 'path';
// Update import to use the external package
import { HotReloadServer } from '@n8d/ice-hotreloader';

const logger = new Logger('Watcher');

export class FileWatcher {
  private static instance: FileWatcher;
  private config: IceConfig;
  private builder: Builder; // Changed from buildManager to builder
  private hotReloadServer: any; // Using any type for compatibility
  private watcher: chokidar.FSWatcher | null = null;
  private changeTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private debounceTime: number;

  // Make constructor private to enforce singleton
  private constructor(config: IceConfig, builder: Builder, hotReloadServer: any) {
    this.config = config;
    this.builder = builder;
    this.hotReloadServer = hotReloadServer;
    this.debounceTime = config.hotreload?.debounceTime || 300;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config: IceConfig, builder: Builder, hotReloadServer: any): FileWatcher {
    if (!FileWatcher.instance) {
      FileWatcher.instance = new FileWatcher(config, builder, hotReloadServer);
    }
    return FileWatcher.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (FileWatcher.instance && FileWatcher.instance.watcher) {
      FileWatcher.instance.watcher.close();
    }
    FileWatcher.instance = undefined as any;
  }

  /**
   * Start watching for file changes
   */
  public async start(): Promise<void> {
    if (this.watcher) {
      logger.warn('Watcher is already running');
      return;
    }

    // Determine watch paths: use config.watch.paths if specified, otherwise fall back to input.path
    let watchPaths: string[];
    if (this.config.watch?.paths) {
      watchPaths = this.config.watch.paths;
    } else if (this.config.input?.path) {
      // Use input.path as the default watch path
      watchPaths = [this.config.input.path];
    } else {
      // Final fallback to 'src' if neither is specified
      watchPaths = ['src'];
    }
    
    const ignored = this.config.watch?.ignored || ['**/node_modules/**', '**/\.*'];

    logger.info(`Starting file watcher for paths: ${watchPaths.join(', ')}`);
    logger.info(`Ignored patterns: ${ignored.join(', ')}`);

    this.watcher = chokidar.watch(watchPaths, {
      ignored,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', (filePath) => this.handleChange(filePath));
    
    logger.success('File watcher started');
  }

  /**
   * Handle file change
   */
  public handleChange(filePath: string): void {
    const normalizedPath = path.normalize(filePath);
    
    // Clear any existing timeout for this file
    if (this.changeTimeouts.has(normalizedPath)) {
      clearTimeout(this.changeTimeouts.get(normalizedPath));
    }
    
    // Set a new timeout
    const timeout = setTimeout(() => {
      this.changeTimeouts.delete(normalizedPath);
      this._handleChange(normalizedPath);
    }, this.debounceTime);
    
    this.changeTimeouts.set(normalizedPath, timeout);
  }
  
  /**
   * Internal method to handle changes after debouncing
   */
  private async _handleChange(filePath: string): Promise<void> {
    logger.info(`Processing file: ${filePath}`);
    
    try {
      const builder = this.builder.getBuilderForFile(filePath);
      if (!builder) {
        logger.warn(`No builder found for file: ${filePath} (ignored)`);
        return;
      }
      
      // Process the change but DON'T notify the hot reloader
      // Let the output watcher handle that
      await builder.processChange(filePath);
      
      // IMPORTANT: Remove the hotReloadServer notification code
      // The output watcher will handle notifications
      
    } catch (error) {
      logger.error(`Error processing change for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop watching files
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('File watcher stopped');
    }
  }
}
