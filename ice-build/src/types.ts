import { ParsedCommandLine } from 'typescript';
import * as esbuild from 'esbuild';

// Configuration interface for ice-build
export interface IceBuildConfig {
  sourceDir: string;
  outputDir: string;
  sassOptions?: {
    loadPaths?: string[];
    [key: string]: any;
  };
  postcssPlugins?: any[];
  typescriptOptions?: Partial<esbuild.BuildOptions>;
  port?: number;
  enableCssLinting?: boolean; // Simple property validation
  [key: string]: any;
}

// Context passed to build processors
export interface BuildContext {
  projectDir: string;
  sourceDir: string;
  outputDir: string;
  config: IceBuildConfig;
  tsConfig?: ParsedCommandLine;
  watchMode: boolean;
  isVerbose: boolean;
}