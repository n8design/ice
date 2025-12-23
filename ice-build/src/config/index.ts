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

  constructor() {
    // Only set up defaults, do NOT load any config file here
    this.config = {
      input: {
        ts: ['source/**/*.ts', 'source/**/*.tsx'],
        scss: ['source/**/*.scss', 'source/**/*.sass'],
        html: []
      },
      output: {
        path: 'public'
      },
      scss: {
        sourceMap: true
      }
    };
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
  
  // Apply config with simple merging
  public applyConfig(userConfig: any): void {
    logger.debug(`applyConfig called with userConfig: ${JSON.stringify(userConfig, null, 2)}`);
    logger.debug(`Before applying config, current HTML patterns: ${JSON.stringify(this.config.input.html)}`);
    
    // Ensure proper structure
    if (userConfig.input) {
      // Handle input paths
      if (userConfig.input.path) {
        const inputPath = userConfig.input.path;
        // Create glob patterns from input path
        this.config.input.ts = [`${inputPath}/**/*.ts`, `${inputPath}/**/*.tsx`];
        this.config.input.scss = [`${inputPath}/**/*.scss`, `${inputPath}/**/*.sass`];
        this.config.input.html = [`${inputPath}/**/*.html`];
        logger.debug(`HTML patterns set from input.path: ${JSON.stringify(this.config.input.html)}`);
        // Preserve the input.path for use by FileWatcher
        (this.config.input as any).path = inputPath;
        logger.debug(`Set input paths from ${inputPath}: ts=[${this.config.input.ts}], scss=[${this.config.input.scss}], html=[${this.config.input.html}]`);
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
      
      logger.debug(`Checking HTML patterns - userConfig.input.html: ${JSON.stringify(userConfig.input.html)}, isArray: ${Array.isArray(userConfig.input.html)}`);
      if (Array.isArray(userConfig.input.html)) {
        this.config.input.html = userConfig.input.html;
        logger.debug(`Overrode HTML input paths with: [${this.config.input.html?.join(', ')}]`);
      } else {
        logger.debug(`HTML patterns not overridden - userConfig.input.html is not an array`);
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
    
    // Set SASS/SCSS options
    if (userConfig.scss || userConfig.sass) {
      const scssOptions = userConfig.scss || userConfig.sass;
      logger.debug(`User SCSS/Sass options found: ${JSON.stringify(scssOptions, null, 2)}`);
      // Ensure this.config.scss exists
      if (!this.config.scss) {
        this.config.scss = {};
      }
      this.config.scss = {
        ...this.config.scss, // Keep existing defaults or previously set values
        ...scssOptions       // Override with user's options
      };
      logger.debug(`Applied SCSS/Sass options. Current this.config.scss: ${JSON.stringify(this.config.scss, null, 2)}`);
    } else {
      logger.debug('No user SCSS/Sass options found. Using defaults or existing this.config.scss.');
    }
    
    // Set hotreload options
    if (userConfig.hotreload) {
      logger.debug(`User hotreload options found: ${JSON.stringify(userConfig.hotreload, null, 2)}`);
      this.config.hotreload = { ...userConfig.hotreload };
      logger.debug(`Applied hotreload options: ${JSON.stringify(this.config.hotreload, null, 2)}`);
    } else {
      logger.debug('No user hotreload options found.');
    }

    // Set watch options
    if (userConfig.watch) {
      logger.debug(`User watch options found: ${JSON.stringify(userConfig.watch, null, 2)}`);
      this.config.watch = { ...userConfig.watch };
      logger.debug(`Applied watch options: ${JSON.stringify(this.config.watch, null, 2)}`);
    } else {
      logger.debug('No user watch options found.');
    }

    logger.debug(`Final applied config: ${JSON.stringify(this.config, null, 2)}`);
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

// --- Robust async config loader for CLI ---
/**
 * Loads the user's config file (ice.config.js/mjs/cjs) from the current working directory.
 * Supports ESM and CJS, object or function export.
 * Always returns a normalized IceConfig.
 */
export async function getConfig(configPath?: string): Promise<IceConfig> {
  const logger = new Logger('Config');
  let configFile = configPath;
  if (!configFile) {
    // Search for config file in CWD
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, 'ice.config.js'),
      path.join(cwd, 'ice.config.mjs'),
      path.join(cwd, 'ice.config.cjs')
    ];
    configFile = candidates.find(f => fs.existsSync(f));
  }
  if (!configFile) {
    logger.warn('No ice.config.js/mjs/cjs found. Using default config.');
    return new ConfigManager().getConfig();
  }
  logger.info(`Loading config from: ${configFile}`);
  let userConfig: any = {};
  try {
    if (configFile.endsWith('.mjs')) {
      const mod = await import(pathToFileURL(configFile).href);
      userConfig = mod.default || mod;
    } else if (configFile.endsWith('.js')) {
      try {
        const mod = await import(pathToFileURL(configFile).href);
        userConfig = mod.default || mod;
      } catch (e) {
        logger.debug('ESM import failed, trying require() for CJS...');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(configFile);
        userConfig = mod.default || mod;
      }
    } else if (configFile.endsWith('.cjs')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(configFile);
      userConfig = mod.default || mod;
    }
    if (typeof userConfig === 'function') {
      userConfig = await userConfig();
    }
    logger.debug('User config loaded: ' + JSON.stringify(userConfig, null, 2));
  } catch (err) {
    logger.error('Failed to load user config: ' + err);
    return new ConfigManager().getConfig();
  }
  // Merge/normalize
  const manager = new ConfigManager();
  manager.applyConfig(userConfig);
  logger.info('Final merged config: ' + JSON.stringify(manager.getConfig(), null, 2));
  return manager.getConfig();
}

// For compatibility, also export as default
export default { getConfig };
