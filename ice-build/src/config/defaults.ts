import { IceConfig } from '../types.js';

export const defaultConfig: Partial<IceConfig> = {
  input: {
    ts: ['source/**/*.ts', 'source/**/*.tsx'], // Use 'source' as default directory
    scss: ['source/**/*.scss', 'source/**/*.sass'],
    html: ['source/**/*.html']
  },
  output: {
    path: 'public'
  },
  watch: {
    paths: ['source'], // Match with input directory
    ignored: ['**/node_modules/**']
  },
  hotreload: {
    enabled: true,
    port: 3001,  // Ensure port is correctly defined as 3001
    host: 'localhost',
    debounceTime: 300
  },
  graph: {
    format: 'json'
  }
};
