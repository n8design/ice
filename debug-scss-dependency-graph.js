import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the ICE config and SCSS builder
import('./ice-build/dist/builders/scss.js').then(async ({ SCSSBuilder }) => {
  // First check if the files actually exist
  console.log('Checking if SCSS files exist...');
  const scssFiles = await glob('test-scss-dependencies/source/scss/**/*.scss');
  console.log('Found SCSS files:', scssFiles);

  // Create a config with absolute paths
  const config = {
    input: {
      scss: [path.resolve(process.cwd(), 'test-scss-dependencies/source/scss/**/*.scss')]
    },
    output: path.resolve(process.cwd(), 'test-scss-dependencies/public')
  };
  
  console.log('Using config:', config);
  const builder = new SCSSBuilder(config);
  
  // Enable verbose logging and set debug mode
  builder.verboseLogging = true;
  
  console.log('Building dependency graph...');
  try {
    const graph = await builder.buildDependencyGraph();
    console.log('Graph built with size:', graph.size);
    console.log('Graph entries:', Array.from(graph.keys()));
    
    // Check for a specific file
    const testFilePath = path.resolve(process.cwd(), 'test-scss-dependencies/source/scss/abstracts/_test-file.scss');
    console.log('Looking for:', testFilePath);
    console.log('File exists?', fs.existsSync(testFilePath));
    console.log('In graph?', graph.has(testFilePath));
    
    // Try with the path normalized in the same way the builder does
    const normalized = testFilePath.replace(/\\/g, '/');
    console.log('Normalized path:', normalized);
    console.log('In graph with normalized path?', graph.has(normalized));
    
    // List all keys in the graph to find matching patterns
    if (graph.size > 0) {
      console.log('All graph keys:');
      for (const key of graph.keys()) {
        console.log('  -', key);
        if (key.includes('_test-file')) {
          console.log('    FOUND _test-file in key');
        }
      }
    }
  } catch (error) {
    console.error('Error building graph:', error);
  }
}).catch(console.error);
