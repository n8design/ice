#!/usr/bin/env node
/**
 * SASS Dependency Graph Visualizer
 * 
 * This is a standalone script that can be copied anywhere
 * It only requires the sass-graph package to be installed.
 * 
 * Installation:
 *   npm install -g sass-graph    # Install sass-graph globally
 *   # OR
 *   npm install sass-graph       # Install locally in your project
 * 
 * Usage:
 *   node sass-graph-visualizer.js [directory] [--file path/to/file.scss]
 * 
 * Examples:
 *   node sass-graph-visualizer.js src
 *   node sass-graph-visualizer.js src --file src/styles/_variables.scss
 */

// Check for Node.js version
const nodeVersion = process.version.match(/^v(\d+)\./)[1];
if (nodeVersion < 12) {
  console.error('This script requires Node.js v12 or newer');
  process.exit(1);
}

// Define required modules - using ES module syntax
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Create a require function to dynamically import CommonJS modules
const require = createRequire(import.meta.url);

// Get file name for help message
const __filename = fileURLToPath(import.meta.url);

// Make sure the sass-graph module is installed
let sassGraph;
try {
  sassGraph = require('sass-graph');
} catch (e) {
  console.error('Error: The sass-graph module is not installed.');
  console.error('Please install it using one of:');
  console.error('  npm install -g sass-graph    # Global installation');
  console.error('  npm install sass-graph       # Local installation');
  process.exit(1);
}

/**
 * Normalize paths to use forward slashes for cross-platform compatibility
 */
function normalizePath(filepath) {
  if (!filepath) return '';
  return filepath.replace(/\\/g, '/');
}

/**
 * Enhanced version of sass graph that handles cross-platform paths better
 */
function createEnhancedGraph(dir, options = {}) {
  // Ensure directory is an absolute path
  const absoluteDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  let graph;
  
  try {
    graph = sassGraph.parseDir(absoluteDir, options);
  } catch (err) {
    console.error(`Error parsing SASS directory: ${err.message}`);
    console.error('Make sure the directory contains valid SCSS files.');
    process.exit(1);
  }
  
  if (graph && graph.index) {
    // Manually scan for @use/@forward statements in all files first
    console.log("Enhancing graph with @use/@forward detection...");
    
    // This will store found relationships
    const additionalRelationships = [];
    
    // Go through each file and scan for imports
    Object.keys(graph.index).forEach(importerFile => {
      try {
        const content = fs.readFileSync(importerFile, 'utf8');
        const importerDir = path.dirname(importerFile);
        
        // Match all @use and @forward statements
        const useStatements = content.match(/@use\s+['"]([^'"]+)['"]/g) || [];
        const forwardStatements = content.match(/@forward\s+['"]([^'"]+)['"]/g) || [];
        
        // Process @use statements
        useStatements.forEach(statement => {
          // Extract the import path without quotes and 'as X' part
          const importMatch = statement.match(/@use\s+['"]([^'"]+)['"]/);
          if (!importMatch || !importMatch[1]) return;
          
          const importPath = importMatch[1];
          const possiblePaths = resolveImportPath(importPath, importerDir, dir);
          
          // Check if any resolved path exists in our graph
          for (const possiblePath of possiblePaths) {
            const normalizedPath = normalizePath(possiblePath);
            
            // Check if this path exists in the graph
            if (graph.index[normalizedPath]) {
              // Found a match! Add the relationship
              additionalRelationships.push({
                importer: importerFile,
                imported: normalizedPath
              });
              break;
            } else {
              // Check for other variants (with/without underscore)
              const variants = getFileVariants(normalizedPath);
              for (const variant of variants) {
                if (graph.index[variant]) {
                  additionalRelationships.push({
                    importer: importerFile,
                    imported: variant
                  });
                  break;
                }
              }
            }
          }
        });
        
        // Process @forward statements (similar logic)
        forwardStatements.forEach(statement => {
          const importMatch = statement.match(/@forward\s+['"]([^'"]+)['"]/);
          if (!importMatch || !importMatch[1]) return;
          
          const importPath = importMatch[1];
          const possiblePaths = resolveImportPath(importPath, importerDir, dir);
          
          for (const possiblePath of possiblePaths) {
            const normalizedPath = normalizePath(possiblePath);
            
            if (graph.index[normalizedPath]) {
              additionalRelationships.push({
                importer: importerFile,
                imported: normalizedPath
              });
              break;
            } else {
              const variants = getFileVariants(normalizedPath);
              for (const variant of variants) {
                if (graph.index[variant]) {
                  additionalRelationships.push({
                    importer: importerFile,
                    imported: variant
                  });
                  break;
                }
              }
            }
          }
        });
      } catch (err) {
        // Ignore read errors
      }
    });
    
    // Add all the found relationships to the graph
    additionalRelationships.forEach(rel => {
      // Update importedBy for the imported file
      if (!graph.index[rel.imported].importedBy.includes(rel.importer)) {
        graph.index[rel.imported].importedBy.push(rel.importer);
      }
      
      // Update imports for the importing file
      if (!graph.index[rel.importer].imports.includes(rel.imported)) {
        graph.index[rel.importer].imports.push(rel.imported);
      }
    });
    
    console.log(`Added ${additionalRelationships.length} missing relationships from @use/@forward statements`);
    
    // ...existing visitAncestors code...
  }
  
  return graph;
}

