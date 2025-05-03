import { Command } from 'commander';
import { registerBuildCommand } from './commands/build.js';
import { registerWatchCommand } from './commands/watch.js';

/**
 * Create and configure the CLI program
 */
export function createCLI(): Command {
  const program = new Command();
  
  // Set version and description
  program
    .name('ice-build')
    .description('Modern build tool for TypeScript and SCSS')
    .version('1.0.0'); // Hardcoded version since version.js is missing
  
  // Register commands
  registerBuildCommand(program);
  registerWatchCommand(program);
  
  return program;
}

/**
 * Parse command line arguments and execute commands
 */
export function runCLI(args = process.argv): void {
  const program = createCLI();
  program.parse(args);
  
  // If no command was specified, show help
  if (program.args.length === 0) {
    program.outputHelp();
  }
}
