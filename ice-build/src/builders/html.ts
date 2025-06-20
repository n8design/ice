import { Builder } from '../types.js';
import { IceConfig } from '../types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('HTML');

/**
 * HTML Builder class
 * Handles watching HTML changes and triggering CSS/JS rebuilds (Pattern Lab handles actual HTML building)
 */
export class HTMLBuilder implements Builder {
  private config: IceConfig;
  private scssBuilder: any = null;
  private tsBuilder: any = null;
  private isProcessing: boolean = false;

  constructor(config: IceConfig, outputDir?: string) {
    this.config = config;
    logger.info('HTML Builder initialized (watch-only mode for Pattern Lab integration)');
  }

  /**
   * Build all HTML files - No-op since Pattern Lab handles HTML building
   */
  public async build(): Promise<void> {
    logger.info('HTML build skipped - Pattern Lab handles HTML building');
  }

  /**
   * Build a single HTML file - No-op since Pattern Lab handles HTML building
   */
  public async buildFile(filePath: string): Promise<void> {
    logger.info(`HTML buildFile skipped for: ${filePath} - Pattern Lab handles HTML building`);
  }

  /**
   * Process a file change - Only trigger CSS/JS rebuilds
   */
  public async processChange(filePath: string): Promise<void> {
    // Prevent recursion
    if (this.isProcessing) {
      logger.warn(`HTML processChange already in progress, ignoring: ${filePath}`);
      return;
    }
    
    this.isProcessing = true;
    
    try {
      logger.info(`HTML change detected: ${filePath} - triggering CSS/JS rebuilds`);
      
      // Log debug info about builder availability
      logger.info(`SCSS builder available: ${!!this.scssBuilder}`);
      logger.info(`TS builder available: ${!!this.tsBuilder}`);
      
      // Trigger immediate CSS and JS builds
      if (this.scssBuilder && typeof this.scssBuilder.build === 'function') {
        logger.info('Triggering SCSS rebuild after HTML change');
        await this.scssBuilder.build();
      } else {
        logger.warn('SCSS builder not available or build method not found');
      }
      
      if (this.tsBuilder && typeof this.tsBuilder.build === 'function') {
        logger.info('Triggering TypeScript rebuild after HTML change');
        await this.tsBuilder.build();
      } else {
        logger.warn('TypeScript builder not available or build method not found');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Inject hot reload script into HTML content
   * Uses the ice-hotreloader package's script
   */
  private injectHotReloadScript(content: string): string {
    const port = this.config.hotreload?.port || 3001;
    const host = this.config.hotreload?.host || 'localhost';
    
    // Support both serving methods:
    // 1. Serve from node_modules (traditional method): /ice-hotreloader/dist/browser.min.js
    // 2. Serve from hot reload server (new method): http://localhost:3002/ice-hotreload.js
    const serveFromNodeModules = this.config.hotreload?.serveFromNodeModules ?? true;
    
    let hotReloadScript: string;
    
    if (serveFromNodeModules) {
      // Traditional method: serve from node_modules with global config
      hotReloadScript = `
    <!-- Ice-Build Hot Reload -->
    <script>
      // Configure hot reload connection
      window.ICE_HOTRELOAD_CONFIG = { port: ${port}, host: '${host}' };
    </script>
    <script src="/ice-hotreloader/dist/browser.min.js"></script>`;
    } else {
      // Alternative method: serve from hot reload server directly
      hotReloadScript = `
    <!-- Ice-Build Hot Reload -->
    <script>
      // Configure hot reload connection
      window.ICE_HOTRELOAD_CONFIG = { port: ${port}, host: '${host}' };
    </script>
    <script src="http://${host}:${port}/ice-hotreload.js"></script>`;
    }
    
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

  public setScssBuilder(builder: any) {
    logger.info('setScssBuilder called on HTMLBuilder');
    this.scssBuilder = builder;
  }

  public setTsBuilder(builder: any) {
    logger.info('setTsBuilder called on HTMLBuilder');
    this.tsBuilder = builder;
  }
}
