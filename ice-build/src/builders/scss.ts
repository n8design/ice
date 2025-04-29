import { Builder, IceConfig } from '../types.js';
import fs from 'fs/promises';
// Use Node's built-in fs module for synchronous operations
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
    
    // Make sure we're searching directories that actually exist
    const existingDirs = directories.filter(dir => fsSync.existsSync(dir));
    
    if (existingDirs.length === 0) {
      logger.warn('No existing directories found for SCSS dependency tracking');
      this.dependencyGraph = { index: {}, visitAncestors: () => ({}) };
      return;
    }
    
    // Create a custom dependency graph tracking all relationships
    const dependencyIndex: Record<string, { imports: string[], importedBy: string[] }> = {};
    
    // First pass: initialize all files in the index
    for (const file of files) {
      const absolutePath = path.resolve(file);
      dependencyIndex[absolutePath] = { imports: [], importedBy: [] };
    }
    
    // Second pass: analyze all files to find import relationships
    for (const file of files) {
      const absolutePath = path.resolve(file);
      
      try {
        const content = fsSync.readFileSync(file, 'utf8');
        
        // Find all @import and @use statements
        const importMatches = [...content.matchAll(/@import\s+['"](.*?)['"]/g)];
        const useMatches = [...content.matchAll(/@use\s+['"](.*?)['"]/g)];
        
        // Process all matches
        const allMatches = [...importMatches, ...useMatches];
        
        for (const match of allMatches) {
          const importPath = match[1].trim();
          
          // Resolve the imported file path
          let resolvedImportPath: string | null = null;
          
          // Try direct path
          for (const dir of existingDirs) {
            // Check various possible paths (with/without underscore, with/without extension)
            const possiblePaths = [
              path.resolve(dir, importPath + '.scss'),
              path.resolve(dir, importPath + '.sass'),
              path.resolve(dir, path.dirname(importPath), '_' + path.basename(importPath) + '.scss'),
              path.resolve(dir, path.dirname(importPath), '_' + path.basename(importPath) + '.sass'),
            ];
            
            for (const possiblePath of possiblePaths) {
              if (fsSync.existsSync(possiblePath)) {
                resolvedImportPath = possiblePath;
                break;
              }
            }
            
            if (resolvedImportPath) break;
          }
          
          // If import was found, record the relationship
          if (resolvedImportPath) {
            // Make sure both files are in the index
            if (!dependencyIndex[absolutePath]) {
              dependencyIndex[absolutePath] = { imports: [], importedBy: [] };
            }
            
            if (!dependencyIndex[resolvedImportPath]) {
              dependencyIndex[resolvedImportPath] = { imports: [], importedBy: [] };
            }
            
            // Record bidirectional relationship
            if (!dependencyIndex[absolutePath].imports.includes(resolvedImportPath)) {
              dependencyIndex[absolutePath].imports.push(resolvedImportPath);
            }
            
            if (!dependencyIndex[resolvedImportPath].importedBy.includes(absolutePath)) {
              dependencyIndex[resolvedImportPath].importedBy.push(absolutePath);
            }
            
            logger.debug(`Dependency: ${file} imports ${resolvedImportPath}`);
          }
        }
      } catch (err) {
        logger.warn(`Error analyzing imports in ${file}: ${err}`);
      }
    }
    
    // Create a graph object compatible with the sass-graph interface
    this.dependencyGraph = {
      index: dependencyIndex,
      visitAncestors: (filePath: string) => {
        const result: Record<string, boolean> = {};
        const visited = new Set<string>();
        
        const visit = (pathToVisit: string) => {  // Renamed parameter to avoid conflict
          if (visited.has(pathToVisit)) return;
          visited.add(pathToVisit);
          
          const resolvedPath = path.resolve(pathToVisit);  // Now using the path module correctly
          const node = dependencyIndex[resolvedPath];
          
          if (!node) return;
          
          // Add all files that import this one
          for (const importerPath of node.importedBy) {
            result[importerPath] = true;
            // Recursive to get transitive dependencies
            visit(importerPath);
          }
        };
        
        visit(path.resolve(filePath));
        return result;
      }
    };
    
    const fileCount = Object.keys(dependencyIndex).length;
    const relationshipCount = Object.values(dependencyIndex).reduce(
      (sum, node) => sum + node.importedBy.length, 0
    );
    
    logger.info(`Built dependency graph with ${fileCount} SCSS files and ${relationshipCount} import relationships`);
    
    // Log some sample relationships for debugging
    const sampleFiles = Object.keys(dependencyIndex).filter(
      f => path.basename(f).startsWith('_') && dependencyIndex[f].importedBy.length > 0
    ).slice(0, 3);
    
    if (sampleFiles.length > 0) {
      for (const partial of sampleFiles) {
        const importers = dependencyIndex[partial].importedBy.map(p => path.basename(p)).join(', ');
        logger.debug(`Example: ${path.basename(partial)} is imported by: ${importers}`);
      }
    }
  } catch (error: any) {
    logger.error(`Failed to build dependency graph: ${error.message}`);
    // Create an empty graph to avoid null reference errors
    this.dependencyGraph = { index: {}, visitAncestors: () => ({}) };
  }
}

  private async processPartial(partialPath: string): Promise<void> {
    // Find all main files that depend on this partial
    if (!this.dependencyGraph) {
      this.buildDependencyGraph();
    }
    
    try {
      // Use absolute path to ensure consistent path handling
      const absolutePartialPath = path.resolve(partialPath);
      
      // Get all files that import this partial
      const dependents = this.dependencyGraph.visitAncestors(absolutePartialPath) || {};
      
      // Filter out other partials to get just the main files
      const mainFiles = Object.keys(dependents)
        .filter(file => !path.basename(file).startsWith('_'));
      
      logger.info(`Found ${mainFiles.length} main files that depend on ${partialPath}`);
      
      if (mainFiles.length === 0) {
        // Detailed logging to help diagnose the issue
        logger.warn(`No main files found that import ${partialPath}`);
        logger.debug(`Available dependencies: ${JSON.stringify(Object.keys(this.dependencyGraph.index))}`);
        
        // Check if the partial file exists in the dependency index
        const normalizedPath = path.normalize(absolutePartialPath);
        if (!this.dependencyGraph.index[normalizedPath]) {
          logger.warn(`Partial ${partialPath} is not in the dependency graph`);
          
          // Rebuild the dependency graph to catch new files
          this.buildDependencyGraph();
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
      // Use absolute path to ensure consistent path handling
      const absolutePartialPath = path.resolve(partialPath);
      
      // Get all files that import this partial
      const dependents = this.dependencyGraph.visitAncestors(absolutePartialPath) || {};
      
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
