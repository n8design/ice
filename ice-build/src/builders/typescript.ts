import { Builder, IceConfig } from '../types.js';
import * as esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { Logger } from '../utils/logger.js';

const logger = new Logger('TypeScript');

export class TypeScriptBuilder implements Builder {
  private config: IceConfig;
  private outputPath: string;

  constructor(config: IceConfig, outputPath: string) {
    this.config = config;
    this.outputPath = outputPath;
  }

  async build(): Promise<void> {
    logger.info('Building TypeScript files');
    
    try {
      const entryPoints = await this.resolveEntryPoints();
      logger.info(`Found ${entryPoints.length} TypeScript entry points`);

      if (entryPoints.length === 0) {
        logger.warn('No TypeScript files found to build');
        return;
      }

      const startTime = Date.now();
      
      // Configure plugins for SCSS handling in TS
      const plugins = await this.configurePlugins();
      
      await esbuild.build({
        entryPoints,
        outdir: this.outputPath,
        format: 'esm',
        ...this.config.esbuild,
        // Load tsconfig.json if it exists
        tsconfig: await this.findTsConfig(),
        // Add plugins for handling SCSS imports
        plugins,
      });
      
      const endTime = Date.now();
      logger.success(`TypeScript build completed in ${endTime - startTime}ms`);
    } catch (error: any) {
      logger.error(`TypeScript build failed: ${error.message}`);
      throw error;
    }
  }

  async buildFile(filePath: string): Promise<void> {
    logger.info(`Building TypeScript file: ${filePath}`);
    
    try {
      const startTime = Date.now();
      
      // Configure plugins for SCSS handling in TS  
      const plugins = await this.configurePlugins();
      
      await esbuild.build({
        entryPoints: [filePath],
        outdir: this.outputPath,
        format: 'esm',
        ...this.config.esbuild,
        tsconfig: await this.findTsConfig(),
        plugins,
      });
      
      const endTime = Date.now();
      logger.success(`TypeScript file built in ${endTime - startTime}ms`);
    } catch (error: any) {
      logger.error(`TypeScript file build failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a file change event
   * @param filePath Path to the changed file
   */
  public async processChange(filePath: string): Promise<void> {
    // For TypeScript files, we can just call buildFile
    await this.buildFile(filePath);
  }

  // Add a method to configure plugins including SCSS handling
  private async configurePlugins(): Promise<esbuild.Plugin[]> {
    const plugins: esbuild.Plugin[] = [];
    
    // Create a simple SCSS handling plugin
    plugins.push({
      name: 'scss-handler',
      setup(build) {
        // For .scss and .sass files, just ignore them in TS builds
        // They'll be handled separately by the SCSS builder
        build.onResolve({ filter: /\.s[ac]ss$/ }, args => {
          return { path: args.path, external: true };
        });
      }
    });
    
    return plugins;
  }

  async clean(): Promise<void> {
    logger.info('Cleaning TypeScript build output');
    
    try {
      // Find all JS files in the output directory
      const files = await glob(`${this.outputPath}/**/*.js`);
      
      for (const file of files) {
        await fs.unlink(file);
        
        // Also remove source map if it exists
        const mapFile = `${file}.map`;
        try {
          await fs.access(mapFile);
          await fs.unlink(mapFile);
        } catch {
          // Map file doesn't exist, ignore
        }
      }
      
      logger.success(`Cleaned ${files.length} output files`);
    } catch (error: any) {
      logger.error(`Failed to clean output: ${error.message}`);
      throw error;
    }
  }

  private async resolveEntryPoints(): Promise<string[]> {
    const entryPoints: string[] = [];
    
    for (const pattern of this.config.input.ts) {
      const files = await glob(pattern);
      entryPoints.push(...files);
    }
    
    return entryPoints;
  }

  private async findTsConfig(): Promise<string | undefined> {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    
    try {
      await fs.access(tsconfigPath);
      logger.info(`Using tsconfig.json from ${tsconfigPath}`);
      
      // Read tsconfig to log some key settings for debugging
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);
      logger.debug(`tsconfig.json settings: target=${tsconfig.compilerOptions?.target}, module=${tsconfig.compilerOptions?.module}`);
      
      return tsconfigPath;
    } catch {
      logger.warn('No tsconfig.json found, using default TypeScript settings');
      return undefined;
    }
  }
}
