import { Command } from 'commander';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('Graph Export');

/**
 * Register the export graph command
 */
export function registerExportGraphCommand(program: Command): void {
  program
    .command('export-graph')
    .description('Export CSS dependency graph')
    .option('-f, --format <format>', 'Output format (json, dot, nx, all)', 'json')
    .option('-o, --output <path>', 'Output path for the graph files')
    .action((options) => {
      executeExportGraphCommand(options);
    });
}

/**
 * Execute the export graph command
 */
async function executeExportGraphCommand(options: { format?: string, output?: string }): Promise<void> {
  try {
    logger.info('Starting CSS dependency graph export');
    
    // Dynamically import modules
    const configModule = await import('../../config/index.js');
    const BuildManagerModule = await import('../../builders/index.js');
    const { exportGraph } = await import('../../exporters/graph-exporter.js');
    
    // Get configuration
    let config: any = {
      input: {
        scss: ['src/**/*.scss', 'source/**/*.scss'],
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
    
    // Override config with command line options
    if (options.format) {
      if (!config.graph) config.graph = {};
      config.graph.format = options.format;
    }
    
    if (options.output) {
      if (!config.graph) config.graph = {};
      config.graph.outputPath = options.output;
    }
    
    // Create builder manager
    const buildManager = new BuildManagerModule.Builder(config as any);
    
    // Get the SCSS builder
    const scssBuilder = buildManager.getScssBuilder();
    
    // IMPORTANT: Build the dependency graph before exporting
    logger.info('Building SCSS dependency graph...');
    await scssBuilder.buildDependencyGraph();
    
    // Export the graph
    await exportGraph(scssBuilder, config);
    
    logger.success('Graph export complete');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Graph export failed: ${errorMessage}`);
    process.exit(1);
  }
}