/**
 * Helper function to resolve import paths considering different path formats
 */
function resolveImportPath(importPath, importerDir, rootDir) {
  const results = [];
  
  // Handle paths with extension
  if (importPath.endsWith('.scss') || importPath.endsWith('.sass')) {
    results.push(path.resolve(importerDir, importPath));
  } else {
    // Try with various extensions
    results.push(path.resolve(importerDir, importPath + '.scss'));
    results.push(path.resolve(importerDir, importPath + '.sass'));
  }
  
  // Handle _partial naming convention
  if (!path.basename(importPath).startsWith('_')) {
    const dirName = path.dirname(importPath);
    const fileName = path.basename(importPath);
    
    // Try with underscore prefix
    if (importPath.endsWith('.scss') || importPath.endsWith('.sass')) {
      results.push(path.resolve(importerDir, dirName, '_' + fileName));
    } else {
      results.push(path.resolve(importerDir, dirName, '_' + fileName + '.scss'));
      results.push(path.resolve(importerDir, dirName, '_' + fileName + '.sass'));
    }
  }
  
  // Handle index files
  if (path.extname(importPath) === '') {
    // If the import points to a directory, look for index files
    results.push(path.resolve(importerDir, importPath, '_index.scss'));
    results.push(path.resolve(importerDir, importPath, '_index.sass'));
    results.push(path.resolve(importerDir, importPath, 'index.scss'));
    results.push(path.resolve(importerDir, importPath, 'index.sass'));
  }
  
  return results;
}

/**
 * Get variants of a file path including with/without underscore
 */
function getFileVariants(filePath) {
  const variants = [filePath];
  const dirName = path.dirname(filePath);
  const fileName = path.basename(filePath);
  
  // Add variant with/without underscore
  if (fileName.startsWith('_')) {
    variants.push(path.join(dirName, fileName.substring(1)));
  } else {
    variants.push(path.join(dirName, '_' + fileName));
  }
  
  return variants;
}

// ...existing code...

/**
 * Generate a text representation of the SASS dependency graph
 */
function visualizeGraph(graph) {
  if (!graph || !graph.index) {
    return 'Empty graph - no files to display';
  }

  const lines = ['SCSS Dependency Graph:', '--------------------'];
  const files = Object.keys(graph.index).sort();
  
  // Enhanced: First show summary of file counts
  const mainFiles = files.filter(file => !path.basename(file).startsWith('_'));
  const partialFiles = files.filter(file => path.basename(file).startsWith('_'));
  const indexFiles = files.filter(file => path.basename(file).includes('_index.'));
  
  lines.push(`\nFound ${files.length} SCSS files (${mainFiles.length} main files, ${partialFiles.length} partials, ${indexFiles.length} index files)\n`);
  
  // Then proceed with the original detailed listing, but with better import detection
  for (const file of files) {
    const node = graph.index[file];
    const displayPath = normalizePath(file);
    const isPartial = path.basename(displayPath).startsWith('_');
    const isIndex = path.basename(displayPath).includes('_index.');
    const fileType = isIndex ? '[Index]' : (isPartial ? '[Partial]' : '[Main]');
    
    lines.push(`${fileType} ${displayPath}`);
    
    if (node.imports && node.imports.length > 0) {
      lines.push('  Imports:');
      node.imports.forEach(imp => {
        const normalizedImport = normalizePath(imp);
        const isImportPartial = path.basename(normalizedImport).startsWith('_');
        const isImportIndex = path.basename(normalizedImport).includes('_index.');
        const importType = isImportIndex ? '[I]' : (isImportPartial ? '[P]' : '[M]');
        lines.push(`    ${importType} ${normalizedImport}`);
      });
    }
    
    if (node.importedBy && node.importedBy.length > 0) {
      lines.push('  Imported by:');
      node.importedBy.forEach(imp => {
        const normalizedImport = normalizePath(imp);
        const isImportPartial = path.basename(normalizedImport).startsWith('_');
        const isImportIndex = path.basename(normalizedImport).includes('_index.');
        const importType = isImportIndex ? '[I]' : (isImportPartial ? '[P]' : '[M]');
        lines.push(`    ${importType} ${normalizedImport}`);
      });
    } else if (isPartial) {
      lines.push('  ⚠️ Warning: This partial is not imported by any file!');
    }
    
    lines.push(''); // Empty line between files
  }
  
  // Add orphaned partials section at the end - but make sure we're not missing @use/@forward
  const orphanedPartials = partialFiles.filter(file => {
    const node = graph.index[file];
    return (!node.importedBy || node.importedBy.length === 0);
  });
  
  if (orphanedPartials.length > 0) {
    lines.push('\nWARNING: ORPHANED PARTIALS (not imported anywhere):');
    lines.push('==============================================');
    
    orphanedPartials.forEach(file => {
      lines.push(`  ${normalizePath(file)}`);
    });
    
    lines.push('\nThese files are not used in your compiled CSS!');
    lines.push('NOTE: If files contain @use/@forward with relative paths like "../path/to/file", check manually.');
  }
  
  return lines.join('\n');
}

/**
 * Analyze dependencies of a specific file
 */
function analyzeFileDependencies(graph, filePath) {
  if (!graph || !graph.index) {
    return { 
      file: filePath,
      directDependents: [],
      transitiveDeepndents: []
    };
  }
  
  const normalizedPath = normalizePath(filePath);
  const directDependents = [];
  const allDependents = new Set();
  
  // Find direct dependents
  Object.keys(graph.index).forEach(file => {
    const node = graph.index[file];
    if (node.imports && node.imports.some(imp => 
      normalizePath(imp) === normalizedPath || 
      normalizePath(imp).endsWith('/' + path.basename(normalizedPath)))) {
      directDependents.push(file);
      allDependents.add(file);
    }
  });
  
  // Find transitive dependents (files that depend on our dependents)
  const findTransitiveDependents = (files) => {
    const newDependents = [];
    
    files.forEach(file => {
      Object.keys(graph.index).forEach(potentialDependent => {
        const node = graph.index[potentialDependent];
        if (node.imports && node.imports.some(imp => 
          normalizePath(imp) === normalizePath(file)) &&
          !allDependents.has(potentialDependent)) {
          newDependents.push(potentialDependent);
          allDependents.add(potentialDependent);
        }
      });
    });
    
    if (newDependents.length > 0) {
      findTransitiveDependents(newDependents);
    }
  };
  
  findTransitiveDependents(directDependents);
  
  // Convert the set to array and filter out the direct dependents
  const transitiveDeepndents = Array.from(allDependents)
    .filter(file => !directDependents.includes(file));
  
  // Add additional helpful information
  const result = {
    file: normalizedPath,
    directDependents,
    transitiveDeepndents,
    isPartial: path.basename(normalizedPath).startsWith('_'),
    isIndexFile: path.basename(normalizedPath).includes('_index.')
  };
  
  return result;
}

// Process command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let directory = 'src';
  let specificFile = null;
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && i + 1 < args.length) {
      specificFile = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      showHelp();
      process.exit(0);
    } else if (!args[i].startsWith('--')) {
      directory = args[i];
    }
  }

  return { directory, specificFile, options };
}

// Show help message
function showHelp() {
  console.log(`
SASS Dependency Graph Visualizer

Usage: node ${path.basename(__filename)} [options] [directory]

Options:
  --file <path>   Analyze dependencies for a specific file
  --help, -h      Show this help message

Examples:
  node ${path.basename(__filename)} src
  node ${path.basename(__filename)} src --file src/styles/_variables.scss

Requirements:
  - Node.js v12 or newer
  - sass-graph package installed (npm install sass-graph)
  `);
}

// Main function
function main() {
  const { directory, specificFile } = parseArgs();
  
  // Resolve directory path
  const resolvedDirectory = path.resolve(process.cwd(), directory);
  
  // Check if directory exists
  if (!fs.existsSync(resolvedDirectory)) {
    console.error(`Error: Directory "${directory}" does not exist at path: ${resolvedDirectory}`);
    console.error('Please make sure you run this script with a valid SCSS directory.');
    process.exit(1);
  }
  
  console.log(`Analyzing SCSS files in ${resolvedDirectory}...`);
  
  // Create the enhanced graph
  const graph = createEnhancedGraph(resolvedDirectory, {
    loadPath: [resolvedDirectory],
    extensions: ['scss', 'sass']
  });
  
  // If a specific file is provided, analyze its dependencies
  if (specificFile) {
    const resolvedSpecificFile = path.resolve(process.cwd(), specificFile);
    
    if (!fs.existsSync(resolvedSpecificFile)) {
      console.error(`Error: File "${specificFile}" does not exist at path: ${resolvedSpecificFile}`);
      process.exit(1);
    }
    
    console.log(`\nDependency analysis for: ${resolvedSpecificFile}`);
    console.log('=========================================');
    
    const analysis = analyzeFileDependencies(graph, resolvedSpecificFile);
    
    console.log(`File: ${analysis.file}`);
    
    // Add file type information
    if (analysis.isIndexFile) {
      console.log('Type: Index file (used to aggregate styles)');
    } else if (analysis.isPartial) {
      console.log('Type: Partial (must be imported by other files)');
    } else {
      console.log('Type: Main file (compiled directly to CSS)');
    }
    
    // Check for orphaned partials
    if (analysis.isPartial && analysis.directDependents.length === 0) {
      console.log('\n⚠️ WARNING: This partial appears to be orphaned (not imported anywhere).');
      console.log('It will not be included in your compiled CSS.');
    }
    
    console.log('\nDirect Dependents (files that directly import this file):');
    if (analysis.directDependents.length === 0) {
      console.log('  None - no files directly import this file');
    } else {
      analysis.directDependents.forEach(dep => {
        console.log(`  ${dep}`);
      });
    }
    
    console.log('\nTransitive Dependents (files that indirectly depend on this file):');
    if (analysis.transitiveDeepndents.length === 0) {
      console.log('  None - no additional files indirectly depend on this file');
    } else {
      analysis.transitiveDeepndents.forEach(dep => {
        console.log(`  ${dep}`);
      });
    }
    
    console.log('\nWhen this file changes, all the above files should be rebuilt.');
  } else {
    // Display the entire graph
    console.log(visualizeGraph(graph));
  }
}

// Run the main function
main();
