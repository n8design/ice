import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCSSBuilder } from '../../src/builders/scss.js';
import { IceConfig } from '../../src/types.js';
import * as path from 'path';

/**
 * Tests for Windows path normalization and cross-platform compatibility.
 * These tests simulate Windows environment behavior even on non-Windows systems
 * to ensure our path handling works correctly across all platforms.
 */
describe('Windows Path Normalization', () => {
  let scssBuilder: SCSSBuilder;
  let originalPathSep: string;
  let originalPlatform: string;

  beforeEach(() => {
    // Store original values
    originalPathSep = path.sep;
    originalPlatform = process.platform;

    // Mock Windows environment
    Object.defineProperty(process, 'platform', { value: 'win32' });
    
    const mockConfig: IceConfig = {
      input: {
        ts: [],
        scss: ['C:\\project\\source\\**\\*.scss'],
        html: []
      },
      output: { path: 'C:\\project\\public' },
      watch: { paths: ['C:\\project\\source'], ignored: [] },
      sass: { style: 'expanded', sourceMap: true },
      postcss: { plugins: [] }
    };

    scssBuilder = new SCSSBuilder(mockConfig);
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    vi.restoreAllMocks();
  });

  describe('Path Normalization', () => {
    it('should normalize simple Windows paths', () => {
      const builderAny = scssBuilder as any;
      
      const testCases = [
        { input: 'C:\\Users\\Developer\\project\\src\\styles.scss', expected: 'C:/Users/Developer/project/src/styles.scss' },
        { input: 'C:/Users/Developer/project/src/styles.scss', expected: 'C:/Users/Developer/project/src/styles.scss' },
        { input: '..\\..\\styles\\main.scss', expected: '../../styles/main.scss' },
        { input: '.\\styles\\components\\button.scss', expected: './styles/components/button.scss' },
        { input: 'node_modules\\bootstrap\\scss\\bootstrap.scss', expected: 'node_modules/bootstrap/scss/bootstrap.scss' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = builderAny.normalizePath(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle mixed slash scenarios', () => {
      const builderAny = scssBuilder as any;
      
      const mixedPaths = [
        'C:\\project/source\\styles/main.scss',
        'C:/project\\source/styles\\components/button.scss',
        '..\\node_modules/some-package\\dist/styles.scss'
      ];

      const expected = [
        'C:/project/source/styles/main.scss',
        'C:/project/source/styles/components/button.scss',
        '../node_modules/some-package/dist/styles.scss'
      ];

      mixedPaths.forEach((mixedPath, index) => {
        const result = builderAny.normalizePath(mixedPath);
        expect(result).toBe(expected[index]);
      });
    });

    it('should handle UNC paths correctly', () => {
      const builderAny = scssBuilder as any;
      
      const uncPaths = [
        '\\\\server\\share\\project\\styles.scss',
        '//server/share/project/styles.scss',
        '\\\\localhost\\c$\\project\\source\\styles.scss'
      ];

      const expectedResults = [
        '//server/share/project/styles.scss',
        '//server/share/project/styles.scss',
        '//localhost/c$/project/source/styles.scss'
      ];

      uncPaths.forEach((uncPath, index) => {
        const result = builderAny.normalizePath(uncPath);
        expect(result).toBe(expectedResults[index]);
      });
    });

    it('should preserve drive letters correctly', () => {
      const builderAny = scssBuilder as any;
      
      const driveLetterPaths = [
        'A:\\project\\styles.scss',
        'Z:\\very-long-path\\to\\deep\\nested\\directory\\file.scss',
        'C:\\',
        'D:\\single-file.scss'
      ];

      driveLetterPaths.forEach(drivePath => {
        const result = builderAny.normalizePath(drivePath);
        expect(result).toMatch(/^[A-Z]:\//);
        expect(result).not.toContain('\\');
      });
    });
  });

  describe('Path Comparison and Resolution', () => {
    it('should compare paths correctly regardless of slash direction', () => {
      const builderAny = scssBuilder as any;
      
      const pathPairs = [
        ['C:\\project\\src\\styles.scss', 'C:/project/src/styles.scss'],
        ['..\\components\\_button.scss', '../components/_button.scss'],
        ['node_modules\\package\\dist\\styles.scss', 'node_modules/package/dist/styles.scss']
      ];

      pathPairs.forEach(([path1, path2]) => {
        const norm1 = builderAny.normalizePath(path1);
        const norm2 = builderAny.normalizePath(path2);
        expect(norm1).toBe(norm2);
      });
    });

    it('should handle relative path resolution', () => {
      const builderAny = scssBuilder as any;
      
      const relativePaths = [
        '.\\styles\\main.scss',
        '..\\..\\shared\\components.scss',
        '.\\..\\styles\\variables.scss',
        '..\\node_modules\\package\\styles.scss'
      ];

      const expectedPaths = [
        './styles/main.scss',
        '../../shared/components.scss',
        './../styles/variables.scss',
        '../node_modules/package/styles.scss'
      ];

      relativePaths.forEach((relativePath, index) => {
        const result = builderAny.normalizePath(relativePath);
        expect(result).toBe(expectedPaths[index]);
      });
    });

    it('should handle edge cases and malformed paths', () => {
      const builderAny = scssBuilder as any;
      
      const edgeCases = [
        'C:\\\\double\\\\backslashes\\\\file.scss',
        'C://double//forward//slashes//file.scss',
        'C:\\mixed\\\\and//slashes\\file.scss',
        'C:\\trailing\\backslash\\',
        'C:/trailing/forward/slash/'
      ];

      edgeCases.forEach(edgeCase => {
        const result = builderAny.normalizePath(edgeCase);
        // Should not contain consecutive slashes or backslashes
        expect(result).not.toMatch(/[\\\/]{2,}/);
        // Should not contain any backslashes
        expect(result).not.toContain('\\');
      });
    });
  });

  describe('Directory Relationship Detection', () => {
    it('should detect directory relationships correctly with Windows paths', () => {
      const builderAny = scssBuilder as any;
      
      const testCases = [
        {
          parent: 'C:\\project\\source',
          child: 'C:\\project\\source\\styles\\main.scss',
          shouldBeChild: true
        },
        {
          parent: 'C:\\project\\source\\styles',
          child: 'C:\\project\\source\\components\\button.scss',
          shouldBeChild: false
        },
        {
          parent: 'C:\\project',
          child: 'C:\\project\\source\\deep\\nested\\file.scss',
          shouldBeChild: true
        },
        {
          parent: 'D:\\different-drive',
          child: 'C:\\project\\file.scss',
          shouldBeChild: false
        }
      ];

      testCases.forEach(({ parent, child, shouldBeChild }) => {
        const normalizedParent = builderAny.normalizePath(parent);
        const normalizedChild = builderAny.normalizePath(child);
        
        const isChild = normalizedChild.startsWith(normalizedParent + '/');
        expect(isChild).toBe(shouldBeChild);
      });
    });

    it('should handle node_modules path resolution on Windows', () => {
      const builderAny = scssBuilder as any;
      
      // Mock config with Windows paths
      builderAny.config = {
        ...builderAny.config,
        projectRoot: 'C:\\project',
        source: 'C:\\project\\source'
      };

      // Test the node modules path construction logic by checking normalization
      const mockNodeModulesPath = 'C:\\project\\node_modules\\@bootstrap\\scss';
      const normalizedPath = builderAny.normalizePath(mockNodeModulesPath);
      
      // Should be normalized and correctly resolved
      expect(normalizedPath).toMatch(/node_modules\/@bootstrap\/scss/);
      expect(normalizedPath).not.toContain('\\');
    });
  });

  describe('Import Resolution', () => {
    it('should resolve SCSS imports with Windows paths', () => {
      const builderAny = scssBuilder as any;
      
      const currentFile = 'C:\\project\\source\\styles\\main.scss';
      const importStatements = [
        'C:\\project\\source\\styles\\components\\_button.scss',
        'C:\\project\\shared\\variables.scss',
        'C:\\project\\node_modules\\bootstrap\\scss\\bootstrap.scss',
        'C:\\project\\source\\styles\\local\\component.scss'
      ];

      importStatements.forEach(importPath => {
        const resolvedPath = builderAny.normalizePath(importPath);
        
        // All resolved paths should be normalized
        expect(resolvedPath).not.toContain('\\');
        expect(resolvedPath).toMatch(/\.scss$/);
      });
    });

    it('should handle partial imports correctly on Windows', () => {
      const builderAny = scssBuilder as any;
      
      const partialImports = [
        'C:\\project\\source\\styles\\components\\_button.scss',  
        'C:\\project\\source\\styles\\mixins\\_helpers.scss',    
        'C:\\project\\source\\styles\\utilities\\_spacing.scss'  
      ];

      partialImports.forEach(partialImport => {
        const resolvedPath = builderAny.normalizePath(partialImport);
        
        // Should be normalized and have correct underscore prefix
        expect(resolvedPath).not.toContain('\\');
        expect(resolvedPath).toMatch(/_[^/]+\.scss$/);
      });
    });
  });

  describe('Output Path Generation', () => {
    it('should generate correct output paths for Windows source files', () => {
      const builderAny = scssBuilder as any;
      
      const testCases = [
        {
          sourceFile: 'C:\\project\\source\\styles\\main.scss',
          sourceDir: 'C:\\project\\source',
          outputDir: 'C:\\project\\public\\css',
          expectedPattern: /public[/\\]css[/\\]styles[/\\]main\.css$/
        },
        {
          sourceFile: 'C:\\project\\source\\components\\button\\button.scss',
          sourceDir: 'C:\\project\\source',
          outputDir: 'C:\\project\\dist\\stylesheets',
          expectedPattern: /dist[/\\]stylesheets[/\\]components[/\\]button[/\\]button\.css$/
        }
      ];

      testCases.forEach(({ sourceFile, sourceDir, outputDir, expectedPattern }) => {
        // Mock config for this test case
        builderAny.config = {
          ...builderAny.config,
          source: sourceDir,
          public: outputDir
        };

        const outputPath = builderAny.getOutputPath(sourceFile);
        expect(outputPath).toMatch(expectedPattern);
      });
    });
  });
});
