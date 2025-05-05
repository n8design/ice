import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileWatcher } from '../../src/watcher/index.js';
import { Builder } from '../../src/builders/index.js';
import { IceConfig } from '../../src/types.js';
import * as path from 'path';
import * as os from 'os';

// Create hoisted mocks
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  debug: vi.fn()
}));

const mockWatcher = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined)
}));

const mockWatch = vi.hoisted(() => vi.fn().mockReturnValue(mockWatcher));

const mockSpecificBuilder = vi.hoisted(() => ({
  processChange: vi.fn().mockResolvedValue(undefined)
}));

const mockBuilder = vi.hoisted(() => ({
  buildAll: vi.fn(),
  getBuilderForFile: vi.fn().mockReturnValue(mockSpecificBuilder),
  config: {},
  outputPath: '/path/to/output',
  tsBuilder: { build: vi.fn() },
  scssBuilder: { build: vi.fn() },
  htmlBuilder: { build: vi.fn() },
  assetsBuilder: { copy: vi.fn() },
  processChange: vi.fn(),
  build: vi.fn(),
  clean: vi.fn(),
  addBuilders: vi.fn(),
  getBuilder: vi.fn(),
  initialize: vi.fn()
}));

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => mockLogger)
}));

vi.mock('chokidar', () => ({
  watch: mockWatch
}));

describe('FileWatcher Edge Cases', () => {
  let fileWatcher;
  let mockConfig;
  let savedHandleChange;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset singleton
    FileWatcher.resetInstance();
    
    mockConfig = {
      input: {
        ts: ['src/**/*.ts'],
        scss: ['src/**/*.scss'],
        html: ['src/**/*.html']
      },
      output: { path: '/path/to/public' },
      watch: {
        paths: ['/path/to/source'],
        ignored: ['**/node_modules/**']
      },
      hotreload: {
        enabled: true,
        debounceTime: 50
      }
    };
    
    mockBuilder.getBuilderForFile.mockImplementation(() => mockSpecificBuilder);
    
    fileWatcher = FileWatcher.getInstance(
      mockConfig, 
      mockBuilder as unknown as Builder,
      null
    );
    
    savedHandleChange = fileWatcher.handleChange;
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    FileWatcher.resetInstance();
  });

  it('should handle rapid sequential changes within debounce time', async () => {
    await fileWatcher.start();
    
    // Simulate multiple rapid changes to the same file
    await savedHandleChange.call(fileWatcher, 'test.ts');
    await savedHandleChange.call(fileWatcher, 'test.ts');
    await savedHandleChange.call(fileWatcher, 'test.ts');
    
    // Advance timer by less than debounce time
    vi.advanceTimersByTime(10); 
    
    // Should not process yet due to debounce
    expect(mockSpecificBuilder.processChange).not.toHaveBeenCalled();
    
    // Complete the debounce wait
    vi.advanceTimersByTime(mockConfig.hotreload.debounceTime + 10);
    
    // Should process only once despite multiple changes
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledTimes(1);
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledWith('test.ts');
  });

  it('should handle multiple files changing simultaneously', async () => {
    await fileWatcher.start();
    
    // Simulate changes to multiple different files within debounce window
    await savedHandleChange.call(fileWatcher, 'file1.ts');
    await savedHandleChange.call(fileWatcher, 'file2.scss');
    await savedHandleChange.call(fileWatcher, 'file3.html');
    
    // Advance past debounce time
    vi.advanceTimersByTime(mockConfig.hotreload.debounceTime + 10);
    
    // Each file should be processed
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledTimes(3);
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledWith('file1.ts');
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledWith('file2.scss');
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledWith('file3.html');
  });

  it('should normalize Windows-style paths on any platform', async () => {
    await fileWatcher.start();
    
    // Simulate change with Windows-style path
    const windowsPath = 'C:\\path\\to\\source\\file.ts';
    await savedHandleChange.call(fileWatcher, windowsPath);
    
    // Advance past debounce time
    vi.advanceTimersByTime(mockConfig.hotreload.debounceTime + 10);
    
    // The path should be normalized before being passed to builder
    const normalizedPath = path.normalize(windowsPath);
    expect(mockBuilder.getBuilderForFile).toHaveBeenCalledWith(normalizedPath);
  });

  it('should handle paths with special characters', async () => {
    await fileWatcher.start();
    
    // Test with spaces, international characters, and symbols
    const specialCharsPath = '/path/to/source/file with spaces & symbols 你好.ts';
    await savedHandleChange.call(fileWatcher, specialCharsPath);
    
    // Advance past debounce time
    vi.advanceTimersByTime(mockConfig.hotreload.debounceTime + 10);
    
    // The path should be processed correctly
    expect(mockBuilder.getBuilderForFile).toHaveBeenCalledWith(specialCharsPath);
    expect(mockSpecificBuilder.processChange).toHaveBeenCalledWith(specialCharsPath);
  });

  it('should handle inaccessible files gracefully', async () => {
    // Mock getBuilderForFile to throw an EACCES error for a specific file
    mockBuilder.getBuilderForFile.mockImplementation((filePath) => {
      if (filePath === 'restricted.ts') {
        throw new Error('EACCES: permission denied');
      }
      return mockSpecificBuilder;
    });
    
    await fileWatcher.start();
    
    // Simulate change to an inaccessible file
    await savedHandleChange.call(fileWatcher, 'restricted.ts');
    
    // Advance past debounce time
    vi.advanceTimersByTime(mockConfig.hotreload.debounceTime + 10);
    
    // Should log the error but not crash
    expect(mockLogger.error).toHaveBeenCalled();
    const errorMessage = mockLogger.error.mock.calls[0][0];
    expect(typeof errorMessage).toBe('string');
    expect(errorMessage).toContain('Error processing');
    expect(errorMessage).toContain('permission denied');
  });
});
