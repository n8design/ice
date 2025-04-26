import { AcceptedPlugin } from 'postcss';
import { SassPluginOptions } from 'esbuild-sass-plugin';
import ts from 'typescript';

export interface IceBuildConfig {
  sourceDir?: string;
  outputDir?: string;
  sassOptions?: SassPluginOptions;
  postcssPlugins?: AcceptedPlugin[];
  typescriptOptions?: Record<string, unknown>;
  port?: number;
  imagePath?: string;
}

export interface BuildContext {
  projectDir: string;
  sourceDir: string;
  outputDir: string;
  config: IceBuildConfig;
  tsConfig: ts.ParsedCommandLine | undefined;
  watchMode: boolean;
  isVerbose: boolean;
}