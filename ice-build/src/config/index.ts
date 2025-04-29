import { IceConfig } from '../types.js';
import { defaultConfig } from './defaults.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deepMerge } from '../utils/helpers.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Config');

export class ConfigManager {
  private config: IceConfig;
  private readonly cwd: string;

  constructor(configPath?: string) {
    this.cwd = process.cwd();
    this.config = { ...defaultConfig };
    
    // If a specific config path is provided, use it
    if (configPath) {
      this.loadConfigFromPath(configPath);
    } else {
      this.loadUserConfig();
    }
  }

  private async loadUserConfig() {
    // Look for ice.config.js or ice.config.mjs in the project root
    const possiblePaths = [
      path.join(this.cwd, 'ice.config.mjs'),
      path.join(this.cwd, 'ice.config.js')
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        await this.loadConfigFromPath(configPath);
        return;
      }
    }
    
    logger.info('No custom configuration found, using defaults');
  }

  private async loadConfigFromPath(configPath: string) {
    try {
      const userConfigPath = path.isAbsolute(configPath) 
        ? configPath 
        : path.resolve(this.cwd, configPath);
      
      logger.info(`Loading config from ${userConfigPath}`);
      
      if (!fs.existsSync(userConfigPath)) {
        throw new Error(`Config file not found at ${userConfigPath}`);
      }

      // Import the user config (works with ESM)
      const userConfigModule = await import(userConfigPath);
      
      // Extract the default export or the config object
      const userConfig = userConfigModule.default || userConfigModule;
      
      // Merge with defaults
      this.config = deepMerge(defaultConfig, userConfig);
      
      logger.info('Custom configuration loaded and merged with defaults');
    } catch (error: any) {
      logger.error(`Failed to load configuration: ${error.message}`);
      throw error;
    }
  }

  public getConfig(): IceConfig {
    return this.config;
  }

  // Helper to resolve paths relative to cwd
  public resolvePath(relativePath: string): string {
    return path.resolve(this.cwd, relativePath);
  }

  // Get resolved output path
  public getOutputPath(): string {
    return this.resolvePath(this.config.output.path);
  }
}
