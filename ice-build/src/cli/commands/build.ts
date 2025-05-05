import { Command } from 'commander';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('CLI');

/**
 * Register the build command
 */
export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build all project files')
    .action(() => {
      executeBuildCommand();
    });
}

/**
 * Execute the build command
 */
async function executeBuildCommand(): Promise<void> {
  try {
    logger.info('Starting build');
    
    // Dynamically import to avoid TypeScript errors
    const configModule = await import('../../config/index.js');
    const BuildManagerModule = await import('../../builders/index.js');
    
    // Get configuration - use type assertion and await the function calls
    let config: any = {
      // Provide default minimal IceConfig structure
      input: {
        ts: ['src/**/*.ts', 'source/**/*.ts'],
        scss: ['src/**/*.scss', 'source/**/*.scss'],
        html: ['src/**/*.html', 'source/**/*.html'],
      },
      output: {
        path: 'public'
      }
    };
    
    const configModuleAny = configModule as any;
    
    if (typeof configModuleAny.getConfig === 'function') {
      config = await configModuleAny.getConfig() || config;
    } else if (typeof configModuleAny.createConfig === 'function') {
      config = await configModuleAny.createConfig() || config;
    }
    
    // Create builder manager - only pass the config, not the output path
    const buildManager = new BuildManagerModule.Builder(config as any);
    
    // Build all
    await buildManager.buildAll();
    
    logger.success('Build complete');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Build failed: ${errorMessage}`);
    process.exit(1);
  }
}
