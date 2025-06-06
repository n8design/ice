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

    // Initialize the watcher with configuration-aware ignored patterns
    const defaultIgnored = [
      '**/.*', // Ignore dot files using a glob pattern string
      '**/node_modules/**' // Ignore node_modules
    ];
    
    // Merge configuration-provided ignore patterns with defaults
    const configIgnored = this.config?.watch?.ignored || [];
    const ignoredPatterns = Array.isArray(configIgnored) 
      ? [...defaultIgnored, ...configIgnored] 
      : defaultIgnored;
    
    this.logger.debug(`Ignoring file patterns: ${ignoredPatterns.join(', ')}`);
    
    this.watcher = chokidar.watch(this.outputDir, {
      ignored: ignoredPatterns,
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
    const relativePath = path.relative(this.outputDir, filePath);

    // Skip partials and temp files
    if (fileName.startsWith('_') || fileName.startsWith('.')) {
      this.logger.debug(`⏭️ Skipping partial/temp file: ${fileName}`);
      return;
    }
    
    // Direct extension checks first (most efficient)
    // Check if this type of file is explicitly excluded by extension
    if (['.html', '.htm', '.hbs'].includes(ext) && 
        Array.isArray(this.config?.hotreload?.excludeExtensions) &&
        this.config.hotreload.excludeExtensions.includes(ext)) {
      this.logger.debug(`⏭️ Direct extension match: skipping ${ext} file: ${fileName}`);
      return;
    }
    
    // Check for 'excludePaths' in configuration (custom, non-standard)
    // This is for backward compatibility with older configs
    const excludePaths = this.config?.watch?.excludePaths || [];
    if (Array.isArray(excludePaths) && excludePaths.length > 0) {
      for (const pattern of excludePaths) {
        if (typeof pattern === 'string' && this.matchGlobPattern(pattern, relativePath, fileName)) {
          this.logger.debug(`⛔ Skipping file matching watch.excludePaths pattern ${pattern}: ${fileName}`);
          return;
        }
      }
    }
    
    // Check if file matches any watch.ignored pattern
    // Even though chokidar should handle this, we do a double-check
    const watchIgnored = this.config?.watch?.ignored || [];
    if (Array.isArray(watchIgnored) && watchIgnored.length > 0) {
      for (const pattern of watchIgnored) {
        if (typeof pattern === 'string' && this.matchGlobPattern(pattern, relativePath, fileName)) {
          this.logger.debug(`⛔ Skipping file matching watch.ignored pattern ${pattern}: ${fileName}`);
          return;
        }
      }
    }

    // Check for excluded extensions from hotreload configuration
    const excludeExtensions = this.config?.hotreload?.excludeExtensions || [];
    if (Array.isArray(excludeExtensions) && excludeExtensions.length > 0) {
      // Check if current file extension is in the excludeExtensions list
      const matchingExclude = excludeExtensions.find(
        e => typeof e === 'string' && e.toLowerCase() === ext.toLowerCase()
      );
      
      if (matchingExclude) {
        this.logger.debug(`🛑 Excluded by hotreload.excludeExtensions: ${fileName} (extension ${ext})`);
        return;
      }
    }
    
    // Additional special handling for HTML, HBS files if they're explicitly disabled
    if (['.html', '.htm', '.hbs'].includes(ext)) {
      // If html is disabled in config, skip HTML-type files
      if (this.config?.html?.disabled === true) {
        this.logger.debug(`🛑 Skipping HTML file (html.disabled=true): ${fileName}`);
        return;
      }
    }

    // At this point, we've passed all the exclusion checks,
    // so the file should trigger a hot reload
    
    // Handle different file types
    if (ext === '.css') {
      this.logger.info(`Detected CSS change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('css', filePath);
    } else if (ext === '.js') {
      this.logger.info(`Detected JS change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    } else if (['.html', '.htm', '.hbs'].includes(ext)) {
      this.logger.info(`Detected HTML change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    } else {
      // For any other file type
      this.logger.info(`Detected change in output: ${fileName}`);
      this.hotReloadServer.notifyClients('full', filePath);
    }
  }

  /**
   * Helper method to match a glob pattern against a file path or name
   * @param globPattern The glob pattern to match against
   * @param filePath The file path to check
   * @param fileName Optional file name to check separately
   * @returns True if the file matches the pattern
   */
  private matchGlobPattern(globPattern: string, filePath: string, fileName?: string): boolean {
    // Normalize patterns like "**/*.html" to match files in any directory
    if (globPattern.startsWith('**/')) {
      // If we're matching a pattern like "**/*.html", check if the file ends with the extension
      const extensionMatch = globPattern.match(/\*\*\/\*(\.\w+)$/);
      if (extensionMatch && extensionMatch[1]) {
        const extensionToMatch = extensionMatch[1];
        if (filePath.endsWith(extensionToMatch) || (fileName && fileName.endsWith(extensionToMatch))) {
          return true;
        }
      }
    }
    
    // Handle extension-only patterns like ".html", ".hbs"
    if (globPattern.startsWith('.') && !globPattern.includes('/') && !globPattern.includes('*')) {
      if (filePath.endsWith(globPattern) || (fileName && fileName.endsWith(globPattern))) {
        return true;
      }
    }
    
    // For patterns like "source/**/*.html" or "public/**/*.html", extract just the extension
    const fullPathExtensionMatch = globPattern.match(/\*\*\/\*(\.\w+)$/);
    if (fullPathExtensionMatch && fullPathExtensionMatch[1]) {
      const extensionToMatch = fullPathExtensionMatch[1];
      if (filePath.endsWith(extensionToMatch) || (fileName && fileName.endsWith(extensionToMatch))) {
        return true;
      }
    }
    
    // Standard glob pattern matching (fallback for other patterns)
    // Convert glob pattern to a simple regex
    let regexPattern = globPattern
      .replace(/\./g, '\\.')    // Escape dots
      .replace(/\*\*/g, '.*')   // ** becomes .*
      .replace(/\*/g, '[^/]*'); // * becomes [^/]*
    
    // If the pattern doesn't start with a slash or drive letter, make it match anywhere in the path
    if (!regexPattern.startsWith('/') && !regexPattern.match(/^[a-zA-Z]:\\/)) {
      regexPattern = `.*${regexPattern}`;
    }
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Check if either the path or filename match
    if (regex.test(filePath)) {
      return true;
    }
    
    if (fileName && regex.test(fileName)) {
      return true;
    }
    
    return false;
  }
}
