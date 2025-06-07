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

describe('OutputWatcher HTML Disabled Tests', () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should exclude HBS files when html.disabled is true', () => {
    // Create config with html.disabled = true
    const mockConfig = {
      html: {
        disabled: true
      },
      hotreload: {
        excludeExtensions: ['.map', '.d.ts'], // Note: NOT including .hbs here
        batchDelay: 0 // Disable batching for tests
      }
    };
    
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, mockConfig);
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    expect(changeHandler).toBeDefined();
    
    // Test with HBS file
    const hbsFile = path.join(outputDir, 'template.hbs');
    changeHandler(hbsFile);
    
    // Should not notify clients due to html.disabled
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
    // Should log with debug that it's skipping the HTML file
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Skipping HTML file'));
  });

  it('should exclude HTML files based on watch.ignored patterns', () => {
    // Create config with watch.ignored patterns
    const mockConfig = {
      watch: {
        ignored: ['**/*.html', '**/*.hbs'] // Should match all HTML/HBS files
      },
      hotreload: {
        batchDelay: 0 // Disable batching for tests
      }
    };
    
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, mockConfig);
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    
    // Test with HTML file
    const htmlFile = path.join(outputDir, 'index.html');
    changeHandler(htmlFile);
    
    // Should not notify clients due to watch.ignored pattern
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
    // Should log with debug that it's skipping due to watch.ignored
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('watch.ignored pattern'));
  });

  it('should exclude HTML files from non-standard locations', () => {
    // Create config with watch.ignored patterns including full paths
    const mockConfig = {
      watch: {
        ignored: ['source/**/*.html', 'public/**/*.html']
      },
      hotreload: {
        batchDelay: 0 // Disable batching for tests
      }
    };
    
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, mockConfig);
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    
    // For this test we need to match just the extension
    const htmlFile = path.join(outputDir, 'subdirectory/index.html');
    changeHandler(htmlFile);
    
    // Our improved matchGlobPattern should match this based on extension extraction
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
  });

  it('should respect direct extension matching', () => {
    // Create config with just the extensions
    const mockConfig = {
      hotreload: {
        excludeExtensions: ['.html', '.htm', '.hbs'],
        batchDelay: 0 // Disable batching for tests
      }
    };
    
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, mockConfig);
    outputWatcher.start();
    
    const changeHandler = capturedHandlers['change'];
    
    // Test with HBS file
    const hbsFile = path.join(outputDir, 'deeply/nested/structure/template.hbs');
    changeHandler(hbsFile);
    
    // Should not notify clients due to direct extension match
    expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
    // Should log with debug message
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
