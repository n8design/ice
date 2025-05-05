import * as path from 'path';
import * as chokidar from 'chokidar';
import { Logger } from '../utils/logger.js';
import { HotReloadServer } from '@n8d/ice-hotreloader';

const logger = new Logger('OutputWatcher');

/**
 * OutputWatcher watches the build destination folder and notifies
 * the hot reload server when output files change.
 */
export class OutputWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private outputDir: string;
  private isWatching = false;
  private hotReloadServer: HotReloadServer;

  /**
   * Create a new output folder watcher
   * @param outputDir The output directory to watch
   * @param hotReloadServer The hot reload server to notify
   */
  constructor(outputDir: string, hotReloadServer: HotReloadServer) {
    this.outputDir = outputDir;
    this.hotReloadServer = hotReloadServer;
    logger.debug(`OutputWatcher initialized for directory: ${outputDir}`);
  }

  /**
   * Start watching the output directory
   */
  public start(): void {
    if (this.isWatching) {
      return;
    }

    logger.info(`Starting to watch output directory: ${this.outputDir}`);

    // Initialize the watcher
    this.watcher = chokidar.watch(this.outputDir, {
      ignored: [
        '**/.*', // Fix: Ignore dot files using a glob pattern string instead of RegExp
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
      logger.info('Output directory watcher stopped');
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

    // Handle different file types
    if (ext === '.css') {
      logger.info(`Detected CSS change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('css', filePath);
    } else if (ext === '.js') {
      logger.info(`Detected JS change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    } else if (ext === '.html' || ext === '.htm') {
      logger.info(`Detected HTML change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    }
  }
}
