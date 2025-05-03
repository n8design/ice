/**
 * Standard Ice Configuration
 * This example shows all available options with their default values
 */

export default {
  // Define input sources
  input: {
    // Base source directory (all .ts and .scss files will be processed)
    path: 'src',
    
    // Optional: Define specific entry points
    entries: {
      main: 'index.ts',    // Main JavaScript/TypeScript entry
      styles: 'style.scss' // Main SCSS entry
    }
  },
  
  // Define output configuration
  output: {
    path: 'dist',          // Output directory
    
    // Optional: Configure output filenames
    filenames: {
      js: '[name].js',     // JavaScript output pattern
      css: '[name].css'    // CSS output pattern
    }
  },
  
  // SCSS specific options
  scss: {
    includePaths: ['node_modules'], // Additional paths for @import or @use
    sourceMap: true,                // Generate source maps
    autoprefixer: true,             // Apply autoprefixer
    // Optional: Pass options to autoprefixer
    autoprefixerOptions: {
      browsers: ['>0.25%', 'not dead']
    }
  },
  
  // TypeScript specific options (using esbuild)
  typescript: {
    target: 'es2020',      // ECMAScript target
    format: 'esm',         // Module format (esm, cjs, iife)
    sourceMap: true,       // Generate source maps
    minify: false,         // Minify output
    bundle: true           // Bundle dependencies
  },
  
  // Hot reloading options
  hotreload: {
    enabled: true,         // Enable hot reloading
    port: 8080,            // WebSocket server port
    host: 'localhost'      // WebSocket server host
  },
  
  // Copy static assets
  assets: {
    'images': 'images',    // Copy from src/images to dist/images
    'fonts': 'fonts',      // Copy from src/fonts to dist/fonts
    'static': '.'          // Copy from src/static to dist root
  },
  
  // Advanced options
  advanced: {
    clean: false,          // Clean output directory before build
    parallel: true,        // Process files in parallel
    verbose: false         // Enable verbose logging
  }
};
