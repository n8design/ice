import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HotReloadServer } from '../src/server/index.js';
import { WebSocket } from 'ws';

// IMPORTANT: vi.mock calls are hoisted to the top of the file,
// so they run before any variable declarations.
// We need to use literal values in the mock factory function.
vi.mock('ws', () => {
  return {
    WebSocketServer: vi.fn().mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'connection') {
          mockConnectionCallback = callback;
        }
      })
    })),
    WebSocket: {
      // Use literal values instead of variables
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    }
  };
});

// Mock HTTP server
vi.mock('http', () => ({
  createServer: vi.fn().mockReturnValue({
    listen: vi.fn()
  })
}));

// Define WebSocket readyState constants - can be defined after the mocks
// since we're not using them in the mock factory
const WS_OPEN = 1;
const WS_CONNECTING = 0;

// Create a simple mock interface
interface MockWebSocket {
  on: (event: string, handler: Function) => any;
  send: any;
  readyState: 0 | 1 | 2 | 3;
  close?: () => void;
  _triggerClose: () => void;
  _triggerError: (error: Error) => void;
}

// Global variables for tests
let hotReloadServer: HotReloadServer;
let mockConnectionCallback: (ws: WebSocket) => void;
let consoleSpy: any;

// Helper to create a consistent mock WebSocket
function createMockWebSocket(): MockWebSocket {
  const closeHandlers: Function[] = [];
  const errorHandlers: Function[] = [];
  
  const mockWs: MockWebSocket = {
    on: vi.fn((event, handler) => {
      if (event === 'close') closeHandlers.push(handler);
      if (event === 'error') errorHandlers.push(handler);
      return mockWs; // Return self to support chaining
    }),
    close: vi.fn(),
    send: vi.fn(),
    readyState: WS_OPEN,
    
    _triggerClose: () => {
      closeHandlers.forEach(handler => handler());
    },
    _triggerError: (error: Error) => {
      errorHandlers.forEach(handler => handler(error));
    }
  };
  
  return mockWs;
}

describe('HotReloadServer', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Spy on console methods
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create new server instance for each test
    hotReloadServer = new HotReloadServer(3001);
  });
  
  afterEach(() => {
    consoleSpy.mockRestore();
  });
  
  describe('Constructor', () => {
    it('should initialize with default port and output directory', () => {
      expect(hotReloadServer['baseOutputDir']).toBe('public');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('HMR running on port 3001'));
    });
    
    it('should initialize with custom output directory', () => {
      const customServer = new HotReloadServer(3001, { outputDir: 'dist' });
      expect(customServer['baseOutputDir']).toBe('dist');
    });
    
    it('should normalize output directory path', () => {
      const customServer = new HotReloadServer(3001, { outputDir: 'dist\\folder/' });
      expect(customServer['baseOutputDir']).toBe('dist/folder');
    });
  });
  
  describe('Client management', () => {
    it('should add client on connection', () => {
      // Use our factory to create a mock
      const mockWs = createMockWebSocket();
      
      // Simulate connection
      mockConnectionCallback(mockWs as unknown as WebSocket);
      
      expect(hotReloadServer['clients'].size).toBe(1);
      expect(hotReloadServer['clients'].has(mockWs as unknown as WebSocket)).toBe(true);
    });
    
    it('should remove client on close', () => {
      const mockWs = createMockWebSocket();
      
      // Simulate connection
      mockConnectionCallback(mockWs as unknown as WebSocket);
      
      // Simulate close using our helper method
      mockWs._triggerClose();
      
      expect(hotReloadServer['clients'].size).toBe(0);
    });
    
    it('should handle client error', () => {
      const mockWs = createMockWebSocket();
      
      // Simulate connection
      mockConnectionCallback(mockWs as unknown as WebSocket);
      
      // Simulate error using our helper method
      mockWs._triggerError(new Error('Test error'));
      
      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe('Path normalization', () => {
    it('should convert backslashes to forward slashes', () => {
      const sendSpy = vi.fn();
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'public\\styles\\main.css');
      
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('styles/main.css'));
      expect(sendSpy).not.toHaveBeenCalledWith(expect.stringContaining('\\'));
    });
    
    it('should remove output directory prefix', () => {
      const sendSpy = vi.fn();
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'public/styles/main.css');
      
      const message = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
    });
    
    it('should handle custom output directory prefix', () => {
      const customServer = new HotReloadServer(3001, { outputDir: 'dist' });
      const sendSpy = vi.fn();
      customServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      customServer.notifyClients('css', 'dist/styles/main.css');
      
      const message = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
    });
    
    it('should handle paths without output directory prefix', () => {
      const sendSpy = vi.fn();
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'styles/main.css');
      
      const message = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
    });
  });

  describe('Message broadcasting', () => {
    it('should send messages to all connected clients', () => {
      const sendSpy1 = vi.fn();
      const sendSpy2 = vi.fn();
      
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy1 
      } as unknown as WebSocket);
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy2 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'styles/main.css');
      
      expect(sendSpy1).toHaveBeenCalled();
      expect(sendSpy2).toHaveBeenCalled();
    });
    
    it('should not send to closed connections', () => {
      const sendSpy = vi.fn();
      
      hotReloadServer['clients'].add({ 
        readyState: WS_CONNECTING, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'styles/main.css');
      
      expect(sendSpy).not.toHaveBeenCalled();
    });
    
    it('should include correct message type and path', () => {
      const sendSpy = vi.fn();
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'styles/main.css');
      
      const message = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(message.type).toBe('css');
      expect(message.path).toBe('styles/main.css');
    });
  });
  
  describe('Output directory configuration', () => {
    it('should allow updating output directory', () => {
      hotReloadServer.setOutputDir('build');
      expect(hotReloadServer['baseOutputDir']).toBe('build');
      
      const sendSpy = vi.fn();
      hotReloadServer['clients'].add({ 
        readyState: WS_OPEN, 
        send: sendSpy 
      } as unknown as WebSocket);
      
      hotReloadServer.notifyClients('css', 'build/styles/main.css');
      
      const message = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(message.path).toBe('styles/main.css');
    });
    
    it('should normalize updated output directory path', () => {
      hotReloadServer.setOutputDir('build\\folder/');
      expect(hotReloadServer['baseOutputDir']).toBe('build/folder');
    });
  });
});
