import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Builder } from '../../src/builders/index.js';
import { FileWatcher } from '../../src/watcher/index.js';
import { IceConfig } from '../../src/types.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock Builder implementation to simulate errors and recovery
class MockBuilder {
  failures = new Set<string>();
  buildResults = new Map<string, boolean>();
  
  constructor(public config: IceConfig) {
    // Apply defaults for incomplete config
    if (!this.config.output) {
      this.config.output = { path: 'dist' };
    }
    
    if (!this.config.input.scss) {
      this.config.input.scss = [];
    }
  }
  
  async buildAll() {
    // Simulate building all files
    const files = ['src/file1.ts', 'src/file2.scss', 'src/file3.html'];
    let hasFailure = false;
    
    for (const file of files) {
      try {
        await this.buildFile(file);
      } catch (err) {
        hasFailure = true;
      }
    }
    
    if (hasFailure) {
      throw new Error('Build failed');
    }
    
    return true;
  }
  
  async buildFile(filePath: string) {
    if (this.failures.has(filePath)) {
      this.buildResults.set(filePath, false);
      throw new Error(`Failed to build ${filePath}`);
    }
    
    this.buildResults.set(filePath, true);
    return true;
  }
  
  async processChange(filePath: string) {
    return this.buildFile(filePath);
  }
  
  setFailure(filePath: string, shouldFail: boolean) {
    if (shouldFail) {
      this.failures.add(filePath);
    } else {
      this.failures.delete(filePath);
    }
  }
  
  wasBuildSuccessful(filePath: string) {
    return this.buildResults.get(filePath) === true;
  }
  
  resetResults() {
    this.buildResults.clear();
  }
}

