/**
 * ice-build - Main entry point
 * 
 * A Node.js-based frontend build tool that compiles TypeScript/TSX and SCSS files 
 * with live-reload support.
 */

// Export from CLI and other modules
export * from './cli/index.js';
export * from './builders/index.js';
export * from './types.js';

// Import the runCLI function (not CLI)
import { runCLI } from './cli/index.js';

/**
 * Run the CLI with the given arguments
 * @param args Command line arguments
 * @returns A promise that resolves when the CLI is done
 */
export function run(args = process.argv): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      runCLI(args);
      resolve();
    } catch (error: unknown) {
      reject(error);
    }
  });
}

// Provide a catch handler for the CLI when run directly
if (typeof require !== 'undefined' && require.main === module) {
  run().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  });
}
