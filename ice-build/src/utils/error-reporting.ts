import * as ts from 'typescript';
import * as path from 'path';
import { logError } from './console.js';

// Function to handle TypeScript error messages
export function formatTypeScriptError(diagnostic: ts.Diagnostic): string {
  let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  
  if (diagnostic.file) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
    message = `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
  }
  
  return message;
}

// Custom interface that matches what we need
interface ModuleResolutionInfo {
  resolvedModule?: { resolvedFileName?: string };
  failedLookupLocations?: string[];
}

// Format module resolution errors
export function formatModuleResolutionError(error: ModuleResolutionInfo): string {
  let message = `Could not resolve module: ${error.resolvedModule?.resolvedFileName || 'unknown'}`;
  
  if (error.failedLookupLocations && error.failedLookupLocations.length > 0) {
    message += '\nTried locations:\n';
    message += error.failedLookupLocations.slice(0, 5).map((location: string) => `  - ${location}`).join('\n');
    
    if (error.failedLookupLocations.length > 5) {
      message += `\n  ... and ${error.failedLookupLocations.length - 5} more locations`;
    }
  }
  
  return message;
}

// Handle TypeScript compiler host errors
export function createDiagnosticReporter(): ts.DiagnosticReporter {
  return (diagnostic: ts.Diagnostic) => {
    const message = formatTypeScriptError(diagnostic);
    switch (diagnostic.category) {
      case ts.DiagnosticCategory.Error:
        logError(`TypeScript Error: ${message}`);
        break;
      case ts.DiagnosticCategory.Warning:
        console.warn(`TypeScript Warning: ${message}`);
        break;
      case ts.DiagnosticCategory.Message:
        console.info(`TypeScript Info: ${message}`);
        break;
      default:
        console.log(`TypeScript: ${message}`);
    }
  };
}

// Function to suggest module resolution fixes based on error
export function suggestModuleResolutionFix(
  importPath: string,
  containingFile: string
): string {
  let suggestion = '';
  
  // Check if it might be an extension issue
  if (!path.extname(importPath) && !importPath.startsWith('@') && !importPath.startsWith('.')) {
    // It's likely a node module
    suggestion = `Make sure '${importPath}' is installed in node_modules.`;
  } else if (!path.extname(importPath)) {
    // It might need an explicit extension
    const moduleResolutionSetting = getModuleResolutionFromTSConfig();
    if (moduleResolutionSetting === 'NodeNext' || moduleResolutionSetting === 'Node16') {
      suggestion = `Try adding explicit file extension to '${importPath}' (e.g. '${importPath}.js').`;
    }
  }
  
  return suggestion;
}

// Function to get moduleResolution setting from tsconfig (mock implementation)
function getModuleResolutionFromTSConfig(): string {
  try {
    // In a real implementation, this would parse the tsconfig.json
    // But for this example, we'll return a fixed value
    return 'NodeNext'; // or could be 'Node16', 'Node', 'Classic', etc.
  } catch (err) {
    return 'Classic'; // default fallback
  }
}

// This function would check if a module name needs .js extension in imports
export function needsExplicitExtension(moduleResolution: string): boolean {
  // Check for the newer module resolution strategies that require extensions
  return moduleResolution === 'NodeNext' || moduleResolution === 'Node16';
}