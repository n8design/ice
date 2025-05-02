import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWatcher } from '../../src/watcher/index.js';

// Simple test that focuses on the outcome rather than implementation details
describe('FileWatcher', () => {
  // Create all the mocks we'll need
  const mockBuilder = {
    buildFile: vi.fn().mockResolvedValue({ outputFiles: ['dist/output.js'] }),
    buildAll: vi.fn().mockResolvedValue(undefined)
  };

  const mockBuildManager = {
    getBuilderForFile: vi.fn().mockReturnValue(mockBuilder),
    buildAll: vi.fn().mockResolvedValue(undefined)
  };

  const mockHotReloadManager = {
    sendReloadEvent: vi.fn()
  };

  // Standard config with 100ms debounce time
  const standardConfig = {
    input: { ts: ['src/**/*.ts'], scss: [], html: [] },
    output: { path: 'dist' },
    watch: { paths: ['src'], ignored: [] },
    hotreload: { port: 3000, debounceTime: 100 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 1: Basic debouncing behavior
  it('should skip intermediate file changes', async () => {
    vi.useFakeTimers();
    
    const watcher = new FileWatcher(
      standardConfig, 
      mockBuildManager as any, 
      mockHotReloadManager as any
    );

    // Calling handleChange directly
    (watcher as any).handleChange('src/file1.ts');
    (watcher as any).handleChange('src/file2.ts');
    (watcher as any).handleChange('src/file3.ts');
    
    // Before debounce timeout, nothing should be built
    expect(mockBuilder.buildFile).not.toHaveBeenCalled();
    
    // Wait for all promises and timers to resolve
    await vi.runAllTimersAsync();
    
    // Should only build the last file
    expect(mockBuilder.buildFile).toHaveBeenCalledTimes(1);
    expect(mockBuilder.buildFile).toHaveBeenCalledWith('src/file3.ts');
  });

  // Test 2: Changes separated by enough time trigger individual builds
  it('should process changes outside the debounce window individually', async () => {
    vi.useFakeTimers();
    
    const watcher = new FileWatcher(
      standardConfig, 
      mockBuildManager as any, 
      mockHotReloadManager as any
    );

    // First file change
    (watcher as any).handleChange('src/file1.ts');
    
    // Wait for all timers to complete
    await vi.runAllTimersAsync();
    
    // Second file change
    (watcher as any).handleChange('src/file2.ts');
    
    // Wait for timers again
    await vi.runAllTimersAsync();
    
    // Should have processed both files separately
    expect(mockBuilder.buildFile).toHaveBeenCalledTimes(2);
    expect(mockBuilder.buildFile).toHaveBeenNthCalledWith(1, 'src/file1.ts');
    expect(mockBuilder.buildFile).toHaveBeenNthCalledWith(2, 'src/file2.ts');
  });

  // Test 3: Verify longer debounce times
  it('should respect custom debounce times', async () => {
    // Reset mocks before this specific test
    mockBuilder.buildFile.mockClear();
    
    vi.useFakeTimers();
    
    // Create config with longer debounce time (300ms)
    const longConfig = {
      ...standardConfig,
      hotreload: { port: 3000, debounceTime: 300 }
    };
    
    const watcher = new FileWatcher(
      longConfig, 
      mockBuildManager as any, 
      mockHotReloadManager as any
    );

    // Trigger a file change
    (watcher as any).handleChange('src/file1.ts');
    
    // Advance past 100ms (standard debounce) but before 300ms (extended debounce)
    vi.advanceTimersByTime(150);
    
    // At this point, nothing should be built yet because of the longer debounce
    expect(mockBuilder.buildFile).not.toHaveBeenCalled();
    
    // Advance past the extended debounce time
    await vi.runAllTimersAsync();
    
    // Now it should have been processed
    expect(mockBuilder.buildFile).toHaveBeenCalledTimes(1);
    expect(mockBuilder.buildFile).toHaveBeenCalledWith('src/file1.ts');
  });
});
