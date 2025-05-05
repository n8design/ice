import { EventEmitter } from 'events'; // Make sure EventEmitter is imported
import { IceConfig } from '../types.js';
import { SCSSBuilder } from './scss.js';
import { TypeScriptBuilder } from './typescript.js';
import { Logger } from '../utils/logger.js';
import path from 'path';
import { OutputWatcher } from '../watcher/output-watcher.js';

const logger = new Logger('Builder');

// Define an interface for HTMLBuilder to ensure type safety
interface HTMLBuilderInterface {
  build(): Promise<void>;
  buildFile(filePath: string): Promise<void>;
  processChange(filePath: string): Promise<void>;
}

// Create a fallback implementation
const createFallbackHTMLBuilder = (config: IceConfig, outputPath: string): HTMLBuilderInterface => {
  return {
    build: async () => {
      logger.info('HTML builder fallback - no action taken');
    },
    
    buildFile: async (filePath: string) => {
      logger.info(`HTML builder fallback - would process: ${filePath}`);
    },
    
    processChange: async (filePath: string) => {
      logger.info(`HTML builder fallback - would process change: ${filePath}`);
    }
  };
};

// Load the actual HTMLBuilder if available
let htmlBuilderModule: { HTMLBuilder?: any } = {};
try {
  htmlBuilderModule = require('./html.js');
} catch (e) {
  logger.warn('HTML builder module not found, will use fallback');
}

export class Builder extends EventEmitter {
  private config: IceConfig;
  private outputPath: string;
  private tsBuilder: TypeScriptBuilder;
  private scssBuilder: SCSSBuilder;
  private htmlBuilder: HTMLBuilderInterface;
  private outputWatcher: OutputWatcher | null = null;
  private hotReloadServer: any = null; // Add reference to the hotReloader

  constructor(config: IceConfig) {
    super(); // Call EventEmitter constructor
    this.config = config;
    
    // Fix the outputPath assignment to handle both string and object format
    if (typeof config.output === 'string') {
      this.outputPath = config.output;
    } else if (config.output && typeof config.output === 'object') {
      this.outputPath = config.output.path || 'public';
    } else {
      this.outputPath = 'public'; // Default
    }
    
    // Initialize builders
    this.tsBuilder = new TypeScriptBuilder(config, this.outputPath);
    this.scssBuilder = new SCSSBuilder(config, this.outputPath);
    
    // Try to initialize HTML builder safely
    try {
      if (htmlBuilderModule.HTMLBuilder) {
        this.htmlBuilder = new htmlBuilderModule.HTMLBuilder(config, this.outputPath);
      } else {
        this.htmlBuilder = createFallbackHTMLBuilder(config, this.outputPath);
      }
    } catch (e) {
      logger.warn(`Failed to initialize HTML builder: ${e instanceof Error ? e.message : String(e)}`);
      // Use the fallback builder
      this.htmlBuilder = createFallbackHTMLBuilder(config, this.outputPath);
    }
    
    // Initialize output watcher if enabled in config
    if (config.watchOutput !== false) {
      // Fix the path property access issue with proper type checking
      const outputDir = typeof config.output === 'string' 
        ? config.output 
        : (config.output && 'path' in config.output ? config.output.path : 'public');
        
      // We'll initialize the output watcher later when we have the hot reload server
      // Move this code to the setHotReloadServer method
      this.outputWatcher = null;
    }
  }

  // Add method to set the hot reload server
  public setHotReloadServer(server: any): void {
    this.hotReloadServer = server;
    
    // Now that we have the hot reload server, create the output watcher
    if (this.hotReloadServer) {
      // Get output directory
      const outputDir = typeof this.config.output === 'string' 
        ? this.config.output 
        : (this.config.output && 'path' in this.config.output ? this.config.output.path : 'public');
        
      // Create output watcher with both required arguments
      this.outputWatcher = new OutputWatcher(outputDir, this.hotReloadServer);
      
      // Start the watcher
      this.outputWatcher.start();
    }
  }

  /**
   * Build all files
   */
  public async buildAll(): Promise<void> {
    logger.info('Starting full build');
    const startTime = Date.now();
    
    // Build TypeScript, SCSS, and HTML in parallel
    await Promise.all([
      this.tsBuilder.build(),
      this.scssBuilder.build(),
      this.htmlBuilder.build()
    ]);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    logger.success(`Full build completed in ${duration}s`);
  }

  /**
   * Alias for buildAll for interface compatibility 
   */
  public async build(): Promise<void> {
    await this.buildAll();
  }

  /**
   * Clean all output files
   * This is called from the CLI and was missing
   */
  public async cleanAll(): Promise<void> {
    logger.info('Cleaning all output files');
    
    try {
      // Clean all output from each builder
      if (this.scssBuilder.clean) {
        await this.scssBuilder.clean();
      }
      
      if (typeof this.tsBuilder.clean === 'function') {
        await this.tsBuilder.clean();
      }
      
      logger.success('Cleaned all output files');
    } catch (error) {
      logger.error(`Failed to clean output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the appropriate builder for a file based on extension
   * @param filePath File path
   * @returns The appropriate builder or null if none found
   */
  public getBuilderForFile(filePath: string): SCSSBuilder | TypeScriptBuilder | HTMLBuilderInterface | null {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.ts' || ext === '.tsx') {
      return this.tsBuilder;
    } else if (ext === '.scss' || ext === '.sass') {
      return this.scssBuilder;
    } else if (ext === '.html') {
      return this.htmlBuilder;
    }
    
    return null;
  }

  /**
   * Get the SCSS builder
   */
  public getScssBuilder(): SCSSBuilder {
    return this.scssBuilder;
  }

  /**
   * Get the TypeScript builder
   */
  public getTsBuilder(): TypeScriptBuilder {
    return this.tsBuilder;
  }

  /**
   * Get the HTML builder
   */
  public getHtmlBuilder(): HTMLBuilderInterface {
    return this.htmlBuilder;
  }

  public startWatching(): void {
    // Start the output watcher if it exists
    if (this.outputWatcher) {
      this.outputWatcher.start();
    }
  }

  public stopWatching(): void {
    // Stop the output watcher if it exists
    if (this.outputWatcher) {
      this.outputWatcher.stop();
    }
  }
}

// Export builders
export * from './scss.js';
export * from './typescript.js';
export * from './html.js'; // Make sure HTML builder is properly exported
