import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultConfig } from './defaults.js';
import { IceConfig } from '../types.js';
import { Logger } from '../utils/logger.js';
import { pathToFileURL } from 'url';

const logger = new Logger('Config');

export class ConfigManager {
  private config: IceConfig;
  private configPath: string | null = null;

  constructor(configPath?: string) {
    // Initialize with default config and then try to load custom config
    this.config = { ...defaultConfig };
    
    try {
      // Non-async initialization - for constructor
      const configFilePath = this.resolveConfigPath(configPath);
      if (configFilePath) {
        this.configPath = configFilePath;
        
        try {
          // In a non-ESM context, we could do a require here
          // But since we're in ESM, we'll load synchronously if possible
          // or keep the default and log a warning
          
          // For immediate constructor usage, we'll stick with default config
          logger.info(`Config file found at ${configFilePath}, will load asynchronously`);
          
          // Trigger async load but don't wait for it
          this.loadConfigAsync(configFilePath).then(loadedConfig => {
            this.config = loadedConfig;
          }).catch(error => {
            logger.error(`Failed to load config: ${error.message}`);
          });
        } catch (error: any) {
          logger.error(`Error loading config: ${error.message}`);
        }
      }
    } catch (error: any) {
      logger.error(`Config initialization error: ${error.message}`);
    }
  }

  // Resolve config file path
  private resolveConfigPath(configPath?: string): string | null {
    // If explicit path provided, try that
    if (configPath) {
      if (fs.existsSync(configPath)) {
        return path.resolve(configPath);
      }
      logger.warn(`Specified config file not found: ${configPath}`);
    }
    
    // Try common config file names in current directory
    const commonConfigNames = ['ice.config.js', 'ice.config.mjs', 'ice.config.cjs'];
    const currentDir = process.cwd();
    
    for (const name of commonConfigNames) {
      const filePath = path.join(currentDir, name);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    
    return null;
  }

  // Async method to load config
  private async loadConfigAsync(configFilePath: string): Promise<IceConfig> {
    try {
      // Convert the filepath to a URL format for ESM imports
      const fileUrl = pathToFileURL(configFilePath).href;
      
      logger.info(`Loading config from ${configFilePath}`);
      
      // Use the URL format for dynamic import
      const userConfig = await import(fileUrl);
      const config = userConfig.default || userConfig;
      
      // Merge with default config
      const mergedConfig = this.mergeConfigs(defaultConfig, config);
      logger.info('Custom configuration loaded and merged with defaults');
      return mergedConfig;
    } catch (error: any) {
      logger.error(`Failed to load configuration: ${error.message}`);
      throw error;
    }
  }

  // Deep merge utility (renamed to match the existing usage)
  private mergeConfigs(target: any, source: any): any {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeConfigs(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  public getConfig(): IceConfig {
    return this.config;
  }

  public getOutputPath(): string {
    const currentDir = process.cwd();
    return path.resolve(currentDir, this.config.output.path);
  }
}

// Helper function to check if value is an object
function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}
