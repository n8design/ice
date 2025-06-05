import * as path from 'path';
import * as chokidar from 'chokidar';
import { Logger } from '../utils/logger.js';
import { HotReloadServer } from '@n8d/ice-hotreloader';

const logger = new Logger('OutputWatcher');

/**
 * OutputWatcher watches the build destination folder and notifies
 * the hot reload server when output files change.
 *
 * Output filtering:
 * - You can exclude certain file types from triggering hot reload by specifying an array of extensions in
 *   `config.hotreload.excludeExtensions` (e.g., ['.map', '.txt']).
 * - When a file changes, if its extension is in the exclude list, it will be ignored and not trigger a reload.
 * - If the file is a .css file, the watcher will call `notifyClients` on the hot reload server with type 'css'.
 * - For .js files and .html files, the watcher will call `notifyClients` with type 'full'.
 * - Files starting with underscore (_) or dot (.) are skipped as they are typically partials or temporary files.
 */
export class OutputWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private outputDir: string;
  private isWatching = false;
  private hotReloadServer: HotReloadServer;
  private config: any;
  private logger: Logger;

  /**
   * Create a new output folder watcher
   * @param outputDir The output directory to watch
   * @param hotReloadServer The hot reload server to notify
   * @param config Optional configuration object
   */
  constructor(outputDir: string, hotReloadServer: HotReloadServer, config: any = {}) {
    this.outputDir = outputDir;
    this.hotReloadServer = hotReloadServer;
    this.config = config;
    this.logger = new Logger('OutputWatcher');
    logger.debug(`OutputWatcher initialized for directory: ${outputDir}`);
  }

  /**
   * Start watching the output directory
   */
  public start(): void {
    if (this.isWatching) {
      return;
    }

    this.logger.info(`Starting to watch output directory: ${this.outputDir}`);

    // Initialize the watcher
    this.watcher = chokidar.watch(this.outputDir, {
      ignored: [
        '**/.*', // Ignore dot files using a glob pattern string
        '**/node_modules/**' // Ignore node_modules
      ],
      persistent: true,
      ignoreInitial: true, // Don't emit events for initial scan
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait for file to stabilize for 100ms
        pollInterval: 100
      }
    });

    // Watch for file changes (add/change)
    this.watcher.on('add', this.handleFileChange.bind(this));
    this.watcher.on('change', this.handleFileChange.bind(this));

    this.isWatching = true;
    logger.success('Output directory watcher started');
  }

  /**
   * Stop watching the output directory
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      this.logger.info('Output directory watcher stopped');
    }
  }

  /**
   * Handle file changes in the output directory
   * @param filePath Path to the changed file
   */
  private handleFileChange(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    // Skip partials and temp files
    if (fileName.startsWith('_') || fileName.startsWith('.')) {
      return;
    }

    // Check if this file type should be excluded via config
    const excludeExtensions = this.config?.hotreload?.excludeExtensions;
    
    if (excludeExtensions && Array.isArray(excludeExtensions)) {
      // Case insensitive check for the extension
      const isExcluded = excludeExtensions.some(excludedExt => 
        excludedExt.toLowerCase() === ext.toLowerCase()
      );
      
      if (isExcluded) {
        this.logger.info(`Skipping reload for ${fileName} (extension ${ext} found in excludeExtensions)`);
        return; // Skip excluded extensions - exit early
      }
    }

    // Handle different file types
    if (ext === '.css') {
      this.logger.info(`Detected CSS change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('css', filePath);
    } else if (ext === '.js') {
      this.logger.info(`Detected JS change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    } else {
      // For any other file type (including HTML if not in excludeExtensions)
      this.logger.info(`Detected change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    }
  }
}
