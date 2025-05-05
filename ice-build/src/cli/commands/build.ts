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
