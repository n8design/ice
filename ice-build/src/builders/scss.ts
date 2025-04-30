import { Builder, IceConfig } from '../types.js';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import * as sass from 'sass';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { glob } from 'glob';
import sassGraph from 'sass-graph';
import { Logger } from '../utils/logger.js';
import { formatTime } from '../utils/helpers.js';

const logger = new Logger('SCSS');

/**
 * Normalize paths to use forward slashes for cross-platform compatibility
 */
function normalizePath(filepath: string): string {
  return filepath.replace(/\\/g, '/');
}

export class SCSSBuilder implements Builder {
  private config: IceConfig;
  private outputPath: string;
  private dependencyGraph: any;

  constructor(config: IceConfig, outputPath: string) {
    this.config = config;
    this.outputPath = outputPath;
  }

  async build(): Promise<void> {
    logger.info('Building SCSS files');
    
    try {
      const entryPoints = await this.resolveEntryPoints();
      logger.info(`Found ${entryPoints.length} SCSS entry points`);

      if (entryPoints.length === 0) {
        logger.warn('No SCSS files found to build');
        return;
      }

      // Build the dependency graph for all SCSS files
      this.buildDependencyGraph();

      const startTime = Date.now();
      
      // Process each entry point
      for (const file of entryPoints) {
        await this.processScssFile(file);
      }
      
      const endTime = Date.now();
      logger.success(`SCSS build completed in ${formatTime(endTime - startTime)}`);
    } catch (error: any) {
      logger.error(`SCSS build failed: ${error.message}`);
      throw error;
    }
  }

  async buildFile(filePath: string): Promise<void> {
    logger.info(`Building SCSS file: ${filePath}`);
    
    try {
      // If it's a partial, find the main files that depend on it
      if (path.basename(filePath).startsWith('_')) {
        logger.info(`Processing partial: ${filePath}`);
        return await this.processPartial(filePath);
      }
      
      // Otherwise, process it as a main file
      await this.processScssFile(filePath);
    } catch (error: any) {
      logger.error(`SCSS file build failed: ${error.message}`);
      throw error;
    }
  }

