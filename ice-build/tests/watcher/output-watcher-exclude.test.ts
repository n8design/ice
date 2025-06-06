import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { OutputWatcher } from '../../src/watcher/output-watcher.js';
import { Logger } from '../../src/utils/logger.js';

// Create hoisted mocks before all other code
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  debug: vi.fn()
}));

// Mock the watcher instance for chokidar
const mockWatcher = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined)
}));

// Create a hoisted mock watch function
const mockWatch = vi.hoisted(() => vi.fn().mockReturnValue(mockWatcher));

// Mock dependencies
vi.mock('chokidar', () => ({
  watch: mockWatch
}));

vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => mockLogger)
}));

vi.mock('@n8d/ice-hotreloader', () => ({
  HotReloadServer: vi.fn()
}));

describe('OutputWatcher Exclude Extensions', () => {
  let outputWatcher;
  let outputDir;
  let mockHotReloadServer;
  let capturedHandlers = {};
  let mockConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    outputDir = '/path/to/output';
    mockHotReloadServer = { notifyClients: vi.fn() };
    
    // Reset capturedHandlers
    capturedHandlers = {};
    
    // Create test config with excludeExtensions
    mockConfig = {
      hotreload: {
        excludeExtensions: ['.html', '.htm', '.hbs', '.map', '.d.ts'],
        batchDelay: 0 // Disable batching for tests to get immediate responses
      }
    };
    
    // Set up mockWatcher.on to capture event handlers
    mockWatcher.on.mockImplementation((event, handler) => {
      capturedHandlers[event] = handler;
      return mockWatcher;
    });
    
    // Create OutputWatcher instance with config
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, mockConfig);
    outputWatcher.start(); // Start the watcher in beforeEach so all tests have it running
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should exclude HTML files from triggering reloads', () => {
    const changeHandler = capturedHandlers['change'];
    expect(changeHandler).toBeDefined();
    
    // Test with HTML file
    const htmlFile = path.join(outputDir, 'index.html');
    changeHandler(htmlFile);
    
    // Should not notify clients for excluded extensions
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
    // Should log that it's excluding the file using debug level
    // Check for direct extension matching message
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(/Direct extension match: skipping \.html file:/)
    );
  });

  it('should exclude HBS files from triggering reloads', () => {
    const changeHandler = capturedHandlers['change'];
    
    // Test with HBS file
    const hbsFile = path.join(outputDir, 'template.hbs');
    changeHandler(hbsFile);
    
    // Should not notify clients for excluded extensions
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
  });

  it('should exclude files with mixed case extensions', () => {
    const changeHandler = capturedHandlers['change'];
    
    // Test with mixed case extensions
    const mixedCaseFile = path.join(outputDir, 'index.HTML');
    changeHandler(mixedCaseFile);
    
    // Should not notify clients for excluded extensions, even with different case
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
  });

  it('should handle CSS files correctly (not excluded)', () => {
    const changeHandler = capturedHandlers['change'];
    
    // Test with CSS file (not excluded)
    const cssFile = path.join(outputDir, 'styles.css');
    changeHandler(cssFile);
    
    // Should notify clients for CSS updates
    expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('css', cssFile);
  });

  it('should handle JS files correctly (not excluded)', () => {
    const changeHandler = capturedHandlers['change'];
    
    // Test with JS file (not excluded)
    const jsFile = path.join(outputDir, 'script.js');
    changeHandler(jsFile);
    
    // Should notify clients for JS updates
    expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('full', jsFile);
  });

  it('should handle empty or invalid excludeExtensions gracefully', () => {
    // Create config with empty excludeExtensions
    const emptyConfig = {
      hotreload: {
        excludeExtensions: [],
        batchDelay: 0 // Disable batching for tests
      }
    };
    
    // Create OutputWatcher with empty config
    const watcherWithEmptyConfig = new OutputWatcher(outputDir, mockHotReloadServer, emptyConfig);
    watcherWithEmptyConfig.start();
    
    const changeHandler = capturedHandlers['change'];
    
    // Test with HTML file which would normally be excluded
    const htmlFile = path.join(outputDir, 'index.html');
    changeHandler(htmlFile);
    
    // HTML files are now ALWAYS blocked regardless of configuration
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
    // Should log that HTML files are completely disabled
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(/ABSOLUTE BLOCK: HTML files are completely disabled/)
    );
  });

  it('should handle missing config gracefully', () => {
    // Create OutputWatcher with no config
    const watcherWithNoConfig = new OutputWatcher(outputDir, mockHotReloadServer);
    watcherWithNoConfig.start();
    
    const changeHandler = capturedHandlers['change'];
    
    // Test with HTML file
    const htmlFile = path.join(outputDir, 'index.html');
    changeHandler(htmlFile);
    
    // HTML files are now ALWAYS blocked regardless of configuration
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
    // Should log that HTML files are completely disabled
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(/ABSOLUTE BLOCK: HTML files are completely disabled/)
    );
  });
});
