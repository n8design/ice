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
 * - If the file is a .css file, the watcher will call `refreshCSS` on the hot reload server with the relative path.
 * - For all other file types, the watcher will call `reload` on the hot reload server.
 */
export class OutputWatcher {
  private outputDir: string;
  private hotReloadServer: any;
  private watcher: chokidar.FSWatcher | null;
  private config: any;
  private logger: Logger;

  /**
   * Create a new output folder watcher
   * @param outputDir The output directory to watch
   * @param hotReloadServer The hot reload server to notify
   * @param config Optional configuration object
   */
  constructor(outputDir: string, hotReloadServer: any, config: any = {}) {
    this.outputDir = outputDir;
    this.hotReloadServer = hotReloadServer;
    this.watcher = null;
    this.config = config;
    this.logger = new Logger('OutputWatcher');
  }

  /**
   * Start watching the output directory
   */
  public start(): void {
    this.logger.info(`Watching output directory: ${this.outputDir}`);

    // Initialize the watcher
    this.watcher = chokidar.watch(this.outputDir, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait for file to stabilize for 100ms
        pollInterval: 100
      }
    });

    this.watcher.on('change', (filePath: string) => {
      // Check if this file type should be excluded
      const ext = path.extname(filePath).toLowerCase();
      if (this.config?.hotreload?.excludeExtensions?.includes(ext)) {
        this.logger.debug(`Skipping excluded file: ${path.basename(filePath)}`);
        return; // Skip excluded extensions
      }

      const relativePath = path.relative(this.outputDir, filePath);
      this.logger.info(`Output file changed: ${relativePath}`);

      // Notify hot reload server of the change
      if (this.hotReloadServer) {
        if (ext === '.css') {
          this.hotReloadServer.refreshCSS(relativePath);
        } else {
          this.hotReloadServer.reload();
        }
      }
    });
  }

  /**
   * Stop watching the output directory
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.info('Output watching stopped');
    }
  }
}
