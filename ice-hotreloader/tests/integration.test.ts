import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { HotReloadServer } from '../src/server/index.js';
import { BrowserHMR } from '../src/browser/index.js';
import * as path from 'path';
import * as fs from 'fs';
import { tmpdir } from 'os';
import { WebSocket } from 'ws';
import { WS_OPEN } from './utils/test-helpers.js';

// Integration test with real paths and configurations
describe('Ice HotReloader Integration', () => {
  let server: HotReloadServer;
  let tempDir: string;
  
  // Create temp directory for tests
  beforeAll(() => {
    vi.useFakeTimers();
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'ice-hotreloader-test-'));
    
    // Create test directories
    fs.mkdirSync(path.join(tempDir, 'public', 'styles'), { recursive: true });
    
    // Start server with custom output dir
    server = new HotReloadServer({ 
      port: 3099, 
      outputDir: path.join(tempDir, 'public')
    });
  });
  
  afterAll(() => {
    vi.useRealTimers();
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Cross-platform path handling', () => {
    it('should handle Unix-style paths correctly', () => {
      const unixPath = `${path.join(tempDir, 'public')}/styles/main.css`.replace(/\\/g, '/');
      const clientSpy = vi.fn();
      
      // Add mock client to server
      server['clients'].add({ 
        readyState: WS_OPEN,
        send: clientSpy
      } as unknown as WebSocket);
      
      // Notify client with Unix path
      server.notifyClients('css', unixPath);
      
      // Check message sent to client
      const message = JSON.parse(clientSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
    });
    
    it('should handle Windows-style paths correctly', () => {
      const windowsPath = `${path.join(tempDir, 'public')}\\styles\\main.css`;
      const clientSpy = vi.fn();
      
      // Add mock client to server
      server['clients'].add({ 
        readyState: WS_OPEN,
        send: clientSpy
      } as unknown as WebSocket);
      
      // Notify client with Windows path
      server.notifyClients('css', windowsPath);
      
      // Check message sent to client
      const message = JSON.parse(clientSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
    });
    
    it('should handle mixed path styles', () => {
      const mixedPath = `${path.join(tempDir, 'public')}/styles\\components/button.css`;
      const clientSpy = vi.fn();
      
      // Add mock client to server
      server['clients'].add({ 
        readyState: WS_OPEN,
        send: clientSpy
      } as unknown as WebSocket);
      
      // Notify client with mixed path
      server.notifyClients('css', mixedPath);
      
      // Check message sent to client
      const message = JSON.parse(clientSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/components/button.css');
    });
  });
  
  describe('Output directory handling', () => {
    it('should handle different output directory configurations', () => {
      // Change output directory
      server.setOutputDir('custom-output');
      
      const clientSpy = vi.fn();
      
      // Add mock client to server
      server['clients'].add({ 
        readyState: WS_OPEN,
        send: clientSpy
      } as unknown as WebSocket);
      
      // Notify with new output directory path
      server.notifyClients('css', 'custom-output/styles/main.css');
      
      // Check message sent to client
      const message = JSON.parse(clientSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
      
      // Reset output directory
      server.setOutputDir(path.join(tempDir, 'public'));
    });
  });

  describe('Multiple file change scenarios', () => {
    it('should handle multiple file changes in succession', () => {
      const clientSpy = vi.fn();
      
      // Add mock client to server
      server['clients'].add({ 
        readyState: WS_OPEN,
        send: clientSpy
      } as unknown as WebSocket);
      
      // Notify multiple changes in quick succession
      server.notifyClients('css', `${tempDir}/public/styles/buttons.css`);
      server.notifyClients('css', `${tempDir}/public/styles/forms.css`);
      server.notifyClients('css', `${tempDir}/public/styles/layout.css`);
      
      // Check we got 3 separate messages
      expect(clientSpy).toHaveBeenCalledTimes(3);
      
      // Check each message has the correct path
      const messages = clientSpy.mock.calls.map(call => JSON.parse(call[0]));
      expect(messages[0].path).toBe('styles/buttons.css');
      expect(messages[1].path).toBe('styles/forms.css');
      expect(messages[2].path).toBe('styles/layout.css');
    });
  });
});
