import { AcceptedPlugin } from 'postcss';
// Correct import for SassPluginOptions
import { SassPluginOptions } from 'esbuild-sass-plugin';
import { TsconfigRaw } from 'esbuild';

export interface IceBuildConfig {
  sourceDir?: string;
  outputDir?: string;
  sassOptions?: SassPluginOptions; // Use correct imported type
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
  tsConfig: TsconfigRaw | null;
  watchMode: boolean;
  isVerbose: boolean;
}