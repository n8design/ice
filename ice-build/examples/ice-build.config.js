export default {
  // Source directory (default: auto-detected 'source' or 'src')
  sourceDir: 'source',
  
  // Output directory (default: 'public')
  outputDir: 'public',
  
  // HMR server port (default: 3001)
  port: 3001,
  
  // Sass options passed to esbuild-sass-plugin
  sassOptions: {
    includePaths: ['node_modules']
  },
  
  // PostCSS plugins - use dynamic imports that resolve at runtime
  postcssPlugins: [
    // This approach keeps the plugins dynamic but avoids linting issues
    await import('autoprefixer').then(m => m.default),
    await import('cssnano').then(m => m.default)({ preset: 'default' })
  ],
  
  // Override TypeScript options (merges with tsconfig.json if present)
  typescriptOptions: {
    target: "es2020",
    module: "es2020"
  }
}