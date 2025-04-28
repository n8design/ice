import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { IceBuildConfig } from '../types.js';
import { logInfo, logWarning, logError } from '../utils/console.js';

// Default configuration
const defaultConfig: IceBuildConfig = {
  sourceDir: 'source', // Will be auto-detected
  outputDir: 'public',
  sassOptions: {
    includePaths: ['node_modules'],
  },
  postcssPlugins: [], // Will be populated with autoprefixer by default
  typescriptOptions: {
    target: 'es2018',
    format: 'esm',
    sourcemap: true,
  },
  port: 3001,
};

// Load project configuration file
export async function loadProjectConfig(projectDir: string): Promise<IceBuildConfig | undefined> {
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
  
  let userConfig: Partial<IceBuildConfig> = {};
  
  if (configPath) {
    try {
      logInfo(`Loading configuration from ${path.basename(configPath)}`);
      
      if (configPath.endsWith('.json')) {
        // Load JSON config
        const content = fs.readFileSync(configPath, 'utf-8');
        userConfig = JSON.parse(content);
      } else {
        // Load JS/ESM config - dynamic import works in both CommonJS and ESM
        const configModule = await import(configPath);
        userConfig = configModule.default || configModule;
      }
    } catch (err) {
      logError(`Failed to load configuration from ${configPath}`, err as Error);
      // Continue with default config
    }
  } else {
    logInfo('No configuration file found, using defaults');
  }
  
  // Deep merge user config with defaults
  return deepMerge(defaultConfig, userConfig);
}

// Detect source directory - try source/ or src/
export async function detectSourceDirectory(projectDir: string, config: IceBuildConfig): Promise<string> {
  // If already specified in config, use that
  if (config.sourceDir && fs.existsSync(path.join(projectDir, config.sourceDir))) {
    return config.sourceDir;
  }
  
  // Try common directory names
  const commonSourceDirs = ['source', 'src', 'app', 'assets'];
  
  for (const dir of commonSourceDirs) {
    if (fs.existsSync(path.join(projectDir, dir))) {
      logInfo(`Detected source directory: ${dir}/`);
      return dir;
    }
  }
  
  // Fall back to default
  logWarning('Could not detect source directory, using "source" as default');
  return 'source';
}

// Load TypeScript configuration from tsconfig.json
export async function loadTsConfig(projectDir: string, config: IceBuildConfig): Promise<ts.ParsedCommandLine | undefined> {
  // Check if the TypeScript compiler is available
  try {
    const tsConfigPath = path.join(projectDir, 'tsconfig.json');
    
    if (!fs.existsSync(tsConfigPath)) {
      logInfo('No tsconfig.json found, using default TypeScript settings');
      return undefined;
    }
    
    // Parse tsconfig.json
    const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (configFile.error) {
      logError(`Error reading tsconfig.json: ${configFile.error.messageText}`);
      return undefined;
    }
    
    // Parse and convert configs
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsConfigPath)
    );
    
    logInfo('TypeScript configuration loaded successfully');
    return parsedConfig;
  } catch (err) {
    logError('Failed to load TypeScript configuration', err as Error);
    return undefined;
  }
}

// Fixed deep merge function with better typing
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = target[key as keyof typeof target];

      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
          targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        // Both are objects, recursively merge
        output[key as keyof typeof output] = deepMerge(
          targetValue,
          sourceValue as any
        ) as any;
      } else {
        // Either not both objects or one is null, just replace
        output[key as keyof typeof output] = sourceValue as any;
      }
    });
  }
  
  return output;
}