import { Command } from 'commander';
import { Logger } from '../../utils/logger.js';
import { HotReloadServer } from '@n8d/ice-hotreloader'; 
import { FileWatcher } from '../../watcher/index.js';

const logger = new Logger('CLI');

/**
 * Register the watch command
 */
export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch for file changes and rebuild')
    .option('-c, --config <path>', 'Path to config file')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (options) => {
      try {
        logger.info('Starting watch mode');
        
        // Get config and create a BuildManager directly
        const configModule = await import('../../config/index.js');
        const buildersModule = await import('../../builders/index.js');
        
        // Create default config
        const defaultConfig = {
          input: {
            ts: ['src/**/*.ts', 'source/**/*.ts'],
            scss: ['src/**/*.scss', 'source/**/*.scss'],
            html: ['src/**/*.html', 'source/**/*.html'],
          },
          output: {
            path: 'public'
          },
          watch: {
            // Use common default input directories instead of hardcoded paths
            // This will be overridden by the actual config loading or by FileWatcher's logic
            paths: ['src', 'source'],
            ignored: ['node_modules', '**/node_modules/**']
          },
          hotreload: {
            enabled: true,
            port: 3001
          }
        };
        
        // Try to get config from different possible sources
        let config = defaultConfig;
        const configModuleAny = configModule as any;
        
        try {
          if (typeof configModuleAny.getConfig === 'function') {
            const loadedConfig = await configModuleAny.getConfig();
            if (loadedConfig) config = loadedConfig;
          } else if (typeof configModuleAny.createConfig === 'function') {
            const loadedConfig = await configModuleAny.createConfig();
            if (loadedConfig) config = loadedConfig;
          } else if (configModuleAny.config) {
            config = configModuleAny.config;
          }
          
          logger.debug('Configuration loaded');
        } catch (configError) {
          logger.warn(`Could not load configuration, using defaults: ${configError instanceof Error ? configError.message : String(configError)}`);
        }
        
        // Ensure watch paths are properly derived from input configuration
        // This helps the FileWatcher logic by ensuring watch.paths reflects the actual input configuration
        if (!config.watch) {
          config.watch = {
            paths: [],
            ignored: ['node_modules', '**/node_modules/**']
          };
        }
        
        // If watch.paths is not explicitly set and we have input.path, derive watch paths from it
        if ((!config.watch.paths || config.watch.paths.length === 0) && (config.input as any)?.path) {
          config.watch.paths = [(config.input as any).path];
          logger.debug(`Derived watch paths from input.path: [${(config.input as any).path}]`);
        }
        
        // Ensure ignored patterns exist
        if (!config.watch.ignored) {
          config.watch.ignored = ['node_modules', '**/node_modules/**'];
        }
        
        // Create BuildManager
        const { Builder } = buildersModule;
        if (!Builder) {
          throw new Error('BuildManager not found in builders module');
        }
        
        // Only pass the config to the Builder constructor
        const buildManager = new Builder(config);
        
        // Get output directory path
        const outputDir = typeof config.output === 'string' 
          ? config.output 
          : config.output?.path || 'public';
        
        // Initialize hot reload server using the dedicated package
        let hotReloadServer: any = null;
        if (config.hotreload?.enabled) {
          try {
            const port = config.hotreload.port || 3001;
            const outputDir = typeof config.output === 'string' ? config.output : config.output?.path || 'public';
            
            // Create HotReloadServer from the dedicated package
            hotReloadServer = new HotReloadServer({
              port,
              outputDir
            });
            
            // Create and start the output watcher
            const { OutputWatcher } = await import('../../watcher/output-watcher.js');
            // Pass the entire config object to OutputWatcher
            const outputWatcher = new OutputWatcher(outputDir, hotReloadServer, config);
            outputWatcher.start();
            
            logger.success('Hot reload server started');
            logger.info('📝 To enable hot reloading in the browser:');
            logger.info(`   Add <script src="http://localhost:${port}/ice-hotreload.js"></script> to your HTML file`);
          } catch (hotReloadError) {
            logger.error(`Failed to start hot reload: ${hotReloadError instanceof Error ? hotReloadError.message : String(hotReloadError)}`);
          }
        }
        
        // Use FileWatcher directly instead of implementing watching logic here
        try {
          // Build everything initially
          await buildManager.buildAll();
          
          // Initialize FileWatcher
          const fileWatcher = FileWatcher.getInstance(config, buildManager, hotReloadServer);
          await fileWatcher.start();
          
          logger.success('Watch mode started');
          logger.info('Press Ctrl+C to stop watching');
          
          // Handle termination signals
          process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down');
            fileWatcher.stop();
            if (hotReloadServer) {
              // Close the HotReloadServer if it has a stop or destroy method
              if (typeof hotReloadServer.stop === 'function') {
                hotReloadServer.stop();
              } else if (typeof hotReloadServer.destroy === 'function') {
                hotReloadServer.destroy();
              }
            }
            process.exit(0);
          });
          
        } catch (watchError) {
          throw new Error(`Failed to initialize watch mode: ${watchError instanceof Error ? watchError.message : String(watchError)}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to start watch mode: ${errorMessage}`);
        process.exit(1);
      }
    });
}
