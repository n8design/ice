/**
 * Core types for ice-build
 */

// Configuration interface
export interface IceConfig {
  input: {
    ts: string[];     // TypeScript entry files/globs
    scss: string[];   // SCSS entry files/globs
    html?: string[];  // HTML files (optional)
  };
  output: {
    path: string;     // Output directory
  };
  watch?: {
    paths: string[];  // Additional paths to watch
    ignored: string[];// Paths to ignore
  };
  hotreload?: HotReloadConfig;
  esbuild?: Record<string, any>; // esbuild options
  sass?: Record<string, any>;    // sass options
  postcss?: {
    plugins: any[];   // PostCSS plugins
  };
}

// Builder interface
export interface Builder {
  build(): Promise<void>;
  clean(): Promise<void>;
  buildFile(filePath: string): Promise<void>;
}

// Hot reload event types
export enum HotReloadEventType {
  CSS_UPDATE = 'css-update',
  FULL_RELOAD = 'full-reload'
}

export interface HotReloadEvent {
  type: HotReloadEventType;
  path: string;
}

// CLI command options
export interface CommandOptions {
  watch?: boolean;
  config?: string;
  clean?: boolean;
  verbose?: boolean;
}

export interface HotReloadConfig {
  port: number;
  debounceTime: number; // Add debounce time property
}

// Default configuration
export const defaultConfig: Partial<IceConfig> = {
  input: {
    ts: ['src/**/*.ts', 'src/**/*.tsx'],
    scss: ['src/**/*.scss', 'src/**/*.sass'],
  },
  output: { path: 'dist' },
  watch: { 
    paths: ['src'],
    ignored: ['node_modules', '.git', 'dist']
  },
  hotreload: {
    port: 3001,
    debounceTime: 300,
  },
  esbuild: {},
  sass: {},
  postcss: {
    plugins: []
  }
};
