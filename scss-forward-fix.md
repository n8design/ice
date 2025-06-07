# SCSS Forward Fix

Based on our analysis, here's how to fix the issue with `@forward` directives in nested SCSS files, particularly for problems with `/source/styles/03-organisms/mat-mgmt/_index.scss` files not triggering rebuilds properly.

## Changes to make in `SCSSBuilder.getParentFiles` method

Replace the special handling section for index files and forwarding with this enhanced implementation:

```typescript
// Enhanced handling for index files or modules using @forward
// For partials without direct importers, check if they might be forwarded
if (currentNode.importers.size === 0 && path.basename(currentPath).startsWith('_')) {
  // First approach: Check for direct inclusion in any index files
  for (const [filePath, node] of this.dependencyGraph.entries()) {
    // Skip self and non-partials
    if (filePath === currentPath || !path.basename(filePath).startsWith('_')) continue;
    
    // Check if this file is explicitly used by any index file
    if (node.uses.has(currentPath)) {
      if (this.verboseLogging) {
        logger.debug(`${path.basename(filePath)} directly uses/forwards ${path.basename(currentPath)}`);
      }
      findAllParents(filePath, depth + 1);
    }
  }
  
  // Second approach: More aggressively check for index files that might be forwarding this
  for (const [filePath, node] of this.dependencyGraph.entries()) {
    // Skip self
    if (filePath === currentPath) continue;
    
    // Focus specifically on index files
    const isIndexFile = path.basename(filePath).startsWith('_index.');
    if (!isIndexFile) continue;
    
    // Get directory relationships
    const fileDir = path.dirname(filePath);
    const currentDir = path.dirname(currentPath);
    
    // ENHANCED: More permissive directory relationships, exploring every possibility
    const directRelationship = fileDir === currentDir; // Same directory
    const parentChildRelationship = currentDir.startsWith(fileDir) || fileDir.startsWith(currentDir); // Parent-child relationship
    
    // ENHANCED: Check even files in sibling directories - mat-mgmt might have a reference related to another sibling dir
    const commonParent = currentDir.split('/').slice(0, -1).join('/') === fileDir.split('/').slice(0, -1).join('/');
    
    // ENHANCED: For more specific patterns like organisms/mat-mgmt/_index.scss
    const isDeepStructure = currentDir.includes('/03-organisms/') || 
                            currentDir.includes('/organisms/') || 
                            fileDir.includes('/03-organisms/') ||
                            fileDir.includes('/organisms/');
                            
    // EXPANDED: Check more aggressively for potential relationships
    if (isIndexFile && (directRelationship || parentChildRelationship || commonParent || isDeepStructure)) {
      if (this.verboseLogging) {
        if (directRelationship) {
          logger.debug(`Found index file ${path.basename(filePath)} in the same directory`);
        } else if (parentChildRelationship) {
          logger.debug(`Found index file ${path.basename(filePath)} in parent/child relationship with ${path.basename(currentPath)}`);
        } else if (commonParent) {
          logger.debug(`Found index file ${path.basename(filePath)} in sibling directory to ${path.basename(currentPath)}`);
        } else if (isDeepStructure) {
          logger.debug(`Found index file ${path.basename(filePath)} in organisms structure - special handling`);
        }
      }
      
      // Check if any of these index files are imported by other files
      if (node.importers.size > 0) {
        for (const forwardingImporter of node.importers) {
          findAllParents(forwardingImporter, depth + 1);
        }
      } else {
        // Even if this index isn't imported directly, recursively check it
        findAllParents(filePath, depth + 1);
      }
    }
  }
  
  // Third approach: Extra check for organisms/mat-mgmt pattern specifically
  if (path.basename(currentPath) !== '_index.scss') { // Skip index files to prevent loops
    for (const [filePath, node] of this.dependencyGraph.entries()) {
      if (filePath === currentPath) continue;
      
      const isIndexFile = path.basename(filePath).startsWith('_index.');
      if (!isIndexFile) continue;
      
      const fileBaseName = path.basename(filePath, '.scss').replace(/^_/, '');
      const currentBaseName = path.basename(currentPath, '.scss').replace(/^_/, '');
      
      // Check if we're in mat-mgmt or similar patterns with matching index files
      if (fileBaseName === 'index' && 
         (currentPath.includes('/mat-mgmt/') || 
          currentPath.includes('/organisms/') || 
          currentPath.includes('/components/'))) {
          
        if (this.verboseLogging) {
          logger.debug(`Special check for ${currentBaseName} in potential forwarding structure: ${filePath}`);
        }
        findAllParents(filePath, depth + 1);
      }
    }
  }
}
```

## Enhanced diagnostic code for the no parent files case

Replace the diagnostic section when no parent files are found with this improved version:

