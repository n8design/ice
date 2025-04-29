import { Builder, IceConfig } from '../types.js';
import { TypeScriptBuilder } from './typescript.js';
import { SCSSBuilder } from './scss.js';
import path from 'path';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Builder');

export class BuildManager {
  private tsBuilder: TypeScriptBuilder;
  private scssBuilder: SCSSBuilder;
  private config: IceConfig;
  private outputPath: string;

  constructor(config: IceConfig, outputPath: string) {
    this.config = config;
    this.outputPath = outputPath;
    this.tsBuilder = new TypeScriptBuilder(config, outputPath);
    this.scssBuilder = new SCSSBuilder(config, outputPath);
  }

  async buildAll(): Promise<void> {
    logger.info('Starting full build');
    const startTime = Date.now();
    
    // Build TypeScript and SCSS in parallel
    await Promise.all([
      this.tsBuilder.build(),
      this.scssBuilder.build()
    ]);
    
    const endTime = Date.now();
    logger.success(`Full build completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
  }

  async cleanAll(): Promise<void> {
    logger.info('Cleaning all output files');
    
    // Clean TypeScript and SCSS output in parallel
    await Promise.all([
      this.tsBuilder.clean(),
      this.scssBuilder.clean()
    ]);
    
    logger.success('Output directory cleaned');
  }

  getBuilderForFile(filePath: string): Builder | null {
    const ext = path.extname(filePath);
    
    if (ext === '.ts' || ext === '.tsx') {
      return this.tsBuilder;
    } else if (ext === '.scss' || ext === '.sass') {
      return this.scssBuilder;
    } else {
      return null;
    }
  }

  getScssBuilder(): SCSSBuilder {
    return this.scssBuilder;
  }
}
