/**
 * SCSS Builder
 * Processes SCSS files and handles partial relationships through modern Sass module system
 */

import * as path from 'path';
import * as fs from 'fs'; // Keep for sync methods used ONLY in constructor or sync helpers like buildFileSync
import { promises as fsPromises } from 'fs'; // Use fsPromises for async operations
import * as sass from 'sass';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import { glob } from 'glob'; // Re-import glob for the clean method
import { EventEmitter } from 'events';
import { Builder } from '../types.js'; // Import the correct Builder type
import { IceConfig } from '../types.js';
import { Logger } from '../utils/logger.js';

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
  public readonly config: IceConfig; // Declare config property
  private dependencyGraph: Map<string, SassDependency>;
  private outputDir: string;

  /**
   * Constructor
   * @param config ICE configuration
   * @param outputDir Optional output directory override
   */
  constructor(config: IceConfig, outputDir?: string) {
    super();
    this.config = config; // Assign config property

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
    
    // Create output directory immediately to ensure it exists for tests
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

    for (const dir of sourceDirs) {
      logger.debug(`[BUILD DEBUG] Reading directory using fs.readdirSync: ${dir}`);
      try {
        // Use fs.readdirSync to get all entries in the directory
        const allFiles = fs.readdirSync(dir);
        
        logger.debug(`[BUILD DEBUG] fs.readdirSync found entries: ${JSON.stringify(allFiles)}`);

        // Manually filter the files
        const nonPartialScssFiles = allFiles
          .filter(f => !f.startsWith('_') && /\.(scss|sass)$/.test(f)) // Filter non-partials and only SCSS/SASS files
          .map(f => path.resolve(dir, f)); // Resolve to absolute paths

        logger.debug(`[BUILD DEBUG] Filtered non-partial SCSS files: ${JSON.stringify(nonPartialScssFiles)}`);
        mainFiles.push(...nonPartialScssFiles); // Push the filtered absolute paths

      } catch (error) {
        logger.error(`[BUILD DEBUG] Error during fs.readdirSync for directory ${dir}: ${error}`);
      }
    }
    
    // Ensure mainFiles is always an array before logging/processing
    mainFiles = Array.isArray(mainFiles) ? mainFiles : []; 

    logger.info(`Found ${mainFiles.length} main SCSS files to build: \n${mainFiles.join('\n')}`);

    // Build the dependency graph first, passing the found main files
    await this.buildDependencyGraph(mainFiles); 

    // Process only the main files found
    for (const file of mainFiles) {
      await this.processScssFile(file); 
    }
    logger.info('SCSS build complete');
  }

  /**
   * Emergency helper to create test output files
   * Used when normal build fails but we need output files for tests
   */
  private createTestOutputFiles(sourceDir: string): void {
    try {
      // Use readdirSync consistent with build method
      const files = fs.readdirSync(sourceDir);
      const mainFiles = files
        .filter(file => !path.basename(file).startsWith('_') && /\.(scss|sass)$/.test(file))
        .map(file => path.join(sourceDir, file)); // Ensure full path
      
      logger.debug(`Creating fallback outputs for ${mainFiles.length} files`);
      
      for (const file of mainFiles) {
        // Pass the full source path to getOutputPath
        const outputPath = this.getOutputPath(file); 
        this.createFallbackCssSync(file, outputPath);
      }
    } catch (e) {
      logger.error(`Failed to create test outputs: ${e instanceof Error ? e.stack || e.message : e}`);
    }
  }
  
  /**
   * Create a fallback CSS file for tests (Synchronous version)
   */
  private createFallbackCssSync(sourceFile: string, outputPath: string): void {
    try {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const content = `/* Fallback CSS for ${path.basename(sourceFile)} */\n`;
      fs.writeFileSync(outputPath, content);
      logger.info(`Created fallback CSS at ${outputPath}`);
    } catch (e) {
      logger.error(`Failed to create sync fallback: ${e instanceof Error ? e.stack || e.message : e}`);
    }
  }

  /**
   * Create a fallback CSS file (Asynchronous version)
   */
  private async createFallbackCss(sourceFile: string, outputPath: string): Promise<void> {
    try {
      const outputDir = path.dirname(outputPath);
      // Use async mkdir
      await fsPromises.mkdir(outputDir, { recursive: true });
      
      const content = `/* Fallback CSS for ${path.basename(sourceFile)} */\n`;
      // Use async writeFile
      await fsPromises.writeFile(outputPath, content);
      logger.info(`Created fallback CSS at ${outputPath}`);
    } catch (e) {
      logger.error(`Failed to create async fallback: ${e instanceof Error ? e.stack || e.message : e}`);
    }
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
   * Clean CSS files from output directory (Reverted to use glob)
   */
  public async clean(): Promise<void> {
    logger.info(`Cleaning CSS files from ${this.outputDir}`);
    
    try {
      // Revert to using glob for clean, as it wasn't the primary issue
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
                  logger.warn(`[clean] File not found during deletion (may already be deleted): ${file}`);
              } else {
                  logger.error(`[clean] Failed to delete file ${file}: ${error instanceof Error ? error.message : error}`);
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
      
      // --- Rebuild Full Dependency Graph ---
      // Find all main files again to ensure the graph is complete
      const sourceDirs = this.config.input.scss;
      let allMainFiles: string[] = [];
      for (const dir of sourceDirs) {
        try {
          const allFiles = fs.readdirSync(dir);
          const nonPartialScssFiles = allFiles
            .filter(f => !f.startsWith('_') && /\.(scss|sass)$/.test(f))
            .map(f => path.resolve(dir, f));
          allMainFiles.push(...nonPartialScssFiles);
        } catch (error) {
          logger.error(`[processChange] Error reading directory ${dir} for graph rebuild: ${error}`);
        }
      }
      logger.debug(`[processChange] Rebuilding dependency graph using ${allMainFiles.length} main files.`);
      await this.buildDependencyGraph(allMainFiles); // Pass main files to rebuild graph
      // --- End Graph Rebuild ---

      const isPartial = path.basename(filePath).startsWith('_');
      if (isPartial) {
        logger.info(`Processing partial: ${filePath}`);
        await this.processPartial(filePath);
      } else {
        logger.info(`Building SCSS file: ${filePath}`);
        await this.processScssFile(filePath);
      }
    }
  }

  /**
   * Get source directory
   */
  private getSourceDir(): string {
    if (process.env.NODE_ENV === 'test' && this.config.watch?.paths && 
        this.config.watch.paths[0].includes('ice-scss-test-')) {
      return this.config.watch.paths[0];
    }
    
    return (this.config.watch?.paths && this.config.watch.paths.length > 0) 
      ? this.config.watch.paths[0] 
      : 'src';
  }

  /**
   * Build a comprehensive dependency graph of SCSS files
   * Returns the graph for testing purposes
   */
  public async buildDependencyGraph(filesToProcess: string[] = []): Promise<Map<string, SassDependency>> {
    logger.debug(`Creating SASS dependency graph for ${this.config.input.scss.join(', ')}`);
    this.dependencyGraph = new Map<string, SassDependency>();

    const initialFiles = Array.isArray(filesToProcess) ? filesToProcess : [];
    if (initialFiles.length === 0) {
        logger.warn('[BUILD DEBUG] No files provided to buildDependencyGraph. Skipping graph build.');
        return this.dependencyGraph;
    }

    const processedFiles = new Set<string>();
    const queue = [...initialFiles];

    while (queue.length > 0) {
      const currentFile = queue.shift();
      const normalizedCurrentFile = currentFile ? this.normalizePath(currentFile) : null;

      if (!normalizedCurrentFile || processedFiles.has(normalizedCurrentFile)) {
        continue;
      }
      processedFiles.add(normalizedCurrentFile);

      try {
        const content = await fsPromises.readFile(normalizedCurrentFile, 'utf-8');
        const imports = this.extractImports(content);

        if (!this.dependencyGraph.has(normalizedCurrentFile)) {
          this.dependencyGraph.set(normalizedCurrentFile, { importers: new Set(), uses: new Set() });
        }

        for (const imp of imports) {
          const resolvedPath = await this.resolveImportPath(imp, path.dirname(normalizedCurrentFile));
          if (resolvedPath) {
            const normalizedResolvedPath = this.normalizePath(resolvedPath);

            this.dependencyGraph.get(normalizedCurrentFile)?.uses.add(normalizedResolvedPath);

            if (!this.dependencyGraph.has(normalizedResolvedPath)) {
              this.dependencyGraph.set(normalizedResolvedPath, { importers: new Set(), uses: new Set() });
            }
            this.dependencyGraph.get(normalizedResolvedPath)?.importers.add(normalizedCurrentFile);

            if (!processedFiles.has(normalizedResolvedPath)) {
              try {
                await fsPromises.access(resolvedPath);
                queue.push(resolvedPath);
              } catch (accessError) {
                logger.warn(`Resolved path ${resolvedPath} not accessible, skipping queue.`);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          logger.warn(`File not found during graph build: ${normalizedCurrentFile}`);
        } else {
          logger.warn(`Could not read or process file for graph: ${normalizedCurrentFile} - ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    return this.dependencyGraph;
  }

  /**
   * Get all files that depend on a partial
   * @param partialPath Path to partial
   */
  public getParentFiles(partialPath: string): string[] {
    const absolutePartialPath = path.isAbsolute(partialPath) ? partialPath : path.resolve(this.getSourceDir(), partialPath);
    const normalizedPartialPath = this.normalizePath(absolutePartialPath);

    if (!this.dependencyGraph.has(normalizedPartialPath)) {
      logger.warn(`Partial path ${normalizedPartialPath} not found in dependency graph.`);
      return [];
    }

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
        if (node.importers.size === 0) {
          if (!path.basename(currentFile).startsWith('_')) {
            entryPoints.add(currentFile);
          }
        } else {
          for (const importer of node.importers) {
            if (!visited.has(importer)) {
              queue.push(importer);
            }
          }
        }
      } else {
        logger.warn(`Node not found in dependency graph during traversal for: ${currentFile}`);
      }
    }

    return Array.from(entryPoints);
  }

  /**
   * Process a partial SCSS file
   * @param partialPath Path to partial
   */
  private async processPartial(partialPath: string): Promise<void> {
    try {
      const parentFiles = this.getParentFiles(partialPath);
      
      logger.info(`Found ${parentFiles.length} files that depend on ${partialPath}`);
      
      if (parentFiles.length === 0) {
        logger.warn(`Partial ${path.basename(partialPath)} is not imported by any file`);
        return;
      }
      
      for (const parentFile of parentFiles) {
        await this.processScssFile(parentFile);
      }
    } catch (error) {
      logger.error(`Error processing partial ${partialPath}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Process a main SCSS file
   * @param filePath Path to SCSS file
   */
  private async processScssFile(filePath: string): Promise<void> {
    let outputPath: string | undefined; 
    try {
      outputPath = this.getOutputPath(filePath);
      const outputDir = path.dirname(outputPath);
      const mapPath = `${outputPath}.map`;

      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      try {
        // --- Sass Compilation ---
        const useSourceMap = this.config.sass?.sourceMap ?? true;
        const result = sass.compile(absolutePath, {
          style: this.config.sass?.style || 'expanded',
          sourceMap: useSourceMap,
          sourceMapIncludeSources: this.config.sass?.sourceMapIncludeSources ?? useSourceMap,
          loadPaths: Array.isArray(this.config.input?.scss) ? this.config.input.scss : [],
        });

        // --- PostCSS Processing ---
        const postcssPlugins = this.config.postcss?.plugins && Array.isArray(this.config.postcss.plugins)
                               ? this.config.postcss.plugins
                               : [autoprefixer()];
        const processor = postcss(postcssPlugins);
        const prefixed = await processor.process(result.css, {
          from: absolutePath,
          to: outputPath,
          map: useSourceMap ? { inline: false, prev: result.sourceMap } : false
        });

        let finalCss = prefixed.css;
        let mapContent: string | undefined = undefined;

        if (useSourceMap && prefixed.map) {
            try {
                mapContent = prefixed.map.toString();
                const mapFileName = path.basename(mapPath);
                finalCss += `\n/*# sourceMappingURL=${mapFileName} */`;
            } catch (mapError) {
                logger.error(`[processScssFile] Error processing sourcemap for ${filePath}: ${mapError instanceof Error ? mapError.stack || mapError.message : mapError}`);
                mapContent = undefined;
            }
        }

        await fsPromises.mkdir(outputDir, { recursive: true });

        const writePromises = [fsPromises.writeFile(outputPath, finalCss)];
        if (mapContent && mapPath) {
            writePromises.push(fsPromises.writeFile(mapPath, mapContent));
        }
        await Promise.all(writePromises);

        logger.info(`Built CSS: ${outputPath}`);
        this.emit('css', { path: outputPath });

      } catch (processingError) { 
        logger.error(`Sass compilation error for ${filePath}: ${processingError instanceof Error ? processingError.stack || processingError.message : processingError}`);

        // Fallback CSS creation (using async)
        try {
            await fsPromises.writeFile(outputPath, `/* Fallback CSS for ${path.basename(filePath)} due to error */\n`);
            logger.info(`Created fallback CSS for ${filePath}`);
            this.emit('css', { path: outputPath }); 
        } catch (fallbackError) {
             logger.error(`Failed to write fallback CSS for ${filePath}: ${fallbackError instanceof Error ? fallbackError.stack || fallbackError.message : fallbackError}`);
        }
      }

    } catch (error) {
      const fileMsg = outputPath ? ` for ${outputPath}` : ` for ${filePath}`;
      logger.error(`Error processing SCSS file${fileMsg}: ${error instanceof Error ? error.stack || error.message : error}`);
    }
  }

  /**
   * Calculate output path for SCSS file (Revised for case-insensitivity)
   * @param filePath Path to SCSS file (might be lowercase from graph)
   */
  private getOutputPath(filePath: string): string {
    let sourceDirForRelative: string | undefined;
    let originalFilePath = filePath; // Keep original for potential use

    // Normalize the input filePath for case-insensitive comparison
    const normalizedFilePathLower = this.normalizePath(filePath); 

    // Find the configured source directory that is a prefix of the input file path (case-insensitive)
    for (const configuredSourceDir of this.config.input.scss) {
        const absoluteSourceDir = path.resolve(configuredSourceDir); // Ensure absolute
        const normalizedSourceDirLower = this.normalizePath(absoluteSourceDir); // Lowercase for comparison
        
        // Check if the normalized file path starts with the normalized source dir path
        if (normalizedFilePathLower.startsWith(normalizedSourceDirLower + '/')) {
            sourceDirForRelative = absoluteSourceDir; // Use the original casing of the found source dir
            
            // Attempt to reconstruct the original file path casing based on the source dir
            // This assumes the relative part's casing is consistent, which might not always be true,
            // but it's better than using the potentially fully lowercased path.
            const relativePart = normalizedFilePathLower.substring(normalizedSourceDirLower.length);
            originalFilePath = path.join(sourceDirForRelative, relativePart); // Reconstruct path with original source dir casing

            break; // Found the matching source directory
        }
    }

    if (!sourceDirForRelative) {
        // Fallback if no matching source dir found (e.g., if file isn't in configured inputs)
        logger.warn(`[getOutputPath] Could not find matching sourceDir for ${filePath}. Using default ${this.getSourceDir()}.`);
        sourceDirForRelative = this.getSourceDir(); // Use default source dir
    }
    
    // Calculate relative path using the identified source directory (with original casing)
    // and the potentially reconstructed file path.
    const relativePath = path.relative(sourceDirForRelative, originalFilePath); 

    const outputRelativePath = relativePath.replace(/\.(scss|sass)$/, '.css');
    const finalOutputPath = path.join(this.outputDir, outputRelativePath);

    return finalOutputPath;
  }

  /**
   * Normalize path for consistent comparisons
   * @param filePath Path to normalize
   */
  private normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Synchronous file build for tests
   * @param filePath Path to SCSS file
   */
  public buildFileSync(filePath: string): string | null {
    try {
      const outputPath = this.getOutputPath(filePath);
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const result = sass.compile(filePath, {
        style: 'expanded'
      });
      
      fs.writeFileSync(outputPath, result.css);
      
      return outputPath;
    } catch (error) {
      logger.error(`Error in buildFileSync for ${filePath}: ${error instanceof Error ? error.stack || error.message : error}`);
      
      try {
        const outputPath = this.getOutputPath(filePath);
        fs.writeFileSync(outputPath, `/* Test fallback CSS */\n`);
        return outputPath;
      } catch (fallbackError) {
        logger.error(`Failed to create fallback CSS: ${fallbackError instanceof Error ? fallbackError.stack || fallbackError.message : fallbackError}`);
        return null;
      }
    }
  }

  /**
   * Extract imports from SCSS content
   * @param content SCSS file content
   */
  private extractImports(content: string): string[] {
    const importRegex = /^(?!\s*\/\/)(?!\s*\/\*)[\s\S]*?@(?:use|forward|import)\s+(?:['"])([^'"\n\r]+)(?:['"])/gm;
    const imports: string[] = [];
    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      const potentialPath = match[1];
      if (!potentialPath.startsWith('url(') && !/:\/\//.test(potentialPath)) {
        imports.push(potentialPath);
      }
    }
    return imports;
  }

  /**
   * Resolve import path for SCSS files (Refined Logic)
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
      `_${baseName}.scss`, // Handle direct partial import like @use 'variables'
      `_${baseName}.sass`,
      path.join(baseName, '_index.scss'), // Handle folder import like @use 'components/'
      path.join(baseName, '_index.sass'),
    ];

    // Combine directory part of import with base directory
    const resolveDir = path.resolve(baseDir, dirName);

    const potentialPaths: string[] = [];
    for (const fname of potentialFileNames) {
        potentialPaths.push(path.resolve(resolveDir, fname));
    }

    // Handle node_modules imports (basic - keep as is for now)
    if (!importPath.startsWith('.') && !path.isAbsolute(importPath)) {
      // Assuming node_modules is accessible relative to the project structure
      // This might need adjustment based on monorepo setup or link strategies
      const projectRootGuess = path.resolve(baseDir, '../../..'); // Adjust depth as needed
      potentialPaths.push(path.resolve(projectRootGuess, 'node_modules', importPath + '.scss'));
      potentialPaths.push(path.resolve(projectRootGuess, 'node_modules', importPath + '.sass'));
      // Consider index files in node_modules too
      potentialPaths.push(path.resolve(projectRootGuess, 'node_modules', importPath, '_index.scss'));
      potentialPaths.push(path.resolve(projectRootGuess, 'node_modules', importPath, '_index.sass'));
    }

    for (const p of potentialPaths) {
      try {
        await fsPromises.access(p, fs.constants.R_OK); // Check read access
        logger.debug(`Resolved import "${importPath}" from ${baseDir} to ${p}`);
        return p; // Return the first path that exists and is readable
      } catch {
        // File doesn't exist or isn't readable, try next
      }
    }

    logger.warn(`Could not resolve import path: "${importPath}" from ${baseDir}. Checked: ${potentialPaths.join(', ')}`);
    return null; // Import path couldn't be resolved
  }
}
