import * as chokidar from 'chokidar';
import { IceConfig } from '../types.js';
import { BuildManager } from '../builders/index.js';
import { Logger } from '../utils/logger.js';
import path from 'path';
// Update import to use the external package
import { HotReloadServer } from '@n8d/ice-hotreloader';

const logger = new Logger('Watcher');

export class FileWatcher {
  private static instance: FileWatcher;
  private config: IceConfig;
  private buildManager: BuildManager;
  private hotReloadServer: any; // Using any type for compatibility
  private watcher: chokidar.FSWatcher | null = null;
  private changeTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private debounceTime: number;

  // Make constructor private to enforce singleton
  private constructor(config: IceConfig, buildManager: BuildManager, hotReloadServer: any) {
    this.config = config;
    this.buildManager = buildManager;
    this.hotReloadServer = hotReloadServer;
    this.debounceTime = config.hotreload?.debounceTime || 300;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config: IceConfig, buildManager: BuildManager, hotReloadServer: any): FileWatcher {
    if (!FileWatcher.instance) {
      FileWatcher.instance = new FileWatcher(config, buildManager, hotReloadServer);
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

    const watchPaths = this.config.watch?.paths || ['src'];
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
      const builder = this.buildManager.getBuilderForFile(filePath);
      if (!builder) {
        logger.warn(`No builder found for file: ${filePath}`);
        return;
      }
      
      await builder.processChange(filePath);
      
      // Send hot reload event if server is available
      if (this.hotReloadServer) {
        const ext = path.extname(filePath).toLowerCase();
        
        // Adapt to the ice-hotreloader API
        if (ext === '.css' || ext === '.scss' || ext === '.sass') {
          // Check which API is available and use it
          if (typeof this.hotReloadServer.notifyClients === 'function') {
            this.hotReloadServer.notifyClients('css', filePath);
          }
        } else {
          // For non-CSS files, trigger a full reload
          if (typeof this.hotReloadServer.notifyClients === 'function') {
            this.hotReloadServer.notifyClients('full', filePath);
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error processing change for ${filePath}: ${error}`);
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
