import path from 'path';
import fs from 'fs/promises';
import { Logger } from '../utils/logger.js';
import { IceConfig } from '../types.js';

const logger = new Logger('Graph Exporter');

/**
 * Export the CSS dependency graph
 * @param scssBuilder The SCSS builder instance
 * @param config Ice build configuration
 */
export async function exportGraph(
  scssBuilder: any, 
  config: IceConfig
): Promise<void> {
  // Get the dependency graph from the SCSS builder
  const graph = scssBuilder.getDependencyGraph();
  
  if (!graph) {
    logger.warn('No dependency graph available');
    return;
  }
  
  // Check if graph is empty (no entries)
  const graphEntries = Object.keys(graph);
  if (graphEntries.length === 0) {
    logger.warn('Dependency graph is empty. This might happen if no SCSS files were found or processed.');
    logger.info('Try running a build first with `ice-build build` or check your SCSS file patterns.');
    return;
  }
  
  logger.info(`Found ${graphEntries.length} files in the dependency graph`);
  
  // Determine formats to export
  const formats = getExportFormats(config);
  
  // Determine output path
  const outputPath = getOutputPath(config);
  
  // Create output directory if it doesn't exist
  await fs.mkdir(outputPath, { recursive: true });
  
  // Export in each requested format
  for (const format of formats) {
    await exportInFormat(graph, format, outputPath);
  }
}

/**
 * Get the export formats from config
 */
function getExportFormats(config: IceConfig): string[] {
  const format = config.graph?.format || 'json';
  
  if (format === 'all') {
    return ['json', 'dot', 'nx'];
  }
  
  return [format];
}

/**
 * Get the output path from config
 */
function getOutputPath(config: IceConfig): string {
  // Use specified graph output path if available
  if (config.graph?.outputPath) {
    return config.graph.outputPath;
  }
  
  // Otherwise use the main output path + '/graphs'
  let outputDir: string;
  
  if (typeof config.output === 'string') {
    outputDir = config.output;
  } else if (config.output && typeof config.output === 'object') {
    outputDir = config.output.path;
  } else {
    outputDir = 'public';
  }
  
  return path.join(outputDir, 'graphs');
}

/**
 * Export the graph in the specified format
 */
async function exportInFormat(
  graph: any, 
  format: string, 
  outputPath: string
): Promise<void> {
  try {
    switch (format) {
      case 'json':
        await exportJsonGraph(graph, outputPath);
        break;
      case 'dot':
        await exportDotGraph(graph, outputPath);
        break;
      case 'nx':
        await exportNxGraph(graph, outputPath);
        break;
      default:
        logger.warn(`Unknown format: ${format}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to export graph in ${format} format: ${errorMessage}`);
  }
}

/**
 * Export the graph in JSON format
 */
async function exportJsonGraph(graph: any, outputPath: string): Promise<void> {
  const jsonPath = path.join(outputPath, 'scss-dependency-graph.json');
  
  // Convert graph to JSON format
  const jsonGraph = formatGraphAsJson(graph);
  
  // Write to file
  await fs.writeFile(jsonPath, JSON.stringify(jsonGraph, null, 2), 'utf-8');
  
  logger.success(`JSON graph exported to ${jsonPath}`);
}

/**
 * Export the graph in DOT format for Graphviz
 */
async function exportDotGraph(graph: any, outputPath: string): Promise<void> {
  const dotPath = path.join(outputPath, 'scss-dependency-graph.dot');
  
  // Convert graph to DOT format
  const dotGraph = formatGraphAsDot(graph);
  
  // Write to file
  await fs.writeFile(dotPath, dotGraph, 'utf-8');
  
  logger.success(`DOT graph exported to ${dotPath}`);
}

/**
 * Export the graph in NX format
 */
async function exportNxGraph(graph: any, outputPath: string): Promise<void> {
  const nxPath = path.join(outputPath, 'scss-dependency-graph-nx.json');
  
  // Convert graph to NX format
  const nxGraph = formatGraphAsNx(graph);
  
  // Write to file
  await fs.writeFile(nxPath, JSON.stringify(nxGraph, null, 2), 'utf-8');
  
  logger.success(`NX graph exported to ${nxPath}`);
}

/**
 * Format the graph as JSON
 */
function formatGraphAsJson(graph: any): any {
  // Simple format that shows files and their dependencies
  const formattedGraph: Record<string, string[]> = {};
  
  // Assuming graph is a Map or object of fileName -> dependencies
  for (const [file, deps] of Object.entries(graph)) {
    formattedGraph[file] = Array.isArray(deps) ? deps : [];
  }
  
  return formattedGraph;
}

/**
 * Format the graph as DOT (Graphviz)
 */
function formatGraphAsDot(graph: any): string {
  let dot = 'digraph scss_dependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style=filled, fillcolor=lightskyblue];\n\n';
  
  // Group files by directory for better visualization
  dot += '  // Group files by directory\n';
  const dirGroups = new Map<string, string[]>();
  
  for (const file of Object.keys(graph)) {
    const dirname = path.dirname(file);
    if (!dirGroups.has(dirname)) {
      dirGroups.set(dirname, []);
    }
    dirGroups.get(dirname)?.push(file);
  }
  
  // Create subgraphs for directories
  let clusterIndex = 0;
  for (const [dir, files] of dirGroups.entries()) {
    const dirName = path.basename(dir);
    dot += `  subgraph cluster_${clusterIndex++} {\n`;
    dot += `    label = "${dirName}";\n`;
    dot += `    style = "rounded,filled";\n`;
    dot += `    fillcolor = lightyellow;\n`;
    dot += `    node [style=filled, fillcolor=lightskyblue];\n\n`;
    
    // Add nodes for this directory
    for (const file of files) {
      const fileName = path.basename(file);
      dot += `    "${fileName}";\n`;
    }
    dot += `  }\n\n`;
  }
  
  // Add edges between nodes
  dot += '  // Add dependencies\n';
  for (const [file, deps] of Object.entries(graph)) {
    // Use only basename for cleaner graph
    const sourceFile = path.basename(file);
    
    if (Array.isArray(deps) && deps.length > 0) {
      for (const dep of deps) {
        const targetFile = path.basename(dep);
        dot += `  "${sourceFile}" -> "${targetFile}";\n`;
      }
    }
  }
  
  dot += '}\n';
  return dot;
}

/**
 * Format the graph for NX visualization
 */
function formatGraphAsNx(graph: any): any {
  const nodes: any[] = [];
  const edges: any[] = [];
  
  // Create a map of file paths to node IDs
  const fileToId: Record<string, string> = {};
  let idCounter = 0;
  
  // First pass: create nodes
  for (const file of Object.keys(graph)) {
    const id = `n${idCounter++}`;
    fileToId[file] = id;
    
    nodes.push({
      id,
      label: path.basename(file),
      data: {
        fileName: file,
        type: 'scss'
      }
    });
  }
  
  // Second pass: create edges
  for (const [file, deps] of Object.entries(graph)) {
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        // Only add edge if both source and target exist
        if (fileToId[file] && fileToId[dep]) {
          edges.push({
            source: fileToId[file],
            target: fileToId[dep],
            id: `e${edges.length}`
          });
        }
      }
    }
  }
  
  return {
    graph: {
      nodes,
      edges
    }
  };
}
