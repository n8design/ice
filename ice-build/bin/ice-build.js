#!/usr/bin/env node

import { CLI } from '../dist/cli/index.js';

// Create and run the CLI
const cli = new CLI();
cli.run(process.argv).catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
