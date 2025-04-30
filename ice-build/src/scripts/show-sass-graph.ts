/**
 * Utility script to visualize the SASS dependency graph
 * Usage: 
 *   ts-node show-sass-graph.ts [directory] [--file path/to/file.scss]
 */

import path from 'path';
import fs from 'fs';
import enhancedSassGraph from '../utils/enhanced-sass-graph.js';

// Process arguments
const args = process.argv.slice(2);
let directory = 'src';
let specificFile: string | null = null;

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && i + 1 < args.length) {
    specificFile = args[i + 1];
    i++; // Skip the next arg
  } else if (!args[i].startsWith('--')) {
    directory = args[i];
  }
}

// Check if directory exists
if (!fs.existsSync(directory)) {
  console.error(`Error: Directory "${directory}" does not exist.`);
  process.exit(1);
}

console.log(`Analyzing SCSS files in ${directory}...`);

// Create the graph
const graph = enhancedSassGraph.parseDir(directory, {
  loadPath: [directory],
  extensions: ['scss', 'sass']
});

// If a specific file is provided, analyze its dependencies
if (specificFile) {
  // Resolve the file path
  const resolvedSpecificFile = path.resolve(process.cwd(), specificFile);
  
  if (!fs.existsSync(resolvedSpecificFile)) {
    console.error(`Error: File "${specificFile}" does not exist.`);
    process.exit(1);
  }
  
  console.log(`\nDependency analysis for: ${resolvedSpecificFile}`);
  console.log('=========================================');
  
  const analysis = enhancedSassGraph.analyzeFileDependencies(graph, resolvedSpecificFile);
  
  console.log(`File: ${analysis.file}`);
  
  // Add file type information
  if (analysis.isIndexFile) {
    console.log('Type: Index file (used to aggregate styles)');
  } else if (analysis.isPartial) {
    console.log('Type: Partial (must be imported by other files)');
  } else {
    console.log('Type: Main file (compiled directly to CSS)');
  }
  
  console.log('\nDirect Dependents (files that directly import this file):');
  if (analysis.directDependents.length === 0) {
    console.log('  None - no files directly import this file');
  } else {
    analysis.directDependents.forEach((dep: string) => {
      console.log(`  ${dep}`);
    });
  }
  
  console.log('\nTransitive Dependents (files that indirectly depend on this file):');
  if (analysis.transitiveDeepndents.length === 0) {
    console.log('  None - no additional files indirectly depend on this file');
  } else {
    analysis.transitiveDeepndents.forEach((dep: string) => {
      console.log(`  ${dep}`);
    });
  }
  
  console.log('\nWhen this file changes, all the above files should be rebuilt.');
} else {
  // Display the entire graph
  console.log(enhancedSassGraph.visualizeGraph(graph));
}