  async clean(): Promise<void> {
    logger.info('Cleaning SCSS build output');
    
    try {
      // Find all CSS files in the output directory
      const files = await glob(`${this.outputPath}/**/*.css`);
      
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
    
    for (const pattern of this.config.input.scss) {
      const files = await glob(pattern);
      
      // Filter out partials (files starting with _)
      const mainFiles = files.filter(file => !path.basename(file).startsWith('_'));
      entryPoints.push(...mainFiles);
    }
    
    return entryPoints;
  }

  private buildDependencyGraph(): void {
    try {
      const directories = this.config.watch?.paths || ['src'];
      
      // Create a unified list of all scss/sass files to analyze
      const files: string[] = [];
      for (const dir of directories) {
        if (fsSync.existsSync(dir)) {
          const filesInDir = glob.sync(`${dir}/**/*.{scss,sass}`);
          files.push(...filesInDir);
        }
      }
      
      if (files.length === 0) {
        logger.warn('No SCSS files found for dependency tracking');
        this.dependencyGraph = { index: {}, visitAncestors: () => ({}) };
        return;
      }
      
      // Process each directory separately
      let combinedGraph: any = null;
      
      for (const dir of directories) {
        if (!fsSync.existsSync(dir)) continue;
        
        try {
          // Use parseDir for each directory
          const graph = sassGraph.parseDir(dir, {
            loadPath: directories,
            extensions: ['scss', 'sass']
          });
          
          if (!combinedGraph) {
            combinedGraph = graph;
          } else if (graph && graph.index) {
            // Merge the indexes from different directories
            Object.assign(combinedGraph.index, graph.index);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.warn(`Error in sass-graph directory parsing: ${errorMessage}`);
        }
      }
      
      // Create a normalized version of the graph for cross-platform compatibility
      const graph = combinedGraph || { index: {}, visitAncestors: () => ({}) };
      
      // Normalize all paths in the graph
      if (graph && graph.index) {
        // Define the type for the normalized index
        const normalizedIndex: Record<string, { 
          imports: string[], 
          importedBy: string[] 
        }> = {};
        
        Object.keys(graph.index).forEach((key: string) => {
          // Normalize key path (replace backslashes with forward slashes)
          const normalizedKey = normalizePath(key);
          
          // Copy node with normalized paths for imports and importedBy
          normalizedIndex[normalizedKey] = {
            imports: (graph.index[key]?.imports || []).map((p: string) => normalizePath(p)),
            importedBy: (graph.index[key]?.importedBy || []).map((p: string) => normalizePath(p))
          };
        });
        
        // Replace the index with the normalized version
        graph.index = normalizedIndex;
        
        // Wrap the visitAncestors method to handle normalized paths
        const originalVisitAncestors = graph.visitAncestors;
        graph.visitAncestors = (filePath: string) => {
          // Always normalize input path
          const normalizedPath = normalizePath(filePath);
          
          // Try with normalized path first
          let result = originalVisitAncestors.call(graph, normalizedPath) || {};
          
          // If no results, try with original path
          if (Object.keys(result).length === 0) {
            const originalResult = originalVisitAncestors.call(graph, filePath) || {};
            result = originalResult;
          }
          
          return result;
        };
      }
      
      this.dependencyGraph = graph;
      
      const fileCount = this.dependencyGraph.index ? Object.keys(this.dependencyGraph.index).length : 0;
      logger.info(`Built dependency graph with ${fileCount} SCSS files`);

    } catch (error: any) {
      logger.error(`Failed to build dependency graph: ${error.message}`);
      // Create an empty graph to avoid null reference errors
      this.dependencyGraph = { index: {}, visitAncestors: () => ({}) };
    }
  }

  private async processPartial(partialPath: string): Promise<void> {
    // Rebuild the dependency graph to ensure we have the latest relationships
    this.buildDependencyGraph();
    
    try {
      // Normalize the path with consistent separators for cross-platform compatibility
      const normalizedPath = normalizePath(path.normalize(partialPath));
      const absolutePartialPath = path.resolve(partialPath);
      const normalizedAbsolutePath = normalizePath(absolutePartialPath);
      
      // Get all files that import this partial - try multiple path formats
      let dependents = this.dependencyGraph.visitAncestors(normalizedAbsolutePath) || {};
      
      // If no results, try other path formats
      if (Object.keys(dependents).length === 0) {
        dependents = this.dependencyGraph.visitAncestors(absolutePartialPath) || {};
      }
      
      if (Object.keys(dependents).length === 0) {
        dependents = this.dependencyGraph.visitAncestors(normalizedPath) || {};
      }
      
      if (Object.keys(dependents).length === 0) {
        dependents = this.dependencyGraph.visitAncestors(partialPath) || {};
      }
      
      // Filter out other partials to get just the main files
      const mainFiles = Object.keys(dependents)
        .filter(file => !path.basename(file).startsWith('_'));
      
      logger.info(`Found ${mainFiles.length} main files that depend on ${partialPath}`);
      
      // Always rebuild all main files to be safe
      if (mainFiles.length === 0) {
        // Detailed logging to help diagnose the issue
        logger.warn(`No main files found that import ${partialPath}`);
        logger.debug(`Available dependencies: ${JSON.stringify(Object.keys(this.dependencyGraph.index))}`);
        
        // If we couldn't find dependencies through the graph, try a manual approach
        const possibleMainFiles = await glob(`${this.config.watch?.paths?.[0] || 'src'}/**/*.s[ac]ss`);
        const nonPartialFiles = possibleMainFiles.filter(file => !path.basename(file).startsWith('_'));
        
        for (const mainFile of nonPartialFiles) {
          try {
            const content = fsSync.readFileSync(mainFile, 'utf8');
            const baseName = path.basename(partialPath);
            const baseNameWithoutUnderscore = baseName.startsWith('_') ? baseName.substring(1) : baseName;
            
            // If the file might import our partial, process it
            if (content.includes(baseNameWithoutUnderscore) || content.includes(baseName)) {
              await this.processScssFile(mainFile);
            }
          } catch (err) {
            // Ignore read errors
          }
        }
      }
      
      // Process each main file
      for (const file of mainFiles) {
        await this.processScssFile(file);
      }
    } catch (error) {
      logger.error(`Error processing partial ${partialPath}: ${error}`);
    }
  }

  private async processScssFile(filePath: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Compile SCSS to CSS
      const sassResult = sass.compile(filePath, {
        style: this.config.sass?.style || 'expanded',
        sourceMap: this.config.sass?.sourceMap !== false
      });
      
      // Create the output file path - FIX HERE
      // Instead of using a simple relative path, we need to specifically
      // extract the path relative to the source directory
      
      // Determine source root (either "source" or "src" folder)
      const sourceDirs = this.config.watch?.paths || ['src'];
      let sourceDir = '';
      
      for (const dir of sourceDirs) {
        if (filePath.startsWith(dir)) {
          sourceDir = dir;
          break;
        }
      }
      
      // If we found a matching source dir, remove it from the path
      let relativeOutputPath;
      if (sourceDir) {
        // Create path relative to the source directory, not including the source directory itself
        relativeOutputPath = path.relative(sourceDir, filePath);
      } else {
        // Fallback to simple relative path if we can't determine source dir
        relativeOutputPath = path.relative(process.cwd(), filePath);
      }
      
      // Create the output file path
      const outputFilePath = path.join(
        this.outputPath,
        relativeOutputPath.replace(/\.s[ca]ss$/, '.css')
      );
      
      // Make sure the output directory exists
      await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
      
      // Process with PostCSS (autoprefixer etc)
      const plugins = [
        autoprefixer(),
        ...(this.config.postcss?.plugins || [])
      ];
      
      const postcssResult = await postcss(plugins).process(sassResult.css, {
        from: filePath,
        to: outputFilePath,
        map: this.config.sass?.sourceMap !== false ? { inline: false } : false
      });
      
      // Write the CSS file
      await fs.writeFile(outputFilePath, postcssResult.css);
      
      // Write source map if enabled
      if (postcssResult.map && this.config.sass?.sourceMap !== false) {
        await fs.writeFile(`${outputFilePath}.map`, postcssResult.map.toString());
      }
      
      const endTime = Date.now();
      logger.success(`Processed ${path.basename(filePath)} in ${formatTime(endTime - startTime)}`);
    } catch (error: any) {
      logger.error(`Failed to process ${filePath}: ${error.message}`);
      throw error;
    }
  }

  // Enhanced getParentFiles method to better find dependencies
  async getParentFiles(partialPath: string): Promise<string[]> {
    if (!this.dependencyGraph) {
      this.buildDependencyGraph();
    }
    
    try {
      // Use multiple path formats to improve cross-platform compatibility
      const normalizedPath = normalizePath(path.normalize(partialPath));
      const absolutePartialPath = path.resolve(partialPath);
      const normalizedAbsolutePath = normalizePath(absolutePartialPath);
      
      // Try multiple path formats to find dependencies
      let dependents = this.dependencyGraph.visitAncestors(normalizedAbsolutePath) || {};
      
      if (Object.keys(dependents).length === 0) {
        dependents = this.dependencyGraph.visitAncestors(absolutePartialPath) || {};
      }
      
      if (Object.keys(dependents).length === 0) {
        dependents = this.dependencyGraph.visitAncestors(normalizedPath) || {};
      }
      
      if (Object.keys(dependents).length === 0) {
        dependents = this.dependencyGraph.visitAncestors(partialPath) || {};
      }
      
      // Filter out other partials to get just the main files
      const mainFiles = Object.keys(dependents)
        .filter(file => !path.basename(file).startsWith('_'));
      
      logger.info(`Found ${mainFiles.length} main files that depend on ${path.basename(partialPath)}`);
      
      if (mainFiles.length === 0) {
        // Manual search for the file name in other files
        logger.debug(`No dependencies found via graph, doing manual search for ${path.basename(partialPath)}`);
        
        const partialFileName = path.basename(partialPath);
        const partialNameWithoutUnderscore = partialFileName.substring(1);
        const partialNameWithoutExtension = partialNameWithoutUnderscore.replace(/\.s[ac]ss$/, '');
        
        const possibleParents = await glob.glob(
          `${this.config.watch?.paths?.[0] || 'src'}/**/*.s[ac]ss`
        );
        
        const manuallyFoundParents = [];
        
        for (const potentialParent of possibleParents) {
          if (path.basename(potentialParent).startsWith('_')) continue; // Skip partials
          
          try {
            const content = fsSync.readFileSync(potentialParent, 'utf8');
            // Look for @import or @use statements
            if (
              content.includes(`@import './_${partialNameWithoutExtension}'`) ||
              content.includes(`@import "./_${partialNameWithoutExtension}"`) ||
              content.includes(`@use './_${partialNameWithoutExtension}'`) ||
              content.includes(`@use "./_${partialNameWithoutExtension}"`) ||
              content.includes(`@import '${partialNameWithoutExtension}'`) ||
              content.includes(`@import "${partialNameWithoutExtension}"`) ||
              content.includes(`@use '${partialNameWithoutExtension}'`) ||
              content.includes(`@use "${partialNameWithoutExtension}"`)
            ) {
              manuallyFoundParents.push(potentialParent);
              logger.debug(`Found manual dependency: ${potentialParent} imports ${partialFileName}`);
            }
          } catch (err) {
            // Ignore read errors
          }
        }
        
        return manuallyFoundParents;
      }
      
      return mainFiles;
    } catch (error) {
      logger.error(`Error finding parent files for ${partialPath}: ${error}`);
      return [];
    }
  }
}
