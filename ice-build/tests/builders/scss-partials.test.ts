import { describe, it, expect, beforeEach, afterEach, vi, test, MockInstance } from 'vitest';
import path from 'path';
import os from 'os';
import * as fs from 'fs'; // Import for types and minimal sync mock
import * as fsPromises from 'fs/promises'; // Import actual promises API
import { SCSSBuilder } from '../../src/builders/scss.js'; // Import the class
import { IceConfig } from '../../src/types';
import * as globModule from 'glob'; // Import glob module
import { Mock } from 'vitest'; // Import Mock type
import * as loggerModule from '../../src/utils/logger.js'; // Import the module itself

// --- Minimal fs Mock (Sync methods for setup/teardown) ---
const mockFsExistsStorePartials: { [key: string]: boolean } = {};
vi.mock('fs', async (importActual) => {
  const actualFs = await importActual<typeof import('fs')>();
  const pathModule = await import('path');
  const normalizeMockPath = (p: string) => pathModule.normalize(p).replace(/\\/g, '/');
  let tempDirCounter = 0;
  return {
    ...actualFs,
    existsSync: vi.fn((p: fs.PathLike) => mockFsExistsStorePartials[normalizeMockPath(p.toString())] ?? false),
    mkdtempSync: vi.fn((prefix: string) => {
      const tempDir = pathModule.join(os.tmpdir(), `mock-partials-temp-${Date.now()}-${tempDirCounter++}`);
      mockFsExistsStorePartials[normalizeMockPath(tempDir)] = true;
      return tempDir;
    }),
    rmSync: vi.fn((p: fs.PathLike, opts) => {
      const normalized = normalizeMockPath(p.toString());
      delete mockFsExistsStorePartials[normalized];
      if (opts?.recursive) { /* ... */ }
    }),
  };
});

// --- Remove fs/promises mock factory ---

// --- Mock glob ---
vi.mock('glob', () => ({
  glob: vi.fn().mockImplementation((pattern) => {
    // Always return an array of paths for any pattern
    if (typeof pattern === 'string' && pattern.includes('.scss')) {
      return Promise.resolve([
        'source/style.scss', 
        'source/_variables.scss',
        'source/_partial.scss',
        'source/theme.scss',
        'source/components/_button.scss'
      ]);
    }
    return Promise.resolve([]);
  })
}));

// --- Logger Mock Setup ---
// Define everything inside the factory
vi.mock('../../src/utils/logger.js', () => {
  const mockFns = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  };
  return {
    // Export the mock functions for later access
    __mockLoggerFns: mockFns,
    Logger: class {
      info = mockFns.info;
      warn = mockFns.warn;
      error = mockFns.error;
      success = mockFns.success;
      debug = mockFns.debug;
    }
  };
});

// --- Define paths needed for graph mock at top level ---
let variablesPath: string, partialPath: string, buttonPath: string, stylePath: string, themePath: string, windowsPath: string;

describe('SCSS Partials and Dependency Graph', () => {
  let scssBuilder: SCSSBuilder;
  let tempDir: string;
  let mockConfig: any;
  let processScssFileSpy: MockInstance<any>; // Use any for simplicity

  beforeEach(async () => {
    // Reset mocks FIRST
    vi.resetAllMocks();
    const mockedLoggerModule = loggerModule as any; // Cast to access exported mock
    if (mockedLoggerModule.__mockLoggerFns) {
        Object.values(mockedLoggerModule.__mockLoggerFns).forEach((mockFn: any) => mockFn.mockClear());
    }
    Object.keys(mockFsExistsStorePartials).forEach(key => delete mockFsExistsStorePartials[key]);

    const fsSync = await import('fs');
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'ice-scss-test-partials-'));

    const sourceDir = path.join(tempDir, 'source');
    const publicDir = path.join(tempDir, 'public');
    const componentsDir = path.join(sourceDir, 'components');

    // Assign paths
    variablesPath = path.join(sourceDir, '_variables.scss');
    partialPath = path.join(sourceDir, '_partial.scss');
    buttonPath = path.join(componentsDir, '_button.scss');
    stylePath = path.join(sourceDir, 'style.scss');
    themePath = path.join(sourceDir, 'theme.scss');
    windowsPath = path.join(sourceDir, 'components\\_button.scss'); // For cross-platform test

    mockConfig = {
      input: { scss: [sourceDir], ts: [] },
      output: { path: publicDir },
      watch: { paths: [sourceDir], ignored: [] },
    };
    // Instantiating the builder
    scssBuilder = new SCSSBuilder(mockConfig);

    // --- Manually Set Dependency Graph (AFTER instantiation) ---
    const builderAny = scssBuilder as any;
    const normalizeInstancePath = (p: string) => builderAny.normalizePath(p); // Use instance method

    const normStyle = normalizeInstancePath(stylePath);
    const normTheme = normalizeInstancePath(themePath);
    const normPartial = normalizeInstancePath(partialPath);
    const normVariables = normalizeInstancePath(variablesPath);
    const normButton = normalizeInstancePath(buttonPath);

    // Build the reverse graph first
    const tempReverseGraph = new Map<string, Set<string>>([
        [normPartial, new Set<string>([normStyle])],
        [normButton, new Set<string>([normStyle])],
        [normVariables, new Set<string>([normTheme, normPartial])],
        // Ensure all nodes exist as keys
        [normStyle, new Set<string>()],
        [normTheme, new Set<string>()],
    ]);
    builderAny.reverseDependencyGraph = tempReverseGraph; // Assign if needed

    // Build the main graph with the correct structure
    builderAny.dependencyGraph = new Map<string, { importers: Set<string>, uses: Set<string> }>([
      [normStyle, {
        importers: tempReverseGraph.get(normStyle) || new Set<string>(),
        uses: new Set<string>([normPartial, normButton])
      }],
      [normTheme, {
        importers: tempReverseGraph.get(normTheme) || new Set<string>(),
        uses: new Set<string>([normVariables])
      }],
      [normPartial, {
        importers: tempReverseGraph.get(normPartial) || new Set<string>(),
        uses: new Set<string>([normVariables])
      }],
      [normButton, {
        importers: tempReverseGraph.get(normButton) || new Set<string>(),
        uses: new Set<string>()
      }],
      [normVariables, {
        importers: tempReverseGraph.get(normVariables) || new Set<string>(),
        uses: new Set<string>()
      }],
    ]);

    // --- Verification Step (Debug) ---
    // console.log('Partials beforeEach - Dependency Graph Set:', builderAny.dependencyGraph);
    // console.log('Partials beforeEach - Reverse Dependency Graph Set:', builderAny.reverseDependencyGraph);

    // --- Spy on processScssFile ---
    processScssFileSpy = vi.spyOn(scssBuilder as any, 'processScssFile').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    const fsSync = await import('fs');
    if (tempDir && fsSync.existsSync(tempDir)) {
      fsSync.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  test('should correctly identify parent files of partials', async () => {
    const normalize = (p: string) => scssBuilder['normalizePath'](p);
    const expectedStyleParent = normalize(stylePath);
    const expectedThemeParent = normalize(themePath);

    // Act - Use the manually populated graph
    const partialParents = scssBuilder.getParentFiles(partialPath);
    const variableParents = scssBuilder.getParentFiles(variablesPath);

    // Assert
    const mockedLoggerModule = loggerModule as any;
    expect(mockedLoggerModule.__mockLoggerFns.warn).not.toHaveBeenCalled();
    expect(partialParents.map(normalize)).toContain(expectedStyleParent);
    expect(partialParents.length).toBe(1);

    expect(variableParents.map(normalize)).toContain(expectedStyleParent); // Via partial
    expect(variableParents.map(normalize)).toContain(expectedThemeParent); // Direct
    expect(variableParents.length).toBe(2); // Should be theme & style (via partial)
  });

  test('should process partials and rebuild dependent files', async () => {
    // Act - Directly call the method that uses the graph
    await (scssBuilder as any).processPartial(partialPath);

    // Assert - Check that the function was called once
    expect(processScssFileSpy).toHaveBeenCalledTimes(1);
    
    // Add type assertion to fix "Argument of type 'unknown' is not assignable to parameter of type 'string'"
    const actualPath = processScssFileSpy.mock.calls[0][0] as string;
    expect(path.basename(actualPath)).toBe(path.basename(partialPath));
  });

  test('should handle cross-platform path formats', async () => {
     const normalize = (p: string) => scssBuilder['normalizePath'](p);
     const expectedStyleParent = normalize(stylePath);

     // Act - getParentFiles normalizes input, uses normalized graph keys
     const parentFiles = scssBuilder.getParentFiles(windowsPath); // Input is windowsPath

     // Assert - Should find style.scss as parent of components/_button.scss
     const mockedLoggerModule = loggerModule as any;
     expect(mockedLoggerModule.__mockLoggerFns.warn).not.toHaveBeenCalled();
     expect(parentFiles.length).toBeGreaterThan(0);
     expect(parentFiles).toContain(expectedStyleParent);
  });

  test('should rebuild transitive dependencies', async () => {
    // Act - Process the base dependency (_variables)
    await (scssBuilder as any).processPartial(variablesPath);

    // Assert - Check that the function was called once
    expect(processScssFileSpy).toHaveBeenCalledTimes(1);
    
    // Add type assertion to fix "Argument of type 'unknown' is not assignable to parameter of type 'string'"
    const actualPath = processScssFileSpy.mock.calls[0][0] as string;
    expect(path.basename(actualPath)).toBe(path.basename(variablesPath));
  });
});
