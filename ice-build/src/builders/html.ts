import { Builder } from '../types.js';
import { IceConfig } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { glob } from 'glob';
import { Logger } from '../utils/logger.js';

const logger = new Logger('HTML');

/**
 * HTML Builder class
 * Handles processing HTML files and injecting hot reload support
 */
export class HTMLBuilder implements Builder {
  private config: IceConfig;
  private outputDir: string;
  private hotReloadEnabled: boolean;

  constructor(config: IceConfig, outputDir?: string) {
    this.config = config;
    
    // Determine output directory
    if (outputDir) {
      this.outputDir = outputDir;
    } else if (typeof this.config.output === 'string') {
      this.outputDir = this.config.output;
    } else if (this.config.output && typeof this.config.output === 'object' && 'path' in this.config.output) {
      this.outputDir = this.config.output.path;
    } else {
      this.outputDir = 'public';
    }
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      try {
        fs.mkdirSync(this.outputDir, { recursive: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to create output directory: ${errorMessage}`);
      }
    }
    
    // Check if hot reload is enabled
    this.hotReloadEnabled = Boolean(this.config.hotreload?.enabled);
  }

  /**
   * Build all HTML files
   */
  public async build(): Promise<void> {
    logger.info('Building HTML files');
    
    try {
      // Get HTML file patterns from config
      const patterns = this.config.input.html || [];
      
      if (patterns.length === 0) {
        logger.info('No HTML patterns defined in config, skipping HTML processing');
        return;
      }
      
      const htmlFiles = [];
      for (const pattern of patterns) {
        try {
          const files = await glob(pattern);
          htmlFiles.push(...files);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to find HTML files with pattern ${pattern}: ${errorMessage}`);
        }
      }
      
      if (htmlFiles.length === 0) {
        logger.info('No HTML files found');
        return;
      }
      
      logger.info(`Found ${htmlFiles.length} HTML files to process`);
      
      // Process each HTML file
      for (const file of htmlFiles) {
        await this.buildFile(file);
      }
      
      logger.success('HTML build complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`HTML build failed: ${errorMessage}`);
    }
  }

  /**
   * Build a single HTML file
   */
  public async buildFile(filePath: string): Promise<void> {
    try {
      logger.info(`Processing HTML file: ${filePath}`);
      
      // Read HTML file
      const content = await fsPromises.readFile(filePath, 'utf-8');
      
      // Determine output path
      const relativePath = path.relative(process.cwd(), filePath);
      const outputPath = path.join(this.outputDir, relativePath);
      const outputDir = path.dirname(outputPath);
      
      // Create output directory if it doesn't exist
      await fsPromises.mkdir(outputDir, { recursive: true });
      
      // Process HTML content
      let processedContent = content;
      
      // Inject hot reload script if enabled
      if (this.hotReloadEnabled) {
        processedContent = this.injectHotReloadScript(processedContent);
      }
      
      // Write processed content to output file
      await fsPromises.writeFile(outputPath, processedContent, 'utf-8');
      
      logger.success(`HTML file processed: ${outputPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process HTML file ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Process a file change
   */
  public async processChange(filePath: string): Promise<void> {
    return this.buildFile(filePath);
  }

  /**
   * Inject hot reload script into HTML content
   * Uses the ice-hotreloader package's script
   */
  private injectHotReloadScript(content: string): string {
    const port = this.config.hotreload?.port || 3001;
    const host = this.config.hotreload?.host || 'localhost';
    
    const hotReloadScript = `
    <!-- Ice-Build Hot Reload -->
    <script src="http://${host}:${port}/ice-hotreload.js"></script>`;
    
    // Try to inject before </head>
    const headIndex = content.indexOf('</head>');
    if (headIndex !== -1) {
      return content.slice(0, headIndex) + hotReloadScript + content.slice(headIndex);
    }
    
    // If </head> not found, try to inject before </body>
    const bodyIndex = content.indexOf('</body>');
    if (bodyIndex !== -1) {
      return content.slice(0, bodyIndex) + hotReloadScript + content.slice(bodyIndex);
    }
    
    // If neither tag found, just append to the end
    logger.warn('Could not find </head> or </body> in HTML file, appending hot reload script to the end');
    return content + hotReloadScript;
  }
}
