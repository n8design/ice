import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IceConfig } from '../types.js';
import { Logger } from '../utils/logger.js';
import { pathToFileURL } from 'url';

const logger = new Logger('Config');

export class ConfigManager {
  private config: IceConfig;
  private configPath: string | null = null;

  constructor(configPath?: string) {
    // Set up a basic initial config
    this.config = {
      input: {
        ts: ['source/**/*.ts', 'source/**/*.tsx'],
        scss: ['source/**/*.scss', 'source/**/*.sass'],
        html: []
      },
      output: {
        path: 'public'
      },
      sass: {
        sourceMap: true,
        style: 'expanded'
      }
    };
    
    try {
      // Find and load config file
      const configFile = configPath || this.findConfigFile();
      if (configFile) {
        this.configPath = configFile;
        logger.info(`Found config file: ${configFile}`);
        
        // Load the config file synchronously for immediate use
        this.loadConfigSync(configFile);
      } else {
        logger.warn('No config file found, using defaults');
      }
    } catch (error) {
      logger.error(`Config error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Find config file in current directory
  private findConfigFile(): string | null {
    const currentDir = process.cwd();
    const configPaths = [
      path.join(currentDir, 'ice.config.js'),
      path.join(currentDir, 'ice.config.mjs'),
      path.join(currentDir, 'ice.config.cjs')
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    
    return null;
  }

  // Modern config loading - supports both ESM and CommonJS
  private async loadConfigAsync(configFile: string): Promise<void> {
    try {
      const fileContent = fs.readFileSync(configFile, 'utf-8');
      
      // Check if it's an ESM module
      const isEsm = fileContent.includes('export default') || fileContent.includes('export const');
      
      if (isEsm) {
        try {
          // Use dynamic import directly with file URL
          const fileUrl = pathToFileURL(configFile).href;
          const importedModule = await import(fileUrl);
          const config = importedModule.default || importedModule;
          
          this.applyConfig(config);
          logger.info('Config loaded successfully via ESM import');
        } catch (esmError) {
          logger.error(`ESM import failed: ${esmError}`);
          
          // Fall back to regex-based extraction
          logger.warn('Falling back to regex-based config extraction');
          const extractedConfig = this.extractConfigFromContent(fileContent);
          this.applyConfig(extractedConfig);
        }
      } else {
        // CommonJS approach
        try {
          const userConfig = require(configFile);
          const config = userConfig.default || userConfig;
          this.applyConfig(config);
          logger.info('Config loaded successfully via CommonJS require');
        } catch (cjsError) {
          logger.error(`CommonJS require failed: ${cjsError}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to load config: ${error}`);
      logger.warn('Using default configuration');
    }
  }
  
  // Use a synchronous wrapper for backward compatibility
  private loadConfigSync(configFile: string): any {
    // Use a simple regex-based approach for sync loading
    let config = {};
    try {
      const content = fs.readFileSync(configFile, 'utf-8');
      // Simple extraction for common patterns
      config = this.extractConfigFromContent(content);
    } catch (error) {
      logger.error(`Config load failed: ${error}`);
    }
    return config;
  }

  // Apply config with simple merging
  private applyConfig(userConfig: any): void {
    // Ensure proper structure
    if (userConfig.input) {
      // Handle input paths
      if (userConfig.input.path) {
        const inputPath = userConfig.input.path;
        // Create glob patterns from input path
        this.config.input.ts = [`${inputPath}/**/*.ts`, `${inputPath}/**/*.tsx`];
        this.config.input.scss = [`${inputPath}/**/*.scss`, `${inputPath}/**/*.sass`];
        logger.debug(`Set input paths from ${inputPath}: ts=[${this.config.input.ts}], scss=[${this.config.input.scss}]`);
      }
      
      // Still allow specific overrides
      if (Array.isArray(userConfig.input.ts)) {
        this.config.input.ts = userConfig.input.ts;
        logger.debug(`Overrode TS input paths with: [${this.config.input.ts.join(', ')}]`);
      }
      
      if (Array.isArray(userConfig.input.scss)) {
        this.config.input.scss = userConfig.input.scss;
        logger.debug(`Overrode SCSS input paths with: [${this.config.input.scss.join(', ')}]`);
      }
    }
    
    // Set output path - fixed to handle string or object
    if (userConfig.output) {
      if (typeof userConfig.output === 'string') {
        // If user provided output as string, store it as object
        this.config.output = { path: userConfig.output };
      } else if (userConfig.output.path) {
        // If output is object, ensure our config output is also object
        if (typeof this.config.output === 'string') {
          this.config.output = { path: userConfig.output.path };
        } else {
          this.config.output.path = userConfig.output.path;
        }
        
        // Copy filenames if provided
        if (userConfig.output.filenames) {
          this.config.output.filenames = userConfig.output.filenames;
        }
      }
    }
    
    // Set SASS options
    if (userConfig.sass || userConfig.scss) {
      const sassConfig = userConfig.sass || userConfig.scss;
      this.config.sass = {
        ...this.config.sass,
        ...sassConfig
      };
    }
    
    logger.debug(`Applied config: ${JSON.stringify(this.config, null, 2)}`);
  }

  public getConfig(): IceConfig {
    return this.config;
  }

  /**
   * Get the output path from the configuration
   */
  public getOutputPath(): string {
    const currentDir = process.cwd();
    let outputPath: string;
    
    if (typeof this.config.output === 'string') {
      outputPath = this.config.output;
    } else {
      outputPath = this.config.output.path;
    }
    
    return path.resolve(currentDir, outputPath);
  }

  /**
   * Check if a file is an ESM module
   */
  private async isEsmModule(filePath: string): Promise<boolean> {
    try {
      // Check for ESM indicators in the file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Look for export statements
      if (content.includes('export default') || content.includes('export const')) {
        return true;
      }
      
      // Check for package.json in the same directory with type: module
      const dirPath = path.dirname(filePath);
      const packageJsonPath = path.join(dirPath, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
        if (packageJson.type === 'module') {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.warn(`Error checking if file is ESM module: ${error}`);
      return false;
    }
  }
  
  /**
   * Load CommonJS config file
   */
  private async loadCommonJSConfig(filePath: string): Promise<any> {
    try {
      // Use require() for CommonJS modules
      const userConfig = require(filePath);
      return userConfig.default || userConfig;
    } catch (error) {
      logger.error(`Failed to load CommonJS config: ${error}`);
      return {};
    }
  }
  
  /**
   * Extract config from file content using regex patterns
   */
  private extractConfigFromContent(content: string): any {
    const config: any = { input: {}, output: {} };
    
    try {
      // Extract input path
      const inputPathMatch = content.match(/input\s*:\s*{[^}]*path\s*:\s*['"]([^'"]+)['"]/s);
      if (inputPathMatch && inputPathMatch[1]) {
        config.input.path = inputPathMatch[1];
      } else {
        config.input.path = 'source';
      }
      
      // Extract output path
      const outputObjectMatch = content.match(/output\s*:\s*{[^}]*path\s*:\s*['"]([^'"]+)['"]/s);
      if (outputObjectMatch && outputObjectMatch[1]) {
        config.output.path = outputObjectMatch[1];
      } else {
        const outputStringMatch = content.match(/output\s*:\s*['"]([^'"]+)['"]/);
        if (outputStringMatch && outputStringMatch[1]) {
          config.output = outputStringMatch[1];
        } else {
          config.output.path = 'public';
        }
      }
      
      // Extract sass/scss options if present
      const sassMatch = content.match(/sass\s*:\s*(\{[^{}]*\})/);
      const scssMatch = content.match(/scss\s*:\s*(\{[^{}]*\})/);
      
      if (sassMatch || scssMatch) {
        config.sass = {};
        
        // Extract source map setting
        const sourceMapMatch = content.match(/sourceMap\s*:\s*(true|false)/);
        if (sourceMapMatch) {
          config.sass.sourceMap = sourceMapMatch[1] === 'true';
        }
        
        // Extract style setting
        const styleMatch = content.match(/style\s*:\s*['"]([^'"]+)['"]/);
        if (styleMatch) {
          config.sass.style = styleMatch[1];
        }
      }
    } catch (error) {
      logger.error(`Error extracting config from content: ${error}`);
    }
    
    return config;
  }

  private async loadConfig(configFile: string): Promise<any> {
    try {
      // For ESM modules
      if (configFile.endsWith('.mjs') || configFile.endsWith('.js')) {
        try {
          const fileUrl = pathToFileURL(configFile);
          const module = await import(fileUrl.href);
          return module.default || module;
        } catch (error) {
          logger.error(`ESM import failed: ${error}`);
          // Fall back to regex-based extraction
        }
      }
      
      // For CommonJS
      return require(configFile);
    } catch (error) {
      logger.error(`Failed to load config: ${error}`);
      return {}; // Return empty object as fallback
    }
  }
}
