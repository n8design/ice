/**
 * Enhanced Sass Graph Wrapper
 * Adds better cross-platform support for path handling in sass dependency tracking
 */

import sassGraph from 'sass-graph';
import path from 'path';

/**
 * Normalize paths to use forward slashes for cross-platform compatibility
 * @param filepath Path to normalize
 */
export function normalizePath(filepath: string): string {
  return filepath.replace(/\\/g, '/');
}

/**
 * Create a sass graph with enhanced cross-platform support
 * @param dir Directory to scan
 * @param options Graph options
 */
export function createGraph(dir: string, options: any = {}): any {
  const graph = sassGraph.parseDir(dir, options);
  
  if (graph && graph.index) {
    // Create normalized version of the graph
    const normalizedIndex: Record<string, { 
      imports: string[], 
      importedBy: string[] 
    }> = {};
    
    // Normalize all paths in the index
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
    
    // Enhance the visitAncestors method to handle normalized paths
    const originalVisitAncestors = graph.visitAncestors;
    graph.visitAncestors = (filePath: string) => {
      // Always normalize input path
      const normalizedPath = normalizePath(filePath);
      
      // Try with normalized path first
      let result = originalVisitAncestors.call(graph, normalizedPath) || {};
      
      // If no results, try with original path
      if (Object.keys(result).length === 0) {
        result = originalVisitAncestors.call(graph, filePath) || {};
      }
      
      // If still no results, try with lowercase path (for Windows case insensitivity)
      if (Object.keys(result).length === 0) {
        result = originalVisitAncestors.call(graph, normalizedPath.toLowerCase()) || {};
      }
      
      return result;
    };
  }
  
  return graph;
}

export default {
  parseDir: createGraph,
  normalizePath
};