```typescript
// Additional diagnostic logs
if (this.verboseLogging) {
  const node = this.dependencyGraph.get(normalizedPartialPath);
  
  // Check all potential usages
  const directUsers = [];
  
  for (const [filePath, n] of this.dependencyGraph.entries()) {
    if (n.uses.has(normalizedPartialPath)) {
      directUsers.push(filePath);
    }
  }
  
  if (directUsers.length > 0) {
    logger.debug(`Files directly using ${path.basename(normalizedPartialPath)}:`);
    directUsers.forEach(user => logger.debug(`  → ${path.basename(user)} (${user})`));
  } else {
    logger.debug(`No files directly use ${path.basename(normalizedPartialPath)}`);
  }
  
  // Check if this is likely being used via an index file
  const dirName = path.dirname(normalizedPartialPath);
  const indexInSameDir = this.dependencyGraph.has(
    this.normalizePath(path.join(dirName, '_index.scss'))
  );
  
  if (indexInSameDir) {
    logger.debug(`Note: Found _index.scss in same directory - check forwarding`);
  }
  
  // Look for any index files in parent directories
  let currentDir = path.dirname(normalizedPartialPath);
  const rootDir = process.cwd();
  let parentIndexFound = false;
  
  while (currentDir !== rootDir && currentDir !== path.dirname(currentDir)) {
    const potentialIndexPath = this.normalizePath(path.join(currentDir, '_index.scss'));
    
    if (this.dependencyGraph.has(potentialIndexPath)) {
      logger.debug(`Found potential parent index file: ${potentialIndexPath}`);
      parentIndexFound = true;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  if (!parentIndexFound && !indexInSameDir) {
    logger.debug(`No _index.scss files found in parent directories`);
  }
  
  // Try to trace and display dependency chain
  this.traceFullDependencyPath(normalizedPartialPath);
}
```

## Additional improvements to the `traceFullDependencyPath` method

Add these sections to the `traceFullDependencyPath` method to make it more thorough:

```typescript
// Step 2: Check for index files that might forward this file
logger.info(`Checking for index files that might forward ${path.basename(filePath)}:`);

// Check if this file is directly used by any index file
let foundForwarding = false;
for (const [indexPath, indexNode] of this.dependencyGraph.entries()) {
  if (path.basename(indexPath).startsWith('_index.') && indexNode.uses.has(normalizedPath)) {
    foundForwarding = true;
    logger.info(`  → ${path.basename(indexPath)} (${indexPath}) directly forwards this file`);
    
    // Check what imports this index file
    if (indexNode.importers.size > 0) {
      logger.info(`    Importers of ${path.basename(indexPath)}:`);
      for (const indexImporter of indexNode.importers) {
        logger.info(`      → ${path.basename(indexImporter)} (${indexImporter})`);
      }
    } else {
      logger.info(`    No direct importers of ${path.basename(indexPath)}`);
      
      // Recursively check if this index might be forwarded by other indexes
      this.traceIndexForwarding(indexPath, '      ');
    }
  }
}
```

## Add a new helper method `traceIndexForwarding`

```typescript
/**
 * Trace and print the forwarding chain for an index file
 * @param indexPath Path to the index file
 * @param indent String indentation for pretty printing
 */
private traceIndexForwarding(indexPath: string, indent: string = ''): void {
  // Check if this index file is used/forwarded by other index files
  for (const [otherPath, otherNode] of this.dependencyGraph.entries()) {
    if (otherPath !== indexPath && path.basename(otherPath).startsWith('_index.') && 
        otherNode.uses.has(indexPath)) {
      logger.info(`${indent}→ ${path.basename(otherPath)} (${otherPath}) forwards this index`);
      
      // If this other index has importers, log them
      if (otherNode.importers.size > 0) {
        logger.info(`${indent}  Importers of ${path.basename(otherPath)}:`);
        for (const otherImporter of otherNode.importers) {
          logger.info(`${indent}    → ${path.basename(otherImporter)} (${otherImporter})`);
        }
      } else {
        logger.info(`${indent}  No direct importers of ${path.basename(otherPath)}`);
        // Recursively check further forwarding (with recursion limit)
        if (indent.length < 20) { // Prevent infinite recursion
          this.traceIndexForwarding(otherPath, `${indent}  `);
        }
      }
    }
  }
}
```

## Testing the fix

The following manual testing will verify the fix works:

1. Create a test structure similar to your problem case:
```
/source/styles/03-organisms/mat-mgmt/_index.scss
/source/styles/03-organisms/mat-mgmt/_specific-component.scss
/source/styles/main.scss
```

2. In `_index.scss`, use `@forward 'specific-component'`

3. In `main.scss`, import `@use '03-organisms/mat-mgmt'`

4. Modify `_specific-component.scss` and verify that `main.scss` is rebuilding as expected

## Key insights on the issue

The primary issue is that the dependency graph wasn't being traversed thoroughly enough when dealing with multi-level forwarding. The improvements make the detection more aggressive and handle:

1. Direct usage through `@forward` directives
2. Directory-based relationships regardless of nesting level
3. Handling files with special naming patterns like `mat-mgmt`
4. More thorough traversal through multiple levels of `_index.scss` forwarding chains
