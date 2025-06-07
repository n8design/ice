import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the ICE config and SCSS builder
import('./ice-build/dist/builders/scss.js').then(async ({ SCSSBuilder }) => {
  const configPath = path.resolve(process.cwd(), 'test-scss-dependencies/ice.config.js');
  let config;
  
  try {
    config = (await import(configPath)).default;
  } catch (e) {
    console.error('Failed to load config:', e);
    return;
  }
  
  console.log('Using config:', config);
  const builder = new SCSSBuilder(config);
  
  // Enable verbose logging
  builder.verboseLogging = true;

  console.log('Building dependency graph...');
  await builder.buildDependencyGraph();
  
  console.log('\nTesting _test-file.scss...');
  const testFilePath = path.resolve('test-scss-dependencies/source/scss/abstracts/_test-file.scss');
  const parents = builder.getParentFiles(testFilePath);
  console.log('Parents for _test-file.scss:', parents);
  
  console.log('\nTesting _colors.scss...');
  const colorsPath = path.resolve('test-scss-dependencies/source/scss/abstracts/_colors.scss');
  const colorParents = builder.getParentFiles(colorsPath);
  console.log('Parents for _colors.scss:', colorParents);
  
  console.log('\nTesting components/buttons/_button.scss...');
  const buttonPath = path.resolve('test-scss-dependencies/source/scss/components/buttons/_button.scss');
  const buttonParents = builder.getParentFiles(buttonPath);
  console.log('Parents for _button.scss:', buttonParents);
}).catch(console.error);
