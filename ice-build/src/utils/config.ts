/**
 * Configuration management for ice-build
 */

import { IceConfig } from '../interfaces/config.js';

/**
 * Default configuration values
 */
export const defaultConfig: Partial<IceConfig> = {
  output: {
    path: 'public'
  },
  watch: {
    paths: ['src'],
    ignored: ['node_modules', 'dist', 'public']
  },
  sass: {
    style: 'expanded',
    sourceMap: true
  },
  postcss: {
    plugins: []
  },
  hotreload: {
    port: 3001,
    debounceTime: 300
  },
  esbuild: {
    bundle: true,
    minify: false,
    sourcemap: true,
    target: 'es2018'
  }
};

/**
 * Merge user-provided config with defaults
 * @param userConfig User-provided configuration
 * @returns Complete configuration with defaults for missing options
 */
export function mergeWithDefaults(userConfig: Partial<IceConfig> = {}): IceConfig {
  const merged = { 
    ...JSON.parse(JSON.stringify(defaultConfig)),
    ...userConfig
  };

  // Ensure required fields are present with defaults
  merged.output = merged.output || { path: 'public' };
  merged.watch = merged.watch || defaultConfig.watch;
  merged.sass = merged.sass || defaultConfig.sass;
  merged.postcss = merged.postcss || defaultConfig.postcss;
  merged.hotreload = merged.hotreload || defaultConfig.hotreload;
  merged.esbuild = merged.esbuild || defaultConfig.esbuild;

  // Validate required fields
  if (!merged.input || !merged.input.scss) {
    throw new Error('Configuration error: input.scss is required');
  }

  return merged as IceConfig;
}

/**
 * Validate configuration
 * @param config Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: IceConfig): void {
  if (!config.input) {
    throw new Error('Configuration error: input is required');
  }
  
  if (!Array.isArray(config.input.scss)) {
    throw new Error('Configuration error: input.scss must be an array of glob patterns');
  }
  
  // Fix: Handle both string and object output formats
  if (!config.output) {
    throw new Error('Configuration error: output is required');
  }
  
  if (typeof config.output === 'string') {
    // Output is directly a path string, which is valid
    if (!config.output.trim()) {
      throw new Error('Configuration error: output path cannot be empty');
    }
  } else {
    // Output is an object, validate the path property
    if (!config.output.path) {
      throw new Error('Configuration error: output.path is required');
    }
  }
}
