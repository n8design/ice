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
 * 
 * Batching:
 * - File changes are batched together to avoid multiple rapid-fire hot reload notifications.
 * - The batch delay can be configured via `config.hotreload.batchDelay` (default: 150ms).
 * - CSS changes are processed individually as they're less disruptive than full page reloads.
 * - Multiple full reload changes are consolidated into a single full reload notification.
 */
export class OutputWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private outputDir: string;
  private isWatching = false;
  private hotReloadServer: HotReloadServer;
  private config: any;
  private logger: Logger;
  
  // Batching properties for pooling file changes
  private pendingChanges: Set<string> = new Set();
  private batchTimer: NodeJS.Timeout | null = null;
  private batchDelay: number = 150; // ms to wait before sending batched updates

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
    
    // Configure batch delay (default 150ms, configurable via config.hotreload.batchDelay)
    // Use ?? instead of || to properly handle 0 as a valid value
    this.batchDelay = config?.hotreload?.batchDelay ?? 150;
    
    logger.debug(`OutputWatcher initialized for directory: ${outputDir}`);
    logger.debug(`Batch delay set to ${this.batchDelay}ms`);
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
    
    // Clear any pending batch operations
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingChanges.clear();
  }

  /**
   * Handle file changes in the output directory
   * @param filePath Path to the changed file
   */
  private handleFileChange(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.outputDir, filePath);

    this.logger.debug(`🔍 Processing file change: ${fileName} (${ext})`);
    
    // Skip partials and temp files
    if (fileName.startsWith('_') || fileName.startsWith('.')) {
      this.logger.debug(`⏭️ Skipping partial/temp file: ${fileName}`);
      return;
    }
    
    // Direct extension checks first (most efficient)
    // Check if this type of file is explicitly excluded by extension
    if (['.html', '.htm', '.hbs'].includes(ext)) {
      // First check if HTML is disabled in config
      if (this.config?.html?.disabled === true) {
        this.logger.debug(`🛑 Skipping HTML file (html.disabled=true): ${fileName}`);
        return;
      }
      
      // Then check if these extensions are explicitly excluded
      if (Array.isArray(this.config?.hotreload?.excludeExtensions)) {
        // Check case-insensitive extension matching
        const extensionsLowerCase = this.config.hotreload.excludeExtensions.map((e: any) => 
          typeof e === 'string' ? e.toLowerCase() : e
        );
        
        if (extensionsLowerCase.includes(ext.toLowerCase())) {
          this.logger.debug(`⏭️ Direct extension match: skipping ${ext} file: ${fileName}`);
          return;
        }
      }
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
      // Normalize extensions to lowercase for comparison
      const extLowerCase = ext.toLowerCase();
      const excludeExtensionsLower = excludeExtensions
        .filter(e => typeof e === 'string')
        .map(e => e.toLowerCase());
      
      // Check if current file extension is in the excludeExtensions list
      if (excludeExtensionsLower.includes(extLowerCase)) {
        this.logger.debug(`🛑 Excluded by hotreload.excludeExtensions: ${fileName} (extension ${ext})`);
        return;
      }
    }

    // FINAL SAFETY CHECK: Make absolutely sure HTML files never trigger reloads
    // This is a last-resort check in case any HTML files slip through the earlier filters
    if (['.html', '.htm', '.hbs'].includes(ext)) {
      const htmlExcluded = Array.isArray(this.config?.hotreload?.excludeExtensions) && 
                          this.config.hotreload.excludeExtensions.some((e: any) => 
                            typeof e === 'string' && 
                            e.toLowerCase() === ext.toLowerCase());
                            
      // Force exclude all HTML files if configured to do so or if HTML is disabled
      if (htmlExcluded || this.config?.html?.disabled === true) {
        this.logger.debug(`🛑 FINAL SAFETY: Blocking HTML file from triggering reload: ${fileName}`);
        return;
      } else {
        // Only log configuration warning in verbose/debug mode to avoid spam
        this.logger.debug(`⚠️ HTML file not excluded by config - check your configuration: ${fileName}`);
      }
    }
    
    // At this point, we've passed all the exclusion checks,
    // so the file should trigger a hot reload
    
    // FINAL SAFETY: Block all HTML files regardless of configuration
    // This ensures HTML files NEVER trigger hot reloads
    if (['.html', '.htm', '.hbs'].includes(ext)) {
      this.logger.debug(`🛑 ABSOLUTE BLOCK: HTML files are completely disabled for hot reload: ${fileName}`);
      return;
    }
    
    // Handle different file types (HTML files are blocked above)
    if (ext === '.css') {
      this.logger.info(`Detected CSS change in output: ${fileName}`);
      this.batchFileChange('css', filePath);
    } else if (ext === '.js') {
      this.logger.info(`Detected JS change in output: ${fileName}`);
      this.batchFileChange('full', filePath);
    } else {
      // For any other file type (HTML files are already blocked above)
      this.logger.info(`Detected change in output: ${fileName}`);
      this.batchFileChange('full', filePath);
    }
  }

  /**
   * Batch file changes to avoid multiple rapid-fire hot reload notifications
   * @param type The type of reload ('css' or 'full')
   * @param filePath Path to the changed file
   */
  private batchFileChange(type: 'css' | 'full', filePath: string): void {
    const changeKey = `${type}:${filePath}`;
    this.pendingChanges.add(changeKey);
    
    this.logger.debug(`Batching change: ${changeKey}, batchDelay: ${this.batchDelay}`);
    
    // If batch delay is 0, process immediately (useful for testing)
    if (this.batchDelay === 0) {
      this.logger.debug(`Processing immediately (batchDelay=0)`);
      this.processBatchedChanges();
      return;
    }
    
    // Clear existing timer and start a new one
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
      this.processBatchedChanges();
    }, this.batchDelay);
  }

  /**
   * Force processing of any pending batched changes immediately.
   * Useful for testing or when you need to ensure all changes are processed.
   */
  public flushBatchedChanges(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.processBatchedChanges();
  }

  /**
   * Process all batched file changes and send appropriate notifications
   */
  private processBatchedChanges(): void {
    this.logger.debug(`Processing batched changes: ${this.pendingChanges.size} pending`);
    
    if (this.pendingChanges.size === 0) {
      this.logger.debug(`No pending changes to process`);
      return;
    }

    // Group changes by type
    const cssChanges: string[] = [];
    const fullChanges: string[] = [];
    
    for (const changeKey of this.pendingChanges) {
      const [type, filePath] = changeKey.split(':', 2);
      if (type === 'css') {
        cssChanges.push(filePath);
      } else {
        fullChanges.push(filePath);
      }
    }
    
    // Send notifications - prioritize CSS changes as they're less disruptive
    if (cssChanges.length > 0) {
      if (cssChanges.length === 1) {
        this.logger.info(`📤 Batched CSS refresh: ${path.basename(cssChanges[0])}`);
        this.hotReloadServer.notifyClients('css', cssChanges[0]);
      } else {
        this.logger.info(`📤 Batched CSS refresh: ${cssChanges.length} files`);
        // For multiple CSS files, we could either send individual notifications
        // or send a single full reload. CSS reload is generally safe for multiple files.
        cssChanges.forEach(filePath => {
          this.hotReloadServer.notifyClients('css', filePath);
        });
      }
    }
    
    // If there are any full reload changes, send a single full reload
    if (fullChanges.length > 0) {
      if (fullChanges.length === 1) {
        this.logger.info(`📤 Batched full refresh: ${path.basename(fullChanges[0])}`);
        this.hotReloadServer.notifyClients('full', fullChanges[0]);
      } else {
        this.logger.info(`📤 Batched full refresh: ${fullChanges.length} files`);
        // For multiple full reloads, just send one full reload notification
        this.hotReloadServer.notifyClients('full', fullChanges[0]);
      }
    }
    
    // Clear the batch
    this.pendingChanges.clear();
    this.batchTimer = null;
  }

  /**
   * Helper method to match a glob pattern against a file path or name
   * @param globPattern The glob pattern to match against
   * @param filePath The file path to check
   * @param fileName Optional file name to check separately
   * @returns True if the file matches the pattern
   */
  private matchGlobPattern(globPattern: string, filePath: string, fileName?: string): boolean {
    // Normalize paths for comparison
    const normalizedFilePath = filePath.toLowerCase();
    const normalizedPattern = globPattern.toLowerCase();
    
    // Special handling for HTML and HBS files when matching patterns
    const htmlExtensions = ['.html', '.htm', '.hbs'];
    const fileExt = path.extname(filePath).toLowerCase();
    
    // Common HTML pattern matching
    if (htmlExtensions.includes(fileExt)) {
      // Match extension-only patterns (e.g. ".html" matches any HTML file)
      if (htmlExtensions.includes(normalizedPattern)) {
        return true;
      }
      
      // Match common HTML glob patterns
      const commonHtmlPatterns = ['**/*.html', '**/*.htm', '**/*.hbs', '*.html', '*.htm', '*.hbs'];
      if (commonHtmlPatterns.includes(normalizedPattern)) {
        return htmlExtensions.includes(fileExt);
      }
    }
    
    // Normalize patterns like "**/*.html" to match files in any directory
    if (normalizedPattern.startsWith('**/')) {
      // If we're matching a pattern like "**/*.html", check if the file ends with the extension
      const extensionMatch = normalizedPattern.match(/\*\*\/\*(\.\w+)$/);
      if (extensionMatch && extensionMatch[1]) {
        const extensionToMatch = extensionMatch[1].toLowerCase();
        if (normalizedFilePath.endsWith(extensionToMatch) || 
            (fileName && fileName.toLowerCase().endsWith(extensionToMatch))) {
          return true;
        }
      }
    }
    
    // Handle extension-only patterns like ".html", ".hbs"
    if (normalizedPattern.startsWith('.') && !normalizedPattern.includes('/') && !normalizedPattern.includes('*')) {
      if (normalizedFilePath.endsWith(normalizedPattern) || 
          (fileName && fileName.toLowerCase().endsWith(normalizedPattern))) {
        return true;
      }
    }
    
    // For patterns like "source/**/*.html" or "public/**/*.html", extract just the extension
    const fullPathExtensionMatch = normalizedPattern.match(/\*\*\/\*(\.\w+)$/);
    if (fullPathExtensionMatch && fullPathExtensionMatch[1]) {
      const extensionToMatch = fullPathExtensionMatch[1].toLowerCase();
      if (normalizedFilePath.endsWith(extensionToMatch) || 
          (fileName && fileName.toLowerCase().endsWith(extensionToMatch))) {
        return true;
      }
    }
    
    // Add special handling for patterns with just extension (e.g., "html", without the dot)
    const extensionWithoutDot = normalizedPattern.match(/^(\w+)$/);
    if (extensionWithoutDot && extensionWithoutDot[1]) {
      const extToMatch = `.${extensionWithoutDot[1].toLowerCase()}`;
      if (fileExt === extToMatch) {
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
    
    const regex = new RegExp(`^${regexPattern}$`, 'i'); // Case insensitive matching
    
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
