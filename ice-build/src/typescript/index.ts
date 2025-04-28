import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import ts from 'typescript';
import { BuildContext } from '../types.js';
import { logFileCompilation, logSuccess, logError, logInfo } from '../utils/console.js';

// Helper to normalize paths for cross-platform compatibility
function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

// Helper to ensure output directory exists
function ensureOutputDirExists(outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function setupTsProcessor(
  ctx: BuildContext,
  hmr: any,
  fileCount: { value: number }
): Promise<esbuild.BuildContext | null> {
  const { projectDir, sourceDir, outputDir, config, tsConfig, isVerbose } = ctx;
  
  try {
    // Find all TypeScript files in the source directory
    const tsFiles = await glob('**/*.{ts,tsx}', {
      cwd: path.join(projectDir, sourceDir),
      ignore: ['**/node_modules/**', '**/*.d.ts'],
      absolute: true,
    });
    
    fileCount.value = tsFiles.length;
    
    if (tsFiles.length === 0) {
      if (isVerbose) {
        logInfo('No TypeScript files found to process');
      }
      return null;
    }
    
    // Create a map of entry points for esbuild
    const entryPointsMap: Record<string, string> = {};
    
    tsFiles.forEach(file => {
      const relativePath = path.relative(path.join(projectDir, sourceDir), file);
      // Get the output path based on tsconfig if available
      let outputPath = relativePath.replace(/\.(ts|tsx)$/, '.js');
      
      // If the file is in a 'ts' directory, put the output in 'js' directory
      // This is a convention that many projects follow
      if (outputPath.startsWith('ts/')) {
        outputPath = outputPath.replace(/^ts\//, 'js/');
      }
      
      entryPointsMap[outputPath] = file;
      
      if (isVerbose) {
        logFileCompilation(file.endsWith('.tsx') ? 'TSX' : 'TypeScript', relativePath);
      }
    });
    
    // Build esbuild options using tsConfig if available
    const esbuildOptions: esbuild.BuildOptions = {
      entryPoints: entryPointsMap,
      outdir: path.join(projectDir, outputDir),
      bundle: false,
      platform: 'browser',
      format: 'esm' as esbuild.Format, // Type cast to esbuild.Format
      sourcemap: true,
      target: 'es2018',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
      },
      ...config.typescriptOptions,
    };
    
    // Apply tsconfig options if available
    if (tsConfig) {
      // Map relevant TypeScript options to esbuild options
      if (tsConfig.options.target !== undefined) {
        // Fix the mapping by using a safer approach
        const targetMap: Partial<Record<ts.ScriptTarget, string>> = {
          [ts.ScriptTarget.ES2015]: 'es2015',
          [ts.ScriptTarget.ES2016]: 'es2016',
          [ts.ScriptTarget.ES2017]: 'es2017',
          [ts.ScriptTarget.ES2018]: 'es2018',
          [ts.ScriptTarget.ES2019]: 'es2019',
          [ts.ScriptTarget.ES2020]: 'es2020',
          [ts.ScriptTarget.ES2021]: 'es2021',
          [ts.ScriptTarget.ESNext]: 'esnext',
        };
        
        const target = targetMap[tsConfig.options.target] || 'es2018'; // Default if not found
        esbuildOptions.target = target;
      }
      
      // Handle JSX options
      if (tsConfig.options.jsx !== undefined) {
        // Map TypeScript JSX options to esbuild options
        switch (tsConfig.options.jsx) {
          case ts.JsxEmit.React:
          case ts.JsxEmit.ReactJSX:
            esbuildOptions.jsx = 'transform';
            break;
          case ts.JsxEmit.ReactNative:
          case ts.JsxEmit.Preserve:
            esbuildOptions.jsx = 'preserve';
            break;
          case ts.JsxEmit.ReactJSXDev:
            esbuildOptions.jsx = 'transform';
            esbuildOptions.jsxDev = true;
            break;
        }
        
        // Apply JSX factory and fragment if specified
        if (tsConfig.options.jsxFactory) {
          esbuildOptions.jsxFactory = tsConfig.options.jsxFactory;
        }
        if (tsConfig.options.jsxFragmentFactory) {
          esbuildOptions.jsxFragment = tsConfig.options.jsxFragmentFactory;
        }
      }
      
      // Handle module format
      if (tsConfig.options.module !== undefined) {
        // Fix the mapping by using a safer approach
        const moduleMap: Partial<Record<ts.ModuleKind, esbuild.Format>> = {
          [ts.ModuleKind.CommonJS]: 'cjs',
          [ts.ModuleKind.AMD]: 'esm',
          [ts.ModuleKind.UMD]: 'esm',
          [ts.ModuleKind.System]: 'esm',
          [ts.ModuleKind.ES2015]: 'esm',
          [ts.ModuleKind.ES2020]: 'esm',
          [ts.ModuleKind.ES2022]: 'esm',
          [ts.ModuleKind.ESNext]: 'esm',
        } as Partial<Record<ts.ModuleKind, esbuild.Format>>;
        
        // Try to set the format safely
        const format = moduleMap[tsConfig.options.module];
        if (format) {
          esbuildOptions.format = format;
        }
      }
      
      // Handle source maps
      if (tsConfig.options.sourceMap !== undefined) {
        esbuildOptions.sourcemap = tsConfig.options.sourceMap;
      }
    }
    
    // Create esbuild context
    return await esbuild.context(esbuildOptions);
    
  } catch (err) {
    logError('Failed to set up TypeScript processor', err as Error);
    return null;
  }
}