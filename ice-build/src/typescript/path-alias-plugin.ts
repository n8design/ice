import * as path from 'path';
import * as esbuild from 'esbuild';

export function resolvePathAliases(
  projectDir: string,
  sourceDir: string,
  paths: Record<string, string[]>
): esbuild.Plugin {
  const aliases: Record<string, string> = {};
  
  // Process tsconfig paths into esbuild format
  for (const [alias, targets] of Object.entries(paths)) {
    // Convert glob patterns like "@/*" to regex-compatible "@/"
    const normalizedAlias = alias.replace(/\*/g, '');
    
    if (targets && targets.length > 0) {
      // Get first target and normalize (tsconfig typically uses the first entry)
      const target = targets[0].replace(/\*/g, '');
      
      // Create full path but maintain the final segment for esbuild to append
      aliases[normalizedAlias] = path.join(projectDir, target);
    }
  }

  return {
    name: 'path-alias-resolver',
    setup(build) {
      // For each alias, set up a resolver
      Object.entries(aliases).forEach(([alias, target]) => {
        build.onResolve({ filter: new RegExp(`^${escapeRegExp(alias)}`) }, args => {
          // Replace the alias prefix with the target path
          const importPath = args.path.replace(alias, target);
          return { path: importPath };
        });
      });
    }
  };
}

// Helper to escape special characters in regex
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}