// Utils index file that re-exports all utilities

// Re-export console utilities
export * from './console.js';

// Export other utilities (but avoid re-exporting what's already exported from console)
export * from './path-utils.js';

// This might duplicate functionality in error-formatter.js
export function reportError(message: string, error?: Error | string, projectDir: string = process.cwd()): void {
  console.error(`\n🧊 ${message}`);
  
  if (error) {
    const { formatBuildError } = require('./error-formatter.js');
    const formattedError = formatBuildError(error, projectDir);
    console.error(formattedError);
  }
}