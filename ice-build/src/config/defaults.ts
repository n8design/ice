import { IceConfig } from '../types.js';

export const defaultConfig: IceConfig = {
  input: {
    ts: ['source/**/*.ts', 'source/**/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
    scss: ['source/**/*.scss', 'source/**/*.sass', 'src/**/*.scss', 'src/**/*.sass'],
    html: ['source/**/*.html', 'src/**/*.html']
  },
  output: {
    path: 'public' // Changed from 'dist' to 'public' to match test project
  },
  watch: {
    paths: ['source', 'src'], // Watch both source and src directories
    ignored: ['node_modules', '.git', 'public', 'dist']
  },
  hotreload: {
    port: 3001,
    debounceTime: 300
  },
  esbuild: {
    bundle: true,
    minify: true,
    sourcemap: true,
    target: 'es2018'
  },
  sass: {
    style: 'expanded',
    sourceMap: true
  },
  postcss: {
    plugins: [] // Default plugins will be added programmatically
  }
};
