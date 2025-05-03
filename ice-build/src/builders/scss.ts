/**
 * SCSS Builder
 * Processes SCSS files and handles partial relationships
 */

import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as sass from 'sass';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { Builder } from '../types.js';
import { IceConfig } from '../types.js';
import { Logger } from '../utils/logger.js';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

// Create logger instance
const logger = new Logger('scss');

/**
 * Represents a dependency relationship between SCSS files
 */
interface SassDependency {
  importers: Set<string>;
  uses: Set<string>;
}

/**
 * SCSS Builder class 
 * Handles compilation of SCSS files and dependency tracking
 */
export class SCSSBuilder extends EventEmitter implements Builder {
  public readonly config: IceConfig;
  private dependencyGraph: Map<string, SassDependency>;
  private outputDir: string;

  // Initialize cache for faster lookups
  private partialCache: Map<string, string[]> = new Map();

  /**
   * Constructor
   * @param config ICE configuration
   * @param outputDir Optional output directory override
   */
  constructor(config: IceConfig, outputDir?: string) {
    super();
    this.config = config;

    // Handle different output configurations
    if (outputDir) {
      this.outputDir = outputDir;
    } else if (typeof this.config.output === 'string') {
      this.outputDir = this.config.output;
    } else if (this.config.output && typeof this.config.output === 'object' && 'path' in this.config.output) {
      this.outputDir = this.config.output.path;
    } else {
      this.outputDir = 'public'; // Default fallback
    }
    
    // Create output directory immediately 
    if (!fs.existsSync(this.outputDir)) {
      try {
        fs.mkdirSync(this.outputDir, { recursive: true });
      } catch (e) {
        // Ignore directory creation errors in constructor
      }
    }
    
    // Initialize empty dependency graph
    this.dependencyGraph = new Map<string, SassDependency>();
  }

  /**
   * Build all SCSS files in project
   */
  public async build(): Promise<void> {
    logger.info('Building all SCSS files');
    const sourceDirs = this.config.input.scss;
    let mainFiles: string[] = []; 

    // Process all source directories from config.input.scss
    for (const pattern of sourceDirs) {
      try {
        logger.debug(`Searching for SCSS files with pattern: ${pattern}`);
        
        // Use glob to find all matching files
        const files = await glob(pattern);
        
        // Filter non-partials (files not starting with _)
        const nonPartialFiles = files.filter(file => !path.basename(file).startsWith('_'));
        mainFiles.push(...nonPartialFiles);
        
      } catch (error) {
        logger.error(`[BUILD DEBUG] Error finding SCSS files with pattern ${pattern}: ${error}`);
      }
    }
    
    logger.info(`Found ${mainFiles.length} main SCSS files to build`);

    // Fix: Call without arguments 
    await this.buildDependencyGraph();

    // Process only the main files found
    for (const file of mainFiles) {
      await this.processScssFile(file); 
    }
    logger.info('SCSS build complete');
  }

  /**
   * Build a single SCSS file
   * @param filePath Path to SCSS file
   */
  public async buildFile(filePath: string): Promise<void> {
    logger.info(`Building SCSS file: ${filePath}`);
    
    const isPartial = path.basename(filePath).startsWith('_');
    
    if (isPartial) {
      await this.processPartial(filePath);
    } else {
      await this.processScssFile(filePath);
    }
  }

