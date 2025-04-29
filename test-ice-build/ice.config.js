/**
 * ice-build configuration for test project
 */
export default {
  input: {
    ts: ['source/**/*.ts', 'source/**/*.tsx'],
    scss: ['source/**/*.scss', 'source/**/*.sass']
  },
  output: {
    path: 'public'
  },
  watch: {
    paths: ['source'],
    ignored: ['node_modules', '.git', 'public']
  },
  hotreload: {
    port: 3001,
    debounceTime: 300
  },
  esbuild: {
    bundle: true,
    sourcemap: true,
    target: 'es2018',
    // Configure external modules to exclude scss files from bundling
    external: ['*.scss', '*.sass']
  }
}