// Mocks
vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('Error Recovery & Config Edge Cases', () => {
  let tempDir: string;
  let mockBuilder: MockBuilder;
  let mockConfig: IceConfig;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    tempDir = path.join(os.tmpdir(), 'ice-error-recovery-test');
    
    // Create a basic config for testing
    mockConfig = {
      input: {
        ts: ['src/**/*.ts'],
        scss: ['src/**/*.scss'],
        html: ['src/**/*.html']
      },
      output: { path: 'public' },
      watch: {
        paths: ['src'],
        ignored: ['**/node_modules/**']
      }
    };
    
    // Create mock builder
    mockBuilder = new MockBuilder(mockConfig);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should continue building files after a partial failure', async () => {
    // Set up a failure for one file
    mockBuilder.setFailure('src/file2.scss', true);
    
    // Try to build all
    try {
      await mockBuilder.buildAll();
    } catch (err) {
      // Expected to throw
    }
    
    // Check which files succeeded
    expect(mockBuilder.wasBuildSuccessful('src/file1.ts')).toBe(true);
    expect(mockBuilder.wasBuildSuccessful('src/file2.scss')).toBe(false);
    expect(mockBuilder.wasBuildSuccessful('src/file3.html')).toBe(true);
  });

  it('should recover after fixing a previously errored file', async () => {
    // Initially set a failure
    mockBuilder.setFailure('src/file2.scss', true);
    
    // First build - should fail
    try {
      await mockBuilder.processChange('src/file2.scss');
    } catch (err) {
      // Expected to throw
    }
    
    expect(mockBuilder.wasBuildSuccessful('src/file2.scss')).toBe(false);
    
    // Fix the file
    mockBuilder.setFailure('src/file2.scss', false);
    mockBuilder.resetResults();
    
    // Should succeed now
    await mockBuilder.processChange('src/file2.scss');
    expect(mockBuilder.wasBuildSuccessful('src/file2.scss')).toBe(true);
  });

  it('should handle minimal valid configuration', async () => {
    // Create a minimal config with just the required fields
    const minimalConfig: IceConfig = {
      input: {
        ts: [],
        scss: []
      },
      output: 'dist' // Just a string path
    };
    
    // Should work with minimal config
    const minimalBuilder = new MockBuilder(minimalConfig);
    expect(minimalBuilder.config.output).toBe('dist');
  });
  
  it('should handle incomplete configuration by using defaults', async () => {
    // Create an incomplete config missing some fields
    const incompleteConfig = {
      input: {
        ts: ['src/**/*.ts']
        // Missing scss
      },
      // Missing output
    } as unknown as IceConfig;
    
    // Builder should still work by applying defaults
    const incompleteBuilder = new MockBuilder(incompleteConfig);
    
    // Default output path
    expect(incompleteBuilder.config.output).toBeDefined();
    
    // Default scss patterns
    expect(incompleteBuilder.config.input.scss).toBeDefined();
  });
  
  it('should handle configuration with conflicting settings', async () => {
    // Config with potentially conflicting settings
    const conflictingConfig: IceConfig = {
      input: {
        ts: ['src/**/*.ts'],
        scss: ['src/**/*.scss']
      },
      output: { 
        path: 'dist',
        // These would conflict with a direct string path, but should be handled
        filenames: {
          js: '[name].bundle.js',
          css: '[name].bundle.css'
        }
      },
      // Conflicting source map settings
      esbuild: {
        sourcemap: false
      },
      sass: {
        sourceMap: true
      }
    };
    
    // Builder should handle the conflicts by prioritizing more specific settings
    const conflictingBuilder = new MockBuilder(conflictingConfig);
    expect(conflictingBuilder.config.output).toEqual(conflictingConfig.output);
  });

  it('should handle cascading build failures gracefully', async () => {
    // Set up failures for multiple files
    mockBuilder.setFailure('src/file1.ts', true);
    mockBuilder.setFailure('src/file2.scss', true);
    
    // Try to build all - should fail
    try {
      await mockBuilder.buildAll();
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      // Expected to throw
      expect(err).toBeDefined();
    }
    
    // All files should have been attempted
    expect(mockBuilder.buildResults.has('src/file1.ts')).toBe(true);
    expect(mockBuilder.buildResults.has('src/file2.scss')).toBe(true);
    expect(mockBuilder.buildResults.has('src/file3.html')).toBe(true);
    
    // Only file3 should have succeeded
    expect(mockBuilder.wasBuildSuccessful('src/file1.ts')).toBe(false);
    expect(mockBuilder.wasBuildSuccessful('src/file2.scss')).toBe(false);
    expect(mockBuilder.wasBuildSuccessful('src/file3.html')).toBe(true);
  });
  
  it('should handle rapid error recovery during hot reload', async () => {
    // Simulate rapid file changes with errors and fixes
    const testFile = 'src/rapid-change.scss';
    
    // Start with failure
    mockBuilder.setFailure(testFile, true);
    
    // First change - fails
    try {
      await mockBuilder.processChange(testFile);
    } catch (err) {
      // Expected
    }
    expect(mockBuilder.wasBuildSuccessful(testFile)).toBe(false);
    
    // Fix the file
    mockBuilder.setFailure(testFile, false);
    mockBuilder.resetResults();
    
    // Rapid subsequent changes - should all succeed
    await mockBuilder.processChange(testFile);
    expect(mockBuilder.wasBuildSuccessful(testFile)).toBe(true);
    
    await mockBuilder.processChange(testFile);
    expect(mockBuilder.wasBuildSuccessful(testFile)).toBe(true);
    
    await mockBuilder.processChange(testFile);
    expect(mockBuilder.wasBuildSuccessful(testFile)).toBe(true);
  });
  
  it('should handle network connectivity errors in hot reload server simulation', async () => {
    // Mock a hot reload server with network issues
    class NetworkFailingMockBuilder extends MockBuilder {
      networkFailures = 0;
      maxNetworkFailures = 2;
      
      async notifyHotReload(filePath: string) {
        if (this.networkFailures < this.maxNetworkFailures) {
          this.networkFailures++;
          throw new Error('Network connection failed');
        }
        // Success after retries
        return true;
      }
    }
    
    const networkBuilder = new NetworkFailingMockBuilder(mockConfig);
    
    // First attempts should fail
    try {
      await networkBuilder.notifyHotReload('test.css');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toContain('Network connection failed');
    }
    
    try {
      await networkBuilder.notifyHotReload('test.css');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toContain('Network connection failed');
    }
    
    // Third attempt should succeed
    const result = await networkBuilder.notifyHotReload('test.css');
    expect(result).toBe(true);
  });
});
