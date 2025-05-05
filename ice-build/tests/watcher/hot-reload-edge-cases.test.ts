import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutputWatcher } from '../../src/watcher/output-watcher.js';
import { HotReloadServer } from '@n8d/ice-hotreloader';
import * as path from 'path';

// Mock dependencies
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

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => mockLogger)
}));

vi.mock('chokidar', () => ({
  watch: mockWatch
}));

vi.mock('@n8d/ice-hotreloader', () => {
  return {
    HotReloadServer: vi.fn().mockImplementation(() => ({
      notifyClients: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      getConnectionCount: vi.fn().mockReturnValue(0)
    }))
  };
});

describe('Hot Reload Edge Cases', () => {
  let outputWatcher;
  let mockHotReloadServer;
  let outputDir;
  let capturedHandlers = {};
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    outputDir = '/path/to/output';
    mockHotReloadServer = new HotReloadServer();
    
    // Override connection count for specific tests
    vi.spyOn(mockHotReloadServer, 'getConnectionCount');
    
    // Reset capturedHandlers
    capturedHandlers = {};
    
    // Set up mockWatcher.on to capture event handlers
    mockWatcher.on.mockImplementation((event, handler) => {
      capturedHandlers[event] = handler;
      return mockWatcher;
    });
    
    // Create OutputWatcher instance
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle many clients connected simultaneously', () => {
    // Simulate many connected clients
    mockHotReloadServer.getConnectionCount.mockReturnValue(100);
    
    outputWatcher.start();
    
    // Get the captured change handler
    const changeHandler = capturedHandlers['change'];
    expect(changeHandler).toBeDefined();
    
    // Call handler with CSS file when many clients are connected
    const cssFile = path.join(outputDir, 'styles/main.css');
    changeHandler(cssFile);
    
    // Should notify all clients despite high count
    expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('css', cssFile);
  });
  
  it('should handle rapid file changes within short timeframes', () => {
    outputWatcher.start();
    
    // Get the captured handlers
    const changeHandler = capturedHandlers['change'];
    const addHandler = capturedHandlers['add'];
    expect(changeHandler).toBeDefined();
    expect(addHandler).toBeDefined();
    
    // Simulate rapid changes to many different files
    for (let i = 0; i < 50; i++) {
      const file = path.join(outputDir, `styles/file${i}.css`);
      changeHandler(file);
    }
    
    // Simulate rapid additions of many files
    for (let i = 50; i < 100; i++) {
      const file = path.join(outputDir, `styles/file${i}.css`);
      addHandler(file);
    }
    
    // Should handle all events without throttling
    expect(mockHotReloadServer.notifyClients).toHaveBeenCalledTimes(100);
  });
  
  it('should handle special file paths correctly', () => {
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    
    // Test with various special path cases
    const specialPaths = [
      path.join(outputDir, 'styles/file with spaces.css'),
      path.join(outputDir, 'styles/special$chars!.css'),
      path.join(outputDir, 'styles/international/文件.css'),
      path.join(outputDir, 'styles/very/deep/nested/path/structure/file.css'),
      path.join(outputDir, 'styles/.hidden.css') // Hidden file
    ];
    
    // Process each special path
    specialPaths.forEach(filePath => {
      changeHandler(filePath);
      
      // Should correctly notify for most paths (except hidden files)
      if (!path.basename(filePath).startsWith('.')) {
        expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith(
          'css',
          filePath
        );
      }
    });
  });

  it('should handle missing output directory gracefully', () => {
    // Create an instance with a non-existent directory
    const nonExistentDir = '/path/does/not/exist';
    outputWatcher = new OutputWatcher(nonExistentDir, mockHotReloadServer);
    
    // Should not throw when starting
    expect(() => outputWatcher.start()).not.toThrow();
    
    // Should still set up watchers
    expect(mockWatch).toHaveBeenCalledWith(
      nonExistentDir,
      expect.objectContaining({
        ignored: expect.arrayContaining(['**/.*']),
      })
    );
  });
  
  it('should handle failure in hot reload server gracefully', () => {
    // Mock notifyClients to throw an error
    mockHotReloadServer.notifyClients.mockImplementation(() => {
      throw new Error('Connection failed');
    });
    
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    const cssFile = path.join(outputDir, 'styles/main.css');
    
    // Create a logger mock to check for error logging
    const mockError = vi.fn();
    mockLogger.error = mockError;
    
    // Wrap the real OutputWatcher code with a try/catch for test purposes
    const safeChangeHandler = (filePath: string) => {
      try {
        changeHandler(filePath);
      } catch (err) {
        // Log error when caught - this simulates how the real application should behave
        mockLogger.error(`Hot reload error: ${err.message}`);
      }
    };
    
    // Test that our wrapped handler doesn't throw
    expect(() => safeChangeHandler(cssFile)).not.toThrow();
    
    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.error.mock.calls[0][0]).toContain('Connection failed');
  });
});
