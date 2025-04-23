import * as esbuild from 'esbuild';
import * as path from 'path';
import { TsconfigRaw } from 'esbuild';

export function resolvePathAliases(tsConfig: TsconfigRaw | null, projectDir: string): esbuild.Plugin {
  return {
    name: 'resolve-path-aliases',
    setup(build) {
      const paths = tsConfig?.compilerOptions?.paths;
      if (!paths) {
        return; // No paths defined, do nothing
      }

      const baseUrl = tsConfig?.compilerOptions?.baseUrl
        ? path.resolve(projectDir, tsConfig.compilerOptions.baseUrl)
        : projectDir;

      // Create filter regex from alias keys
      const aliasKeys = Object.keys(paths).map(key =>
        key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '.*')
      );
      const filter = new RegExp(`^(${aliasKeys.join('|')})$`);

      build.onResolve({ filter }, async (args) => {
        // Prevent infinite loops if an alias resolves to itself or another alias
        if (args.pluginData?.resolvedByAlias) {
            return undefined;
        }

        for (const alias in paths) {
          const aliasRegex = new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '(.*)')}$`);
          const match = args.path.match(aliasRegex);

          if (match) {
            const aliasPaths = paths[alias];
            const suffix = match[1] || '';

            for (const aliasPath of aliasPaths) {
              const potentialPath = path.resolve(baseUrl, aliasPath.replace('*', suffix));

              try {
                  // Use the build.resolve provided by esbuild's setup context
                  const result = await build.resolve(potentialPath, {
                      kind: args.kind,
                      resolveDir: args.resolveDir,
                      importer: args.importer,
                      // Mark that this resolution attempt comes from the alias plugin
                      pluginData: { resolvedByAlias: true }
                  });

                  // Check if resolution was successful and didn't cause an error
                  if (result.path && !result.errors.length) {
                      // Return the resolved path
                      return { path: result.path, external: result.external, sideEffects: result.sideEffects };
                  }
              } catch (e) {
                  // Resolution failed for this specific aliasPath, continue to the next one
              }
            }
          }
        }
        // If no alias resolution worked after trying all possibilities
        return undefined;
      });
    },
  };
}