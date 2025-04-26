#!/usr/bin/env node

import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';

// Get the directory name correctly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the path to the build script
const buildScriptPath = resolve(__dirname, '..', 'dist', 'ice-build.js');

// Check if the build script exists
if (!existsSync(buildScriptPath)) {
  console.error(`Error: Build script not found at ${buildScriptPath}`);
  console.error('Please make sure you have built the project with "npm run build"');
  process.exit(1);
}

// Convert the file path to a proper file:// URL for ESM import
const buildScriptUrl = pathToFileURL(buildScriptPath);

// Dynamically import the main function using the URL
import(buildScriptUrl)
  .then(module => {
    if (typeof module.startBuild === 'function') {
      return module.startBuild();
    } else {
      console.error(`Error: Could not find exported 'startBuild' function in ${buildScriptPath}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error("Failed to load or execute build script:", error);
    process.exit(1);
  });