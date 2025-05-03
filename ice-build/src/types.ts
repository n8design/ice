import { BuildOptions } from 'esbuild';
import { Options } from 'sass';

/**
 * ICE Builder Configuration Interface
 */
export interface IceConfig {
  input: {
    ts: string[];
    scss: string[];
    html?: string[];
    path?: string; // Input base path
    entries?: Record<string, string>;
  };
  output: {
    path: string;
    filenames?: {
      js?: string;
      css?: string;
    };
  } | string; // Output can be either a string path or an object
  sass?: {
    style?: 'expanded' | 'compressed';
    sourceMap?: boolean;
    sourceMapIncludeSources?: boolean;
    includePaths?: string[];
    autoprefixer?: boolean;
    autoprefixerOptions?: Record<string, any>;
  };
  scss?: { // Alternate scss config option
    includePaths?: string[];
    sourceMap?: boolean;
    autoprefixer?: boolean;
    autoprefixerOptions?: Record<string, any>;
  };
  typescript?: {
    target?: string;
    format?: string;
    sourceMap?: boolean;
    minify?: boolean;
    bundle?: boolean;
    external?: string[];
  };
  watch?: {
    paths?: string[];
    ignored?: string[];
  };
  hotreload?: {
    enabled?: boolean;
    port?: number;
    host?: string;
    debounceTime?: number;
  };
  esbuild?: BuildOptions;
  postcss?: {
    plugins: any[];
  };
  assets?: Record<string, string>;
  advanced?: {
    clean?: boolean;
    parallel?: boolean;
    verbose?: boolean;
    hooks?: {
      beforeBuild?: () => void;
      afterBuild?: () => void;
    };
  };
}

export interface Builder {
  build(): Promise<void>;
  buildFile(filePath: string): Promise<void>;
  clean?(): Promise<void>;
  processChange(filePath: string): Promise<void>;
}
