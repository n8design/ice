import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { glob } from 'glob';
import { Logger } from '../utils/logger.js';
import { normalizePath } from '../utils/path-utils.js';

const logger = new Logger('SCSSDepTracker');

export interface SassDependency {
  importers: Set<string>; // Files that import this file
  uses: Set<string>;      // Files that this file imports
}

export class ScssDependencyTracker {
  private dependencyGraph: Map<string, SassDependency> = new Map();
  private importsCache: Map<string, string[]> = new Map();
  private resolveCache: Map<string, string | null> = new Map();
  private sourceDirectories: string[];
  private nodeModulesPath: string;
  
  constructor(sourceDirectories: string[]) {
    this.sourceDirectories = sourceDirectories;
    this.nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  }
  
  /**
   * Build the dependency graph from all SCSS files
   */
  public async buildGraph(patterns: string[]): Promise<void> {
    this.dependencyGraph.clear();
    this.resolveCache.clear();
    
    const files: string[] = [];
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern);
        files.push(...matches);
        logger.debug(`Found ${matches.length} files with pattern ${pattern}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error finding files with pattern ${pattern}: ${errorMessage}`);
      }
    }
    
    logger.info(`Building SCSS dependency graph for ${files.length} files`);
    
    // Process all files first
    for (const file of files) {
      await this.processFile(file);
    }
    
    // Log stats
    const partials = Array.from(this.dependencyGraph.keys()).filter(f => path.basename(f).startsWith('_')).length;
    logger.info(`Dependency graph built with ${this.dependencyGraph.size} total files (${partials} partials)`);
  }
  
  /**
   * Validate and repair graph to ensure all references are bidirectional
   */
  private validateGraph(): void {
    let repaired = 0;
    
    // Check that all uses have corresponding importers
    for (const [file, deps] of this.dependencyGraph.entries()) {
      for (const used of deps.uses) {
        const usedNode = this.dependencyGraph.get(used);
        if (usedNode) {
          if (!usedNode.importers.has(file)) {
            // Repair missing back-reference
            usedNode.importers.add(file);
            repaired++;
            logger.debug(`Repaired missing importer: ${path.basename(used)} should have ${path.basename(file)} as importer`);
          }
        } else {
          // Used file not in graph - add it
          this.dependencyGraph.set(used, { 
            importers: new Set([file]), 
            uses: new Set() 
          });
          repaired++;
          logger.debug(`Added missing node: ${path.basename(used)} imported by ${path.basename(file)}`);
        }
      }
    }
    
    // Check that all importers have corresponding uses
    for (const [file, deps] of this.dependencyGraph.entries()) {
      for (const importer of deps.importers) {
        const importerNode = this.dependencyGraph.get(importer);
        if (importerNode) {
          if (!importerNode.uses.has(file)) {
            // Repair missing forward-reference
            importerNode.uses.add(file);
            repaired++;
            logger.debug(`Repaired missing use: ${path.basename(importer)} should use ${path.basename(file)}`);
          }
        } else {
          // Importer file not in graph - add it
          this.dependencyGraph.set(importer, { 
            importers: new Set(), 
            uses: new Set([file]) 
          });
          repaired++;
          logger.debug(`Added missing node: ${path.basename(importer)} imports ${path.basename(file)}`);
        }
      }
    }
    
    if (repaired > 0) {
      logger.info(`Repaired ${repaired} references in dependency graph`);
    }
  }
  
  /**
   * Process a single SCSS file for the dependency graph
   */
  private async processFile(file: string): Promise<void> {
    if (!fs.existsSync(file)) return;
    
    // Initialize this file in the graph if not already there
    if (!this.dependencyGraph.has(file)) {
      this.dependencyGraph.set(file, { importers: new Set(), uses: new Set() });
    }
    
    let imports: string[];
    
    // Use cached imports if available
    if (this.importsCache.has(file)) {
      imports = this.importsCache.get(file) || [];
    } else {
      try {
        const content = await fsPromises.readFile(file, 'utf-8');
        imports = this.extractImports(content);
        this.importsCache.set(file, imports);
      } catch (error) {
        logger.error(`Error reading ${file}: ${error}`);
        return;
      }
    }
    
    // Process each import
    for (const importPath of imports) {
      const cacheKey = `${path.dirname(file)}|${importPath}`;
      let resolvedPath: string | null;
      
      // Use resolve cache if available
      if (this.resolveCache.has(cacheKey)) {
        resolvedPath = this.resolveCache.get(cacheKey) || null;
      } else {
        resolvedPath = await this.resolveImportPath(importPath, path.dirname(file));
        this.resolveCache.set(cacheKey, resolvedPath);
      }
      
      if (resolvedPath) {
        // Update graph edges
        this.dependencyGraph.get(file)?.uses.add(resolvedPath);
        
        // Initialize imported file in graph if needed
        if (!this.dependencyGraph.has(resolvedPath)) {
          this.dependencyGraph.set(resolvedPath, { importers: new Set(), uses: new Set() });
        }
        
        // Add this file as an importer of the resolved file
        this.dependencyGraph.get(resolvedPath)?.importers.add(file);
      }
    }
  }
  
  /**
   * Find all files that depend on the given partial
   */
  public getParentFiles(partialPath: string): string[] {
    // Normalize path for consistent comparison
    const normalizedPath = normalizePath(path.isAbsolute(partialPath) 
      ? partialPath 
      : path.resolve(process.cwd(), partialPath));
    
    logger.debug(`Looking for parents of: ${normalizedPath}`);
    
    if (!this.dependencyGraph.has(normalizedPath)) {
      logger.warn(`Partial ${path.basename(normalizedPath)} not found in dependency graph`);
      return [];
    }
    
    // Use BFS to find all parent entry points
    const visited = new Set<string>();
    const queue: string[] = [normalizedPath];
    const entryPoints = new Set<string>();
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      
      visited.add(current);
      
      const node = this.dependencyGraph.get(current);
      if (!node) continue;
      
      if (node.importers.size === 0) {
        // This is an entry point (no importers)
        if (!path.basename(current).startsWith('_')) {
          entryPoints.add(current);
          logger.debug(`Found entry point: ${path.basename(current)}`);
        }
      } else {
        // Queue all importers for processing
        for (const importer of node.importers) {
          if (!visited.has(importer)) {
            queue.push(importer);
            logger.debug(`Following import chain: ${path.basename(current)} <- ${path.basename(importer)}`);
          }
        }
      }
    }
    
    const result = Array.from(entryPoints);
    logger.info(`Found ${result.length} files that depend on ${path.basename(partialPath)}`);
    
    // Only add debugging output if we didn't find any parents
    if (result.length === 0) {
      this.logDependencyInfo(normalizedPath);
    }
    
    return result;
  }
  
  /**
   * Log detailed dependency information for debugging
   * This is a non-intrusive addition that helps troubleshoot when parents aren't found
   */
  private logDependencyInfo(filePath: string): void {
    const node = this.dependencyGraph.get(filePath);
    if (!node) return;
    
    logger.debug(`Dependency debug for ${path.basename(filePath)}:`);
    logger.debug(`  Direct importers (${node.importers.size}): ${Array.from(node.importers).map(p => path.basename(p)).join(', ')}`);
  }
  
  /**
   * Log the dependency chain for debugging
   */
  private logDependencyChain(filePath: string): void {
    const node = this.dependencyGraph.get(filePath);
    if (!node) return;
    
    logger.debug(`Dependency debug for ${path.basename(filePath)}:`);
    logger.debug(`  Importers (${node.importers.size}): ${Array.from(node.importers).map(p => path.basename(p)).join(', ')}`);
    logger.debug(`  Uses (${node.uses.size}): ${Array.from(node.uses).map(p => path.basename(p)).join(', ')}`);
    
    if (node.importers.size > 0) {
      // Look at first-level importers
      for (const importer of node.importers) {
        const importerNode = this.dependencyGraph.get(importer);
        if (importerNode) {
          const isEntryPoint = !path.basename(importer).startsWith('_') && importerNode.importers.size === 0;
          logger.debug(`  ${path.basename(importer)} imports this file and is ${isEntryPoint ? 'an entry point' : 'imported by others'}`);
        }
      }
    }
  }
  
  /**
   * Update the dependency graph for a single file
   */
  public async updateFile(file: string): Promise<Set<string>> {
    // Remove existing file from graph first
    const normalizedPath = normalizePath(file);
    const affectedFiles = new Set<string>();
    
    // Remember any existing importers
    if (this.dependencyGraph.has(normalizedPath)) {
      const node = this.dependencyGraph.get(normalizedPath)!;
      
      // Clean up references to this file
      for (const used of node.uses) {
        const usedNode = this.dependencyGraph.get(used);
        if (usedNode?.importers.has(normalizedPath)) {
          usedNode.importers.delete(normalizedPath);
          affectedFiles.add(used);
        }
      }
      
      // Collect importers to check later
      for (const importer of node.importers) {
        affectedFiles.add(importer);
      }
      
      // Remove this file from graph
      this.dependencyGraph.delete(normalizedPath);
    }
    
    // Clear file from caches
    this.importsCache.delete(normalizedPath);
    
    // Re-analyze file
    await this.processFile(file);
    
    // Return affected files for further processing
    return affectedFiles;
  }
  
  /**
   * Extract imports from SCSS content
   */
  public extractImports(content: string): string[] {
    // More comprehensive regex to catch different import formats
    // Match @import, @use, @forward with optional 'as', 'with', 'show'
    // Also handle multi-line imports and quoted strings
    const importRegex = /@(?:import|use|forward)\s+(['"])([^'";\n\r]+)\1(?:\s+(?:as|with|show)\s+[^;]+)?;?/gm;
    const imports: string[] = [];
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[2].trim();
      imports.push(importPath);
      logger.debug(`Found import: ${importPath}`);
    }
    
    return imports;
  }
  
  /**
   * Dump graph information for debugging
   */
  public dumpGraphInfo(): void {
    logger.info(`--- SCSS Dependency Graph Info ---`);
    logger.info(`Total nodes: ${this.dependencyGraph.size}`);
    
    // Count entry points and partials
    const entryPoints = [];
    let partials = 0;
    
    for (const [file, node] of this.dependencyGraph.entries()) {
      if (path.basename(file).startsWith('_')) {
        partials++;
      } else if (node.importers.size === 0) {
        entryPoints.push(path.basename(file));
      }
    }
    
    logger.info(`Entry points (${entryPoints.length}): ${entryPoints.join(', ')}`);
    logger.info(`Partials: ${partials}`);
    
    // Find disconnected nodes
    const disconnected = [];
    for (const [file, node] of this.dependencyGraph.entries()) {
      if (node.importers.size === 0 && node.uses.size === 0) {
        disconnected.push(path.basename(file));
      }
    }
    
    if (disconnected.length > 0) {
      logger.warn(`Disconnected nodes (${disconnected.length}): ${disconnected.join(', ')}`);
    }
    
    logger.info(`--------------------------------`);
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
      for (const fname of potentialFileNames) {
        const fullPath = path.resolve(this.nodeModulesPath, importPath, fname);
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
}