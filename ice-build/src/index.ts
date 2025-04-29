/**
 * ice-build - Main entry point
 * 
 * A Node.js-based frontend build tool that compiles TypeScript/TSX and SCSS files 
 * with live-reload support.
 */

import { CLI } from './cli/index.js';

// Export types for consumers of the library
export * from './types.js';
export { ConfigManager } from './config/index.js';
export { BuildManager } from './builders/index.js';
export { FileWatcher } from './watcher/index.js';
export { HotReloadManager } from './hotreload/index.js';

// Execute CLI if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('ice-build')) {
  const cli = new CLI();
  cli.run(process.argv).catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
