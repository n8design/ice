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
    outDir?: string; // New option for SCSS specific output directory
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
    excludeExtensions?: string[];
    serveFromNodeModules?: boolean;
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
  /**
   * Whether to watch the output directory for changes
   * Setting to false disables the output directory watcher
   */
  watchOutput?: boolean;
  
  /**
   * Graph export configuration
   */
  graph?: {
    /**
     * Output format for the dependency graph
     */
    format?: 'json' | 'dot' | 'nx' | 'all';
    /**
     * Custom output path for graph files
     * Defaults to [output.path]/graphs/
     */
    outputPath?: string;
  };
}

export interface Builder {
  build(): Promise<void>;
  buildFile(filePath: string): Promise<void>;
  clean?(): Promise<void>;
  processChange(filePath: string): Promise<void>;
  setHotReloadServer?(server: any): void;
}