  /**
   * Clean CSS files from output directory
   */
  public async clean(): Promise<void> {
    logger.info(`Cleaning CSS files from ${this.outputDir}`);
    
    try {
      const cssPattern = path.join(this.outputDir, '**/*.css').replace(/\\/g, '/');
      const mapPattern = path.join(this.outputDir, '**/*.css.map').replace(/\\/g, '/');

      const [cssFiles, mapFiles] = await Promise.all([
          glob(cssPattern),
          glob(mapPattern)
      ]);
      const filesToDelete = [...cssFiles, ...mapFiles];

      if (filesToDelete.length === 0) {
          logger.info('No CSS or map files found to clean.');
          return;
      }

      let deletedCount = 0;
      for (const file of filesToDelete) {
          try {
              await fsPromises.unlink(file); 
              deletedCount++;
          } catch (error: any) {
              if (error.code === 'ENOENT') {
                  logger.warn(`File not found during deletion: ${file}`);
              } else {
                  logger.error(`Failed to delete file ${file}: ${error instanceof Error ? error.message : error}`);
              }
          }
      } 
      logger.success(`Cleaned ${deletedCount} CSS/map files.`);
    } catch (error) {
      logger.error(`Error during CSS clean process: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Process a file change
   * @param filePath Path to changed file
   */
  public async processChange(filePath: string): Promise<void> {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.scss' || extension === '.sass') {
      logger.info(`SCSS change detected: ${filePath}`);
      
      try {
        // Always rebuild the dependency graph first to catch new relationships
        logger.debug('Rebuilding SCSS dependency graph');
        await this.buildDependencyGraph();
        
        const isPartial = path.basename(filePath).startsWith('_');
        if (isPartial) {
          logger.info(`Processing SCSS partial: ${filePath}`);
          
          // Get all files that depend on this partial
          const parentFiles = this.getParentFiles(filePath);
          logger.info(`Found ${parentFiles.length} files that depend on ${path.basename(filePath)}`);
          
          if (parentFiles.length === 0) {
            logger.warn(`No parent files found that import ${path.basename(filePath)}`);
            // Even though no parents were found, attempt to process the partial directly
            // This is important for new partials that might not be in the dependency graph yet
            await this.processScssFile(filePath);
            return;
          }
          
          // Process each parent file
          for (const parentFile of parentFiles) {
            logger.info(`Rebuilding parent file: ${parentFile}`);
            await this.processScssFile(parentFile);
          }
        } else {
          logger.info(`Building SCSS file directly: ${filePath}`);
          await this.processScssFile(filePath);
        }
      } catch (error) {
        logger.error(`Error processing SCSS change: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  /**
   * Calculate output path for SCSS file
   * @param filePath Path to SCSS file
   */
  private getOutputPath(filePath: string): string {
    // Simplify the output path calculation
    const sourcePath = path.resolve(process.cwd(), 'source');
    let relativePath = '';
    
    if (filePath.startsWith(sourcePath)) {
      // If file is directly under the source directory
      relativePath = path.relative(sourcePath, filePath);
    } else {
      // Try to match against configured source paths
      const patterns = this.config.input.scss;
      let matched = false;
      
      for (const pattern of patterns) {
        // Extract base directory from glob pattern
        const baseDir = pattern.replace(/\/\*\*\/\*\.[^.]+$|\*\*\/\*\.[^.]+$|\*\.[^.]+$/g, '');
        
        if (filePath.startsWith(baseDir)) {
          relativePath = path.relative(baseDir, filePath);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        // Fallback - use the file name only
        relativePath = path.basename(filePath);
      }
    }

    // Convert to CSS extension  
    const outputRelativePath = relativePath.replace(/\.(scss|sass)$/, '.css');
    
    // Join with output directory
    return path.join(this.outputDir, outputRelativePath);
  }

  /**
   * Get all SCSS files based on the configured patterns
   */
  private async getAllScssFiles(): Promise<string[]> {
    const files: string[] = [];
    
    // Use configured input patterns
    const patterns = this.config.input.scss || ['source/**/*.scss', 'src/**/*.scss'];
    
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern);
        files.push(...matches);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error finding files for pattern ${pattern}: ${errorMessage}`);
      }
    }
    
    return files;
  }

  /**
   * Build a comprehensive dependency graph of SCSS files
   */
  public async buildDependencyGraph(): Promise<Map<string, SassDependency>> {
    logger.info('Building SCSS dependency graph');
    
    // Clear existing graph
    this.dependencyGraph = new Map<string, SassDependency>();
    
    try {
      // Get all SCSS files in one operation
      const allScssFiles = await this.getAllScssFiles();
      logger.debug(`Found ${allScssFiles.length} total SCSS files`);
      
      // First pass: Process each file to extract imports
      for (const file of allScssFiles) {
        if (!fs.existsSync(file)) continue;
        
        try {
          const content = await fsPromises.readFile(file, 'utf-8');
          const normalizedPath = this.normalizePath(file);
          
          // Initialize in graph even if no imports
          if (!this.dependencyGraph.has(normalizedPath)) {
            this.dependencyGraph.set(normalizedPath, { 
              importers: new Set(),
              uses: new Set() 
            });
          }
          
          // Extract all imports (@import, @use, @forward)
          const imports = this.extractImports(content);
          logger.debug(`File ${path.basename(file)} has ${imports.length} imports`);
          
          // Process each import
          for (const importPath of imports) {
            const resolvedPath = await this.resolveImportPath(importPath, path.dirname(file));
            
            if (resolvedPath) {
              const normalizedImport = this.normalizePath(resolvedPath);
              
              // Add to this file's dependencies
              this.dependencyGraph.get(normalizedPath)?.uses.add(normalizedImport);
              
              // Initialize imported file in graph if needed
              if (!this.dependencyGraph.has(normalizedImport)) {
                this.dependencyGraph.set(normalizedImport, { 
                  importers: new Set(),
                  uses: new Set() 
                });
              }
              
              // Add back-reference (this file imports the dependency)
              this.dependencyGraph.get(normalizedImport)?.importers.add(normalizedPath);
              
              logger.debug(`Added dependency: ${path.basename(file)} -> ${path.basename(resolvedPath)}`);
            } else {
              logger.warn(`Could not resolve import '${importPath}' in ${file}`);
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error processing ${file}: ${errorMessage}`);
        }
      }
      
      logger.success(`Dependency graph built with ${this.dependencyGraph.size} nodes`);
      return this.dependencyGraph;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error building dependency graph: ${errorMessage}`);
      return new Map(); // Return empty graph on failure
    }
  }

  /**
   * Extract imports from SCSS content
   * @param content SCSS file content
   */
  public extractImports(content: string): string[] {
    // More comprehensive regex to catch different import formats including @use
    const importRegex = /@(?:import|use|forward)\s+['"]([^'";\n\r]+)['"]/gm;
    const imports: string[] = [];
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1].trim();
      imports.push(importPath);
      logger.debug(`Found import: ${importPath}`);
    }
    
    return imports;
  }

  /**
   * Get all files that depend on a partial
   * @param partialPath Path to partial
   */
  public getParentFiles(partialPath: string): string[] {
    // Normalize the path for consistent lookup
    const absolutePartialPath = path.isAbsolute(partialPath) ? partialPath : path.resolve(process.cwd(), partialPath);
    const normalizedPartialPath = this.normalizePath(absolutePartialPath);

    logger.debug(`Looking for parents of: ${normalizedPartialPath}`);

    if (!this.dependencyGraph.has(normalizedPartialPath)) {
      logger.warn(`Partial path ${normalizedPartialPath} not found in dependency graph.`);
      
      // Try to rebuild the dependency graph once in case it's stale
      this.buildDependencyGraph().then(() => {
        logger.debug(`Rebuilt dependency graph with ${this.dependencyGraph.size} nodes`);
      }).catch(error => {
        logger.error(`Failed to rebuild dependency graph: ${error instanceof Error ? error.message : String(error)}`);
      });
      
      return [];
    }

    // Get all files that directly or indirectly import this partial
    const visited = new Set<string>();
    const entryPoints = new Set<string>();
    const queue = [normalizedPartialPath];

    while (queue.length > 0) {
      const currentFile = queue.shift();
      if (!currentFile || visited.has(currentFile)) {
        continue;
      }
      visited.add(currentFile);

      const node = this.dependencyGraph.get(currentFile);
      if (node) {
        // If file has no importers, it's an entry point (if not a partial)
        if (node.importers.size === 0) {
          if (!path.basename(currentFile).startsWith('_')) {
            entryPoints.add(currentFile);
            logger.debug(`Found entry point: ${currentFile}`);
          }
        } else {
          // Add all importers to the queue
          for (const importer of node.importers) {
            if (!visited.has(importer)) {
              queue.push(importer);
              logger.debug(`Added to traversal queue: ${importer}`);
            }
          }
        }
      }
    }

    const result = Array.from(entryPoints);
    return result;
  }

  /**
   * Process a partial SCSS file
   * @param partialPath Path to partial
   */
  private async processPartial(partialPath: string): Promise<void> {
    try {
      // Make sure the dependency graph is up to date
      await this.buildDependencyGraph();
      
      // Get parent files
      const parentFiles = this.getParentFiles(partialPath);
      
      logger.info(`Found ${parentFiles.length} files that depend on ${partialPath}`);
      
      if (parentFiles.length === 0) {
        logger.warn(`Partial ${path.basename(partialPath)} is not imported by any file`);
        
        // For standalone partials with no parents, try to build it directly
        try {
          logger.info(`Attempting to build partial directly: ${partialPath}`);
          await this.processScssFile(partialPath);
        } catch (directBuildError) {
          logger.error(`Failed to build partial directly: ${directBuildError instanceof Error ? directBuildError.message : String(directBuildError)}`);
        }
        return;
      }
      
      // Process each parent file
      for (const parentFile of parentFiles) {
        logger.info(`Processing parent file: ${parentFile}`);
        await this.processScssFile(parentFile);
      }
    } catch (error) {
      logger.error(`Error processing partial ${partialPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process a main SCSS file
   * @param filePath Path to SCSS file
   */
  private async processScssFile(filePath: string): Promise<void> {
    try {
      // Ensure file exists
      try {
        await fsPromises.access(filePath, fs.constants.R_OK);
      } catch (error) {
        logger.error(`Cannot access SCSS file ${filePath}: file may not exist`);
        return;
      }
      
      const outputPath = this.getOutputPath(filePath);
      const outputDir = path.dirname(outputPath);
      const mapPath = `${outputPath}.map`;
      
      logger.info(`Processing SCSS: ${filePath} -> ${outputPath}`);

      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      try {
        // Sass compilation with config settings
        const useSourceMap = this.config.sass?.sourceMap ?? true;
        const sassStyle = this.config.sass?.style || 'expanded';
        
        // Get include paths from config
        const includePaths: string[] = [];
        
        // Fix: Check for both sass and scss properties
        const sassConfig = this.config.sass || {};
        const scssConfig = (this.config as any).scss || {};
        
        // Use includePaths from either sass or scss property
        if (Array.isArray(sassConfig.includePaths)) {
          includePaths.push(...sassConfig.includePaths);
        }
        
        if (Array.isArray(scssConfig.includePaths)) {
          includePaths.push(...scssConfig.includePaths);
        }
        
        // Add source directories
        if (Array.isArray(this.config.input?.scss)) {
          includePaths.push(
            ...this.config.input.scss.map(p => p.replace(/\/\*\*\/\*\.scss|\*\*\/\*\.scss|\*\.scss/g, ''))
          );
        }
        
        const result = sass.compile(absolutePath, {
          style: sassStyle,
          sourceMap: useSourceMap,
          sourceMapIncludeSources: useSourceMap,
          loadPaths: includePaths
        });

        // After successful Sass compilation:
        if (result.css) {
          // Process with PostCSS
          const postcssPlugins = [
            autoprefixer(),
            ...(Array.isArray(this.config.postcss?.plugins) ? this.config.postcss.plugins : [])
          ];
          
          const postcssResult = await postcss(postcssPlugins)
            .process(result.css, { 
              from: outputPath,
              to: outputPath,
              map: useSourceMap ? { inline: false } : false
            });

          // Write processed CSS
          await fsPromises.mkdir(outputDir, { recursive: true });
          await fsPromises.writeFile(outputPath, postcssResult.css);
          
          // Write source map if enabled
          if (useSourceMap && postcssResult.map) {
            await fsPromises.writeFile(mapPath, postcssResult.map.toString());
          }

          logger.info(`Built CSS: ${outputPath}`);
          this.emit('css', { path: outputPath });
        }
      } catch (error) {
        logger.error(`Failed to compile ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Create fallback CSS for failed compilations
        try {
          await fsPromises.mkdir(outputDir, { recursive: true });
          await fsPromises.writeFile(outputPath, `/* Error compiling ${path.basename(filePath)} */\n`);
          logger.info(`Created fallback CSS for ${filePath}`);
          this.emit('css', { path: outputPath });
        } catch (fallbackError) {
          logger.error(`Failed to create fallback CSS: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
    } catch (error) {
      logger.error(`Error processing SCSS file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Normalize path for consistent comparisons
   * @param filePath Path to normalize
   */
  public normalizePath(filePath: string): string {
    // Changed from private to public for testing
    return path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Resolve import path for SCSS files
   * @param importPath Import path
   * @param baseDir Base directory of the importing file
   */
  private async resolveImportPath(importPath: string, baseDir: string): Promise<string | null> {
    const baseName = path.basename(importPath);
    const dirName = path.dirname(importPath);

    // Construct potential filenames (_prefix and extensions)
    const potentialFileNames = [
      `${baseName}.scss`,
      `${baseName}.sass`,
      `_${baseName}.scss`,
      `_${baseName}.sass`,
      path.join(baseName, '_index.scss'),
      path.join(baseName, '_index.sass'),
      path.join(baseName, 'index.scss'),
      path.join(baseName, 'index.sass')
    ];

    // Combine directory part of import with base directory
    const resolveDir = path.resolve(baseDir, dirName);

    // Try all potential filenames
    for (const fname of potentialFileNames) {
      const fullPath = path.resolve(resolveDir, fname);
      try {
        await fsPromises.access(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch {
        // File doesn't exist, try next
      }
    }

    // Try node_modules if importPath isn't relative
    if (!importPath.startsWith('.') && !path.isAbsolute(importPath)) {
      // Check in node_modules
      const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
      
      for (const fname of potentialFileNames) {
        const fullPath = path.resolve(nodeModulesPath, importPath, fname);
        try {
          await fsPromises.access(fullPath, fs.constants.R_OK);
          return fullPath;
        } catch {
          // File doesn't exist, try next
        }
      }
    }

    logger.warn(`Could not resolve import: "${importPath}" from ${baseDir}`);
    return null;
  }

  /**
   * Resolve a node_modules import
   */
  private async resolveNodeModulesImport(importPath: string): Promise<string | null> {
    const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
    
    const potentialFileNames = [
      path.join(nodeModulesPath, importPath + '.scss'),
      path.join(nodeModulesPath, importPath + '.sass'),
      path.join(nodeModulesPath, importPath, 'index.scss'),
      path.join(nodeModulesPath, importPath, 'index.sass'),
      path.join(nodeModulesPath, importPath, '_index.scss'),
      path.join(nodeModulesPath, importPath, '_index.sass')
    ];
    
    for (const fullPath of potentialFileNames) {
      try {
        await fsPromises.access(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch {
        // File doesn't exist, try next
      }
    }
    
    return null;
  }
}
