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
  private hotReloadServer: any = null;

  constructor(config: IceConfig, outputPath: string) {
    this.config = config;
    this.outputPath = outputPath;
  }

  public setHotReloadServer(server: any) {
    this.hotReloadServer = server;
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
      // --- Determine output directory ---
      let outDir = this.outputPath;
      const tsconfigPath = await this.findTsConfig();
      if (tsconfigPath) {
        try {
          const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
          const tsconfig = JSON.parse(tsconfigContent);
          if (tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
            outDir = path.resolve(path.dirname(tsconfigPath), tsconfig.compilerOptions.outDir);
            logger.info(`[TypeScript] Using outDir from tsconfig.json: ${outDir}`);
          } else {
            logger.info(`[TypeScript] No outDir in tsconfig.json, using output.path from ice.config.js: ${outDir}`);
          }
        } catch (e) {
          logger.warn(`[TypeScript] Failed to read or parse tsconfig.json for outDir: ${e}`);
        }
      }
      await esbuild.build({
        entryPoints,
        outdir: outDir,
        format: 'esm',
        ...this.config.esbuild,
        tsconfig: tsconfigPath,
        plugins,
      });
      const endTime = Date.now();
      logger.success(`TypeScript build completed in ${endTime - startTime}ms`);
    } catch (error: any) {
      logger.error(`TypeScript build failed: ${error.message}`);
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

  /**
   * Calculate output path for TypeScript file
   * @param filePath Path to TypeScript file
   */
  private getOutputPath(filePath: string): string {
    const inputFileBaseName = path.basename(filePath, path.extname(filePath)); // e.g., "app"

    let filenamePattern = '[name].js'; // Default pattern

    if (this.config.output && typeof this.config.output === 'object' && this.config.output.filenames && this.config.output.filenames.js) {
      filenamePattern = this.config.output.filenames.js;
    }
    
    // Replace [name] placeholder
    const outputFileNameWithSubDir = filenamePattern.replace('[name]', inputFileBaseName);

    // this.outputPath is already set to config.output.path (e.g., "public")
    const fullOutputPath = path.join(this.outputPath, outputFileNameWithSubDir);

    return fullOutputPath;
  }

  /**
   * Process a TypeScript file
   * @param filePath Path to TypeScript file
   */
  private async processTypeScriptFile(filePath: string): Promise<void> {
    try {
      const outputPath = this.getOutputPath(filePath);
      const outputDir = path.dirname(outputPath);
      const mapPath = `${outputPath}.map`;
      
      logger.info(`Processing TypeScript: ${path.basename(filePath)} -> ${path.basename(outputPath)}`);

      // Ensure output directory exists - fix: use fs instead of fsPromises
      await fs.mkdir(outputDir, { recursive: true });

      // ...rest of existing compilation code...
    } catch (error) {
      logger.error(`Error processing TypeScript file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Add a method to handle the ts/ to js/ directory structure transformation during build
  private transformOutputPath(buildOptions: esbuild.BuildOptions): esbuild.BuildOptions {
    // Override esbuild's outfile with our own path transformation
    const outfileTransformer: esbuild.Plugin = {
      name: 'outfile-transformer',
      setup(build) {
        build.onResolve({ filter: /\.ts$/ }, args => {
          // Check if the file is in a ts/ directory
          if (args.path.includes('/ts/')) {
            const jsPath = args.path.replace('/ts/', '/js/');
            return { path: jsPath, external: false };
          }
          return { path: args.path };
        });
      }
    };

    // Add our transformer plugin
    if (!buildOptions.plugins) buildOptions.plugins = [];
    buildOptions.plugins.push(outfileTransformer);

    return buildOptions;
  }

  async buildFile(filePath: string): Promise<void> {
    logger.info(`Building TypeScript file: ${filePath}`);
    try {
      const startTime = Date.now();
      const plugins = await this.configurePlugins();
      const outputPath = this.getOutputPath(filePath);
      logger.info(`Output will be written to: ${outputPath}`);
      const buildOptions: esbuild.BuildOptions = {
        entryPoints: [filePath],
        outfile: outputPath,
        format: 'esm',
        ...this.config.esbuild,
        tsconfig: await this.findTsConfig(),
        plugins,
      };
      const transformedOptions = this.transformOutputPath(buildOptions);
      await esbuild.build(transformedOptions);
      const endTime = Date.now();
      logger.success(`TypeScript file built in ${endTime - startTime}ms`);
      if (this.hotReloadServer) {
        this.hotReloadServer.notifyClients('js', outputPath);
      }
    } catch (error: any) {
      logger.error(`TypeScript file build failed: ${error.message}`);
      throw error;
    }
  }
}
