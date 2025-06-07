/**
 * Ice Build Sample Configuration
 * A real-world configuration example with common settings
 */
export default {
  // Define input sources
  input: {
    // Base source directory for all source files
    path: 'source',
    
    // Specific entry points (optional)
  },
  
  // Define output configuration
  output: {
    path: 'public',
  },
  
  // SCSS specific options
  scss: {
    // Add node_modules to the include path for @import or @use
    outDir: 'public/css',
    includePaths: ['node_modules'],
    sourceMap: true,
    autoprefixer: true,
    
    // autoprefixerOptions removed, browserslist is now in package.json
  },
  
  // TypeScript specific options
  typescript: {

  },
  
  // Hot reloading configuration for development
  hotreload: {
    enabled: true,
    port: 3002,
    host: 'localhost',
    excludeExtensions: ['.map', '.d.ts', '.html', '.htm', '.hbs'] // Exclude these file extensions from triggering hot reload
  },

};
