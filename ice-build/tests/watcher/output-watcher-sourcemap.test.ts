import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutputWatcher } from '../../src/watcher/output-watcher.js';
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

describe('OutputWatcher Source Map Exclusion', () => {
  let outputWatcher: OutputWatcher;
  let mockHotReloadServer: any;
  let outputDir: string;
  let capturedHandlers: Record<string, any> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    
    outputDir = '/path/to/output';
    mockHotReloadServer = {
      notifyClients: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    
    // Reset capturedHandlers
    capturedHandlers = {};
    
    // Set up mockWatcher.on to capture event handlers
    mockWatcher.on.mockImplementation((event: string, handler: any) => {
      capturedHandlers[event] = handler;
      return mockWatcher;
    });
    
    // Create OutputWatcher instance with batchDelay: 0 for immediate notification in tests
    outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, { hotreload: { batchDelay: 0 } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Source map file exclusion', () => {
    it('should exclude .map files from triggering hot reloads', () => {
      outputWatcher.start();
      
      const changeHandler = capturedHandlers['change'];
      expect(changeHandler).toBeDefined();
      
      // Test with various source map files
      const sourceMapFiles = [
        path.join(outputDir, 'styles.css.map'),
        path.join(outputDir, 'app.js.map'),
        path.join(outputDir, 'vendor.bundle.js.map'),
        path.join(outputDir, 'nested/path/component.css.map')
      ];
      
      sourceMapFiles.forEach(mapFile => {
        changeHandler(mapFile);
      });
      outputWatcher.flushBatchedChanges();
      
      // Should not notify clients for any source map files
      expect(mockHotReloadServer.notifyClients).not.toHaveBeenCalled();
      
      // Should log debug messages for skipping source map files
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/⏭️ Skipping source map file:/)
      );
    });

    it('should allow corresponding CSS and JS files to trigger hot reloads', () => {
      outputWatcher.start();
      
      const changeHandler = capturedHandlers['change'];
      expect(changeHandler).toBeDefined();
      
      // Test with corresponding non-map files
      const cssFile = path.join(outputDir, 'styles.css');
      const jsFile = path.join(outputDir, 'app.js');
      
      changeHandler(cssFile);
      changeHandler(jsFile);
      outputWatcher.flushBatchedChanges();
      
      // Should notify clients for CSS and JS files
      expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('css', cssFile);
      expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith('full', jsFile);
      expect(mockHotReloadServer.notifyClients).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed file types correctly', () => {
      outputWatcher.start();
      
      const changeHandler = capturedHandlers['change'];
      expect(changeHandler).toBeDefined();
      
      // Mix of files that should and shouldn't trigger reloads
      const testFiles = [
        { file: path.join(outputDir, 'styles.css'), shouldNotify: true, type: 'css' },
        { file: path.join(outputDir, 'styles.css.map'), shouldNotify: false },
        { file: path.join(outputDir, 'app.js'), shouldNotify: true, type: 'full' },
        { file: path.join(outputDir, 'app.js.map'), shouldNotify: false },
        { file: path.join(outputDir, 'component.ts'), shouldNotify: true, type: 'full' },
        { file: path.join(outputDir, 'bundle.map'), shouldNotify: false },
      ];
      
      testFiles.forEach(({ file }) => {
        changeHandler(file);
      });
      outputWatcher.flushBatchedChanges();
      
      // Only non-map files should trigger notifications
      const expectedNotifications = testFiles.filter(f => f.shouldNotify);
      expect(mockHotReloadServer.notifyClients).toHaveBeenCalledTimes(expectedNotifications.length);
      
      // Verify specific calls
      expectedNotifications.forEach(({ file, type }) => {
        expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith(type, file);
      });
    });

    it('should distinguish between .map extension and files containing "map"', () => {
      outputWatcher.start();
      
      const changeHandler = capturedHandlers['change'];
      expect(changeHandler).toBeDefined();
      
      // Files that contain "map" but aren't source maps
      const mapNamedFiles = [
        path.join(outputDir, 'maputils.js'), // contains "map" but not .map extension
        path.join(outputDir, 'mapping-tool.css'), // contains "map" but not .map extension
        path.join(outputDir, 'sitemap.xml'), // contains "map" but not .map extension
      ];
      
      // Real source map files
      const realMapFiles = [
        path.join(outputDir, 'actual.js.map'),
        path.join(outputDir, 'styles.css.map')
      ];
      
      // Process map-named files (should trigger notifications)
      mapNamedFiles.forEach(file => {
        changeHandler(file);
      });
      // Process real map files (should NOT trigger notifications)
      realMapFiles.forEach(file => {
        changeHandler(file);
      });
      outputWatcher.flushBatchedChanges();
      
      // Only map-named files should trigger notifications, not real .map files
      expect(mockHotReloadServer.notifyClients).toHaveBeenCalledTimes(mapNamedFiles.length);
      
      // Verify the right files triggered notifications
      mapNamedFiles.forEach(file => {
        const ext = path.extname(file);
        const expectedType = ext === '.css' ? 'css' : 'full';
        expect(mockHotReloadServer.notifyClients).toHaveBeenCalledWith(expectedType, file);
      });
    });
  });
});
