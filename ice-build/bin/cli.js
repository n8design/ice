#!/usr/bin/env node

import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url'; // Keep pathToFileURL
import { existsSync } from 'fs';

// Get the directory name correctly in ESM
let currentDir;
try {
  const __filename = fileURLToPath(import.meta.url);
  currentDir = dirname(__filename);
} catch (e) {
  console.error("Error resolving current directory:", e);
  process.exit(1);
}


// Resolve the path to the build script relative to this cli script
const buildScriptPath = resolve(currentDir, '..', 'dist', 'ice-build.js');

// Check if the build script exists
if (!existsSync(buildScriptPath)) {
  console.error(`Error: Build script not found at ${buildScriptPath}`);
  console.error('Please make sure you have built the project with "npm run build"');
  process.exit(1);
}

// Convert the file path to a proper file:// URL for ESM import
// pathToFileURL handles Windows paths correctly
const buildScriptUrl = pathToFileURL(buildScriptPath).href; // Use .href

// Dynamically import the main function using the URL
import(buildScriptUrl)
  .then(module => {
    if (typeof module.startBuild === 'function') {
      // Execute the main build function
      return module.startBuild();
    } else {
      console.error('Error: startBuild function not found in the compiled module.');
      console.error('Please check the build output.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Failed to load or execute build script:', error);
    process.exit(1);
  });