import { ESLint } from 'eslint';
import * as path from 'path';
import * as fs from 'fs/promises';
import { reportError } from '../utils';
import { EslintState } from '../types';

export async function initESLint(projectDir: string): Promise<EslintState> {
  const eslintState: EslintState = {
    instance: null,
    isFlatConfig: false,
    flatConfigModule: null
  };

  try {
    // Check for flat config first
    const flatConfigPath = path.resolve(projectDir, 'eslint.config.js');
    try {
      await fs.access(flatConfigPath);
      console.log(`Found ESLint flat config at: ${flatConfigPath}`);
      eslintState.isFlatConfig = true;
      
      // Dynamic import for flat config
      eslintState.flatConfigModule = await import(flatConfigPath);
      eslintState.instance = new ESLint({ overrideConfigFile: flatConfigPath });
    } catch (e) {
      // Check for legacy config
      const legacyConfigPaths = [
        '.eslintrc.js', 
        '.eslintrc.cjs',
        '.eslintrc.yaml',
        '.eslintrc.yml',
        '.eslintrc.json',
        '.eslintrc'
      ];
      
      let configFound = false;
      for (const configPath of legacyConfigPaths) {
        try {
          await fs.access(path.resolve(projectDir, configPath));
          console.log(`Found ESLint legacy config: ${configPath}`);
          configFound = true;
          eslintState.instance = new ESLint({ cwd: projectDir });
          break;
        } catch (err) {
          // Config file not found, try next
        }
      }
      
      if (!configFound) {
        console.log('No ESLint config found, using default settings.');
        eslintState.instance = new ESLint({ cwd: projectDir });
      }
    }
  } catch (error) {
    reportError('ESLint initialization', error as Error);
  }

  return eslintState;
}

export async function lintFile(
  filePath: string, 
  eslintInstance: ESLint, 
  isVerbose: boolean
): Promise<boolean> {
  if (!eslintInstance) return true;
  
  try {
    const results = await eslintInstance.lintFiles([filePath]);
    const formatter = await eslintInstance.loadFormatter('stylish');
    const resultText = await formatter.format(results);
    
    if (resultText.trim()) {
      console.log(resultText);
    }
    
    // Check if there are any errors (not just warnings)
    const hasErrors = results.some(
      result => result.errorCount > 0 || result.fatalErrorCount > 0
    );
    
    return !hasErrors;
  } catch (error) {
    reportError(`ESLint (${path.basename(filePath)})`, error as Error, isVerbose);
    return false;
  }
}