/**
 * Standard Ice Configuration
 * This example shows all available options with their default values
 */

export default {
  // Define input sources
  input: {
    // Base source directory (all .ts and .scss files will be processed)
    path: 'src', // Make sure this directory exists in your project
    
    // Optional: Define specific entry points
    entries: {
      main: 'index.ts',    // Main JavaScript/TypeScript entry
      styles: 'style.scss' // Main SCSS entry
    }
  },
  
  // Define output configuration
  output: {
    path: 'Public',          // Output directory
    
    // Optional: Configure output filenames
    filenames: {
      js: '[name].js',     // JavaScript output pattern
      css: '[name].css'    // CSS output pattern
    }
  },
  
  // ... rest of configuration ...
};
