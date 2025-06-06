import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('OutputWatcher', () => {
  let outputWatcher;
  let outputDir;
  let mockHotReloadServer;
  let capturedHandlers = {};

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    outputDir = '/path/to/output';
    mockHotReloadServer = { notifyClients: vi.fn() };
    
    // Reset capturedHandlers
    capturedHandlers = {};
    
    // Set up mockWatcher.on to capture event handlers
    mockWatcher.on.mockImplementation((event, handler) => {
      capturedHandlers[event] = handler;
      return mockWatcher;
    });
    
    // Create OutputWatcher instance with batchDelay: 0 for immediate processing in tests
    const testConfig = { hotreload: { batchDelay: 0 } };
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, testConfig);
  });

  it('should start watching the output directory', () => {
    outputWatcher.start();
    
    // Check that chokidar.watch was called correctly
    expect(mockWatch).toHaveBeenCalledWith(
      outputDir,
      expect.objectContaining({
        ignored: expect.arrayContaining(['**/.*']),
        persistent: true,
        ignoreInitial: true
      })
    );
    
    // Check event handlers were set up
    expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
    expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
    
    // Check success message
    expect(mockLogger.success).toHaveBeenCalledWith('Output directory watcher started');
  });

  it('should stop the watcher', () => {
    outputWatcher.start();
    outputWatcher.stop();
    
    expect(mockWatcher.close).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Output directory watcher stopped');
  });

  it('should notify clients for CSS changes', () => {
    outputWatcher.start();
    
    // Get the captured change handler
    const changeHandler = capturedHandlers['change'];
    expect(changeHandler).toBeDefined();
    
    // Call handler with CSS file
    const cssFile = path.join(outputDir, 'styles/main.css');
    changeHandler(cssFile);
    
    // Check client notification
    expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('css', cssFile);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('CSS change'));
  });

  it('should notify clients for JS changes', () => {
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    expect(changeHandler).toBeDefined();
    
    const jsFile = path.join(outputDir, 'scripts/main.js');
    changeHandler(jsFile);
    
    expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('full', jsFile);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('JS change'));
  });

  it('should ignore partial and dot files', () => {
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    expect(changeHandler).toBeDefined();
    
    const partialFile = path.join(outputDir, '_partial.css');
    const dotFile = path.join(outputDir, '.hidden.js');
    
    changeHandler(partialFile);
    changeHandler(dotFile);
    
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
  });
});
