#!/usr/bin/env node

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Assuming your compiled output is in dist and the main function is exported
const buildScriptPath = resolve(__dirname, '../dist/ice-build.js');

// Dynamically import the main function
import(buildScriptPath)
  .then(module => {
    // Check if startBuild is exported and is a function
    if (typeof module.startBuild === 'function') {
      // Execute the main build function
      return module.startBuild();
    } else {
      console.error(`Error: Could not find exported 'startBuild' function in ${buildScriptPath}`);
      process.exit(1);
    }
  })
  .catch(error => {
    // The startBuild function should handle its own errors and exit codes.
    // This catch is for errors during the dynamic import itself or unhandled rejections.
    console.error("Failed to load or execute build script:", error);
    process.exit(1);
  });

// No need for spawnSync or manual exit handling here anymore,
// as startBuild and its internal logic handle success/failure/exit.