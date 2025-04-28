import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import autoprefixer from 'autoprefixer';
import { IceBuildConfig } from '../types.js';
import { reportError } from '../utils/index.js';
import { fileURLToPath } from 'url';

// Default configuration
const defaultConfig: IceBuildConfig = {
  sourceDir: 'source',
  outputDir: 'public',
  sassOptions: {
    loadPaths: ['node_modules'], // Changed from includePaths to loadPaths
  },
  postcssPlugins: [autoprefixer()],
  port: 3001
};

// Load project configuration file
export async function loadConfig(projectDir: string): Promise<IceBuildConfig> {
  // Potential configuration file paths
  const configPaths = [
    path.join(projectDir, 'ice-build.config.js'),
    path.join(projectDir, 'ice-build.config.mjs'),
    path.join(projectDir, 'ice-build.config.json'),
    path.join(projectDir, '.ice-buildrc.js'),
    path.join(projectDir, '.ice-buildrc.json'),
  ];
  
  // Try to find an existing config file
  let configPath: string | undefined;
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }
  
  // If found, load user configuration
  let userConfig: Partial<IceBuildConfig> = {};
  
  if (configPath) {
    try {
      if (configPath.endsWith('.json')) {
        // Load JSON directly
        const content = fs.readFileSync(configPath, 'utf-8');
        userConfig = JSON.parse(content);
      } else {
        // Use native dynamic import for JS/ESM files
        const fileUrl = process.platform === 'win32' 
          ? `file://${configPath.replace(/\\/g, '/')}`
          : `file://${configPath}`;
          
        const configModule = await import(fileUrl);
        userConfig = configModule.default || configModule;
      }
    } catch (err) {
      reportError(`Failed to load configuration from ${configPath}`, err as Error);
      // Continue with default config
    }
  }
  
  // Merge user config with defaults
  const config: IceBuildConfig = {
    ...defaultConfig,
    ...userConfig,
    // Ensure sub-objects are merged properly
    postcssPlugins: [...(defaultConfig.postcssPlugins || []), ...(userConfig.postcssPlugins || [])]
  };
  
  return config;
}

// Detect source directory - try source/ or src/
export async function detectSourceDirectory(projectDir: string): Promise<string> {
  const commonSourceDirs = ['source', 'src', 'app', 'assets'];
  
  for (const dir of commonSourceDirs) {
    if (fs.existsSync(path.join(projectDir, dir))) {
      return dir;
    }
  }
  
  // Fall back to default
  console.warn('Could not detect source directory, using "source" as default');
  return 'source';
}

// Load TypeScript configuration from tsconfig.json
export async function loadTsConfig(projectDir: string): Promise<ts.ParsedCommandLine | undefined> {
  // Check if the TypeScript compiler is available
  try {
    const tsConfigPath = path.join(projectDir, 'tsconfig.json');
    
    if (!fs.existsSync(tsConfigPath)) {
      console.log('No tsconfig.json found, using default TypeScript settings');
      return undefined;
    }
    
    // Parse tsconfig.json
    const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (configFile.error) {
      reportError(`Error reading tsconfig.json: ${configFile.error.messageText}`, new Error(String(configFile.error.messageText)));
      return undefined;
    }
    
    // Parse and convert configs
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsConfigPath)
    );
    
    console.log('TypeScript configuration loaded successfully');
    return parsedConfig;
  } catch (err) {
    reportError('Failed to load TypeScript configuration', err as Error);
    return undefined;
  }
}