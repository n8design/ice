import * as fs from 'fs/promises';
import * as path from 'path';
import ts from 'typescript';
// --->>> ADD .js EXTENSIONS <<<---
import { IceBuildConfig } from '../types.js';
import { DEFAULT_CONFIG, DEFAULT_TS_CONFIG } from './default-configs.js';
import { reportError } from '../utils/error-reporting.js';

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

// --->>> CHANGE RETURN TYPE AND IMPLEMENTATION <<<---
export async function loadTsConfig(projectDir: string, config: IceBuildConfig): Promise<ts.ParsedCommandLine | undefined> {
  // Use config from ice-build config if provided (This part might need adjustment
  // depending on how typescriptOptions is intended to work. For now, we prioritize tsconfig.json)
  // if (config.typescriptOptions) {
  //   console.log('Using TypeScript configuration from ice-build config');
  //   // This is tricky - creating a full ParsedCommandLine from raw options isn't straightforward.
  //   // It's better to rely on tsconfig.json or defaults for now.
  //   // Consider removing typescriptOptions from IceBuildConfig or refining its purpose.
  // }

  const tsconfigPath = ts.findConfigFile(projectDir, ts.sys.fileExists, 'tsconfig.json');

  if (!tsconfigPath) {
    console.log('No tsconfig.json found, using default TypeScript settings');
    // Parse default options into a ParsedCommandLine structure
    // Note: This might not be fully equivalent to a real file parse, but provides the structure.
    // You might need to adjust default options based on project needs.
    const defaultParsed = ts.parseJsonConfigFileContent(
        DEFAULT_TS_CONFIG, // Use the default config object
        ts.sys,
        projectDir
    );
    // Report potential errors in default config parsing (unlikely but possible)
    if (defaultParsed.errors.length > 0) {
        reportError('Default TSConfig Parsing', defaultParsed.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
    }
    return defaultParsed;
  }

  try {
    console.log(`Found TypeScript config at: ${tsconfigPath}`);
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

    if (configFile.error) {
      reportError('TSConfig Read', ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
      console.log('Falling back to default TypeScript settings');
      // Return default parsed options on read error
      return ts.parseJsonConfigFileContent(DEFAULT_TS_CONFIG, ts.sys, projectDir);
    }

    // Parse the config file content relative to its directory
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath) // Use the directory of tsconfig.json as the base path
    );

    if (parsedConfig.errors.length > 0) {
      reportError('TSConfig Parsing', parsedConfig.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
      // Decide if you want to proceed with errors or fallback
      // console.log('Falling back to default TypeScript settings due to parsing errors');
      // return ts.parseJsonConfigFileContent(DEFAULT_TS_CONFIG, ts.sys, projectDir);
    }

    console.log('Using project TypeScript configuration');
    return parsedConfig; // Return the fully parsed command line options

  } catch (error) {
    reportError('TSConfig Load/Parse', error as Error);
    console.log('Falling back to default TypeScript settings');
    // Return default parsed options on unexpected errors
    return ts.parseJsonConfigFileContent(DEFAULT_TS_CONFIG, ts.sys, projectDir);
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