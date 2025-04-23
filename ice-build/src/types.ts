import { ESLint } from 'eslint';
import { Plugin } from 'esbuild';
import { AcceptedPlugin } from 'postcss';

export interface SassOptions {
  includePaths?: string[];
  [key: string]: unknown;
}

export interface IceBuildConfig {
  sourceDir?: string;
  outputDir?: string;
  sassOptions?: SassOptions;
  postcssPlugins?: AcceptedPlugin[];
  typescriptOptions?: Record<string, unknown>;
  port?: number;
}

export interface BuildContext {
  projectDir: string;
  sourceDir: string;
  outputDir: string;
  isVerbose: boolean;
  watchMode: boolean;
  skipLint: boolean;
  config: IceBuildConfig;
}

export interface EslintState {
  instance: ESLint | null;
  isFlatConfig: boolean;
  flatConfigModule: unknown;
}

export interface BuildResult {
  scssFiles: number;
  tsFiles: number;
  buildTime: number;
}