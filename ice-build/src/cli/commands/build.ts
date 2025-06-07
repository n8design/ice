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
    .option('--export-graph', 'Export CSS dependency graph after build')
    .option('-f, --graph-format <format>', 'Graph output format (json, dot, nx, all)', 'json')
    .option('-o, --graph-output <path>', 'Output path for graph files')
    .action((options) => {
      executeBuildCommand(options);
    });
}

/**
 * Execute the build command
 */
async function executeBuildCommand(options: { 
  exportGraph?: boolean, 
  graphFormat?: string, 
  graphOutput?: string 
} = {}): Promise<void> {
  try {
    logger.info('Starting build');
    logger.debug(`Build command options received: ${JSON.stringify(options, null, 2)}`); // DEBUG
    
    // Dynamically import to avoid TypeScript errors
    const configModule = await import('../../config/index.js');
    logger.debug(`Loaded configModule: ${typeof configModule}`); // DEBUG
    const BuildManagerModule = await import('../../builders/index.js');

    // Always use async getConfig for robust config loading
    let config: any = await configModule.getConfig();
    logger.debug(`Config loaded from getConfig(): ${JSON.stringify(config, null, 2)}`); // DEBUG
    
    // Add graph export options if specified
    if (options.exportGraph) {
      if (!config.graph) config.graph = {};
      config.graph.enabled = true;
    }
    
    if (options.graphFormat) {
      if (!config.graph) config.graph = {};
      config.graph.format = options.graphFormat;
    }
    
    if (options.graphOutput) {
      if (!config.graph) config.graph = {};
      config.graph.outputPath = options.graphOutput;
    }
    
    // Create builder manager - only pass the config, not the output path
    const buildManager = new BuildManagerModule.Builder(config as any);
    
    // Build all
    await buildManager.buildAll();
    
    // Export graph if requested
    if (options.exportGraph || config.graph?.enabled) {
      logger.info('Exporting CSS dependency graph');
      const { exportGraph } = await import('../../exporters/graph-exporter.js');
      
      // No need to call buildDependencyGraph() here since buildAll() should have already built it,
      // but let's make sure the graph is ready
      const scssBuilder = buildManager.getScssBuilder();
      
      // Export the graph
      await exportGraph(scssBuilder, config);
    }
    
    logger.success('Build complete');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Build failed: ${errorMessage}`);
    process.exit(1);
  }
}
