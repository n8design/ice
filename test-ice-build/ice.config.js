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
    entries: {
      // JavaScript/TypeScript entries
      app: 'scripts/app.ts',       // -> src/scripts/app.ts
      admin: 'scripts/admin.ts',   // -> src/scripts/admin.ts
      
      // SCSS entries
      main: 'styles/main.scss',    // -> src/styles/main.scss
      themes: 'styles/themes.scss' // -> src/styles/themes.scss
    }
  },
  
  // Define output configuration
  output: {
    path: 'public',
    
    // Output file naming
    filenames: {
      js: '[name].min.js',  // Results in: app.min.js, admin.min.js
      css: 'css/[name].css' // Results in: css/main.css, css/themes.css
    }
  },
  
  // SCSS specific options
  scss: {
    // Add node_modules to the include path for @import or @use
    includePaths: ['node_modules'],
    sourceMap: true,
    autoprefixer: true,
    
    // Pass options to autoprefixer
    autoprefixerOptions: {
      grid: true,
      browsers: ['>0.25%', 'not ie 11', 'not op_mini all']
    }
  },
  
  // TypeScript specific options
  typescript: {
    target: 'es2020',
    format: 'esm',
    sourceMap: true,
    minify: true,
    bundle: true,
    // External packages that shouldn't be bundled
    external: ['react', 'react-dom']
  },
  
  // Hot reloading configuration for development
  hotreload: {
    enabled: true,
    port: 3001,
    host: 'localhost'
  },
  
  // Static assets to copy from src to dist
  assets: {
    'images': 'images',        // src/images -> dist/images
    'fonts': 'assets/fonts',   // src/fonts -> dist/assets/fonts
    'data': 'data'             // src/data -> dist/data
  },
  
  // Advanced options
  advanced: {
    clean: true,      // Clean output directory before build
    parallel: true,   // Process files in parallel
    verbose: true,    // Detailed logging
    
    // Hooks (functions to run at specific build phases)
    hooks: {
      beforeBuild: () => console.log('Starting build process...'),
      afterBuild: () => console.log('Build complete!')
    }
  }
};
