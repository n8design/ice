import { IceConfig, HotReloadEventType } from '../types.js';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { BuildManager } from '../builders/index.js';
import { HotReloadManager } from '../hotreload/index.js';
import { Logger } from '../utils/logger.js';
import debounce from 'lodash.debounce';

const logger = new Logger('Watcher');

export class FileWatcher {
  private config: IceConfig;
  private watcher: FSWatcher | null = null;
  private buildManager: BuildManager;
  private hotReloadManager: HotReloadManager;
  // Add property for debounced function
  private debouncedProcessBuildFile;

  constructor(
    config: IceConfig, 
    buildManager: BuildManager,
    hotReloadManager: HotReloadManager
  ) {
    this.config = config;
    this.buildManager = buildManager;
    this.hotReloadManager = hotReloadManager;
    
    // Initialize debounced function
    const debounceTime = this.config.hotreload?.debounceTime ?? 300; // Use config or default
    this.debouncedProcessBuildFile = debounce(this.processBuildFile.bind(this), debounceTime);
  }

  async start(): Promise<void> {
    logger.info('Starting file watcher');
    
    // Determine watch paths
    const watchPaths = this.config.watch?.paths || ['src'];
    const ignored = this.config.watch?.ignored || ['node_modules', '.git', 'dist'];
    
    logger.info(`Watching paths: ${watchPaths.join(', ')}`);
    
    // Initialize chokidar
    this.watcher = chokidar.watch(watchPaths, {
      ignored,
      persistent: true,
      ignoreInitial: true
    });
    
    // Set up event handlers
    this.watcher.on('change', filepath => this.handleChange(filepath));
    this.watcher.on('add', filepath => this.handleAdd(filepath));
    this.watcher.on('unlink', filepath => this.handleUnlink(filepath));
    this.watcher.on('error', (error) => {
      if (error instanceof Error) {
        logger.error(`Watcher error: ${error.message}`);
      } else {
        logger.error(`Watcher error: ${JSON.stringify(error)}`);
      }
    });
    
    logger.success('File watcher started');
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      logger.info('File watcher stopped');
    }
  }

  private async handleChange(filepath: string): Promise<void> {
    logger.info(`File changed: ${filepath}`);
    await this.debouncedProcessBuildFile(filepath);
  }

  private async handleAdd(filepath: string): Promise<void> {
    logger.info(`File added: ${filepath}`);
    await this.debouncedProcessBuildFile(filepath);
  }

  private async handleUnlink(filepath: string): Promise<void> {
    logger.info(`File deleted: ${filepath}`);
    // For now, we just log the deletion
    // In a more advanced implementation, we might want to delete the corresponding output file
  }

  private getReloadType(filepath: string): HotReloadEventType {
    const ext = path.extname(filepath);
    
    if (ext === '.css' || ext === '.scss' || ext === '.sass') {
      return HotReloadEventType.CSS_UPDATE;
    } else {
      return HotReloadEventType.FULL_RELOAD;
    }
  }

  private async processBuildFile(filepath: string): Promise<void> {
    try {
      const builder = this.buildManager.getBuilderForFile(filepath);
      
      if (!builder) {
        logger.warn(`No builder found for file: ${filepath}`);
        
        // If it's an HTML file, trigger a full page reload
        if (path.extname(filepath) === '.html') {
          this.hotReloadManager.sendReloadEvent({
            type: HotReloadEventType.FULL_RELOAD,
            path: filepath
          });
        }
        return;
      }
      
      // Build the file
      await builder.buildFile(filepath);
      
      // Determine reload type based on file extension
      const reloadType = this.getReloadType(filepath);
      
      // For SCSS partials, get parent files
      const isPartial = path.basename(filepath).startsWith('_') && 
                       (path.extname(filepath) === '.scss' || path.extname(filepath) === '.sass');
      
      if (isPartial) {
        // For partials, we need to get the main files that include this partial
        // This information should come from the SCSS builder's dependency tracking
        const parentCssFiles = await this.getParentCssFiles(filepath);
        
        logger.info(`Partial ${path.basename(filepath)} is used in ${parentCssFiles.length} CSS files`);
        
        // Send reload events for each parent CSS file
        for (const cssFile of parentCssFiles) {
          this.hotReloadManager.sendReloadEvent({
            type: reloadType,
            path: cssFile
          });
        }
      } else {
        // Regular file - convert SCSS path to CSS path for hot reload
        let reloadPath = filepath;
        if (path.extname(filepath) === '.scss' || path.extname(filepath) === '.sass') {
          // Map to the output CSS path
          const sourceDirs = this.config.watch?.paths || ['src'];
          let sourceDir = '';
          
          // Find which source directory this file is in
          for (const dir of sourceDirs) {
            if (filepath.startsWith(dir)) {
              sourceDir = dir;
              break;
            }
          }
          
          if (sourceDir) {
            // Calculate relative path without the source directory prefix
            const relativeOutputPath = path.relative(sourceDir, filepath);
            // Create the output CSS path
            reloadPath = path.join(
              this.config.output.path,
              relativeOutputPath.replace(/\.s[ac]ss$/, '.css')
            );
          } else {
            // Fallback: just replace extension
            reloadPath = filepath.replace(/\.s[ac]ss$/, '.css');
          }
        }
        
        // Send reload event with the correct path
        this.hotReloadManager.sendReloadEvent({
          type: reloadType,
          path: reloadPath
        });
      }
    } catch (error: any) {
      logger.error(`Failed to process file ${filepath}: ${error.message}`);
    }
  }

  // New helper method to get parent CSS files for a partial
  private async getParentCssFiles(partialPath: string): Promise<string[]> {
    try {
      // Get access to the SCSS builder's dependency information
      const scssBuilder = this.buildManager.getScssBuilder();
      if (!scssBuilder) {
        return [];
      }
      
      // Get the parent SCSS files that import this partial
      const parentScssFiles = await scssBuilder.getParentFiles(partialPath);
      
      // Convert parent SCSS files to their output CSS paths
      const parentCssFiles = parentScssFiles.map(scssPath => {
        const sourceDirs = this.config.watch?.paths || ['src'];
        let sourceDir = '';
        
        // Find which source directory this file is in
        for (const dir of sourceDirs) {
          if (scssPath.startsWith(dir)) {
            sourceDir = dir;
            break;
          }
        }
        
        if (sourceDir) {
          // Calculate relative path without the source directory prefix
          const relativeOutputPath = path.relative(sourceDir, scssPath);
          // Create the output CSS path
          return path.join(
            this.config.output.path,
            relativeOutputPath.replace(/\.s[ac]ss$/, '.css')
          );
        } else {
          // Fallback: just replace extension
          return scssPath.replace(/\.s[ac]ss$/, '.css');
        }
      });
      
      return parentCssFiles;
    } catch (error) {
      logger.error(`Failed to get parent CSS files: ${error}`);
      return [];
    }
  }
}
