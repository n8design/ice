import * as fs from 'fs/promises';
import * as path from 'path';
import { IceBuildConfig } from '../types';
import { DEFAULT_CONFIG, DEFAULT_TS_CONFIG } from './default-configs'; // Add DEFAULT_TS_CONFIG
import { reportError } from '../utils/error-reporting';

export async function loadProjectConfig(projectDir: string): Promise<IceBuildConfig> {
  // Try to find a config file in the project
  const configPaths = [
    'ice-build.config.js',
    'ice-build.config.mjs',
    'ice-build.config.json'
  ];

  for (const configPath of configPaths) {
    try {
      const fullPath = path.join(projectDir, configPath);
      await fs.access(fullPath);

      if (configPath.endsWith('.json')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const userConfig = JSON.parse(content);
        console.log(`Loaded config from ${configPath}`);
        return { ...DEFAULT_CONFIG, ...userConfig };
      } else {
        // For JS/MJS files, use dynamic import
        const userConfig = await import(fullPath);
        console.log(`Loaded config from ${configPath}`);
        return { ...DEFAULT_CONFIG, ...userConfig.default };
      }
    } catch (_ignored) {
      // Config file not found or invalid, try next
    }
  }

  console.log('No config file found, using defaults');
  return DEFAULT_CONFIG;
}

export async function loadTsConfig(projectDir: string, config: IceBuildConfig): Promise<Record<string, unknown>> {
  // Use config from ice-build config if provided
  if (config.typescriptOptions) {
    console.log('Using TypeScript configuration from ice-build config');
    return { 
      compilerOptions: { 
        ...DEFAULT_TS_CONFIG.compilerOptions, 
        ...config.typescriptOptions 
      } 
    };
  }

  // Try to find tsconfig.json in the project directory
  const tsconfigPath = path.join(projectDir, 'tsconfig.json');
  
  try {
    // Check if tsconfig exists
    await fs.access(tsconfigPath);
    console.log(`Found TypeScript config at: ${tsconfigPath}`);
    
    try {
      // Read and parse tsconfig.json
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      
      // Try to remove comments from JSON before parsing
      const jsonContent = tsconfigContent.replace(/\/\/.*$/gm, '');
      const tsconfig = JSON.parse(jsonContent) as Record<string, unknown>;
      
      console.log('Using project TypeScript configuration');
      return tsconfig;
    } catch (parseError) {
      console.error(`Error parsing tsconfig.json: ${(parseError as Error).message}`);
      console.log('Falling back to default TypeScript settings');
      return DEFAULT_TS_CONFIG;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No tsconfig.json found, using default TypeScript settings');
    } else {
      reportError('TypeScript config access', error as Error);
      console.log('Falling back to default TypeScript settings');
    }
    
    return DEFAULT_TS_CONFIG;
  }
}

export async function detectSourceDirectory(
  projectDir: string, 
  config: IceBuildConfig
): Promise<string> {
  // If sourceDir is specified in config, use that
  if (config.sourceDir) {
    console.log(`Using configured source directory: ${config.sourceDir}/`);
    return config.sourceDir;
  }

  const sourceDirs = ['source', 'src'];
  
  for (const dir of sourceDirs) {
    try {
      const dirPath = path.join(projectDir, dir);
      const stat = await fs.stat(dirPath);
      if (stat.isDirectory()) {
        console.log(`Using detected source directory: ${dir}/`);
        return dir;
      }
    } catch (error) {
      // Directory doesn't exist, try the next one
    }
  }
  
  // Default to "source" if neither directory exists
  console.log('No source or src directory found, defaulting to source/');
  return 'source';
}