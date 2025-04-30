import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserHMR } from '../src/browser/index.js';

// Define constants for WebSocket states
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

// Create a simple mock interface
interface MockWebSocket {
  addEventListener: any;
  readyState: 0 | 1 | 2 | 3;
  _listeners: Record<string, Function[]>;
  _triggerEvent: (eventName: string, data: any) => void;
}

// Mock DOM elements and browser APIs
const setupMockDOM = () => {
  // Mock document
  global.document = {
    querySelectorAll: vi.fn().mockReturnValue([]),
    createElement: vi.fn(),
    head: { appendChild: vi.fn() },
    addEventListener: vi.fn()
  } as any;
  
  // Mock location
  global.location = {
    hostname: 'localhost',
    protocol: 'http:',
    reload: vi.fn()
  } as any;
  
  // Create a mockWebSocket instance with listeners
  const listeners: Record<string, Function[]> = {
    'open': [],
    'message': [],
    'close': [],
    'error': []
  };
  
  const mockWebSocketInstance: MockWebSocket = {
    addEventListener: vi.fn((event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    readyState: WS_OPEN as 1, // Explicitly type as 1 (OPEN) to satisfy the union type
    _listeners: listeners,
    _triggerEvent: (eventName, data) => {
      if (listeners[eventName]) {
        listeners[eventName].forEach(handler => handler(data));
      }
    }
  };
  
  // Create a properly typed WebSocket constructor mock
  const webSocketConstructorMock = vi.fn(() => mockWebSocketInstance) as any;
  
  // Add static properties after casting to any
  webSocketConstructorMock.CONNECTING = WS_CONNECTING;
  webSocketConstructorMock.OPEN = WS_OPEN;
  webSocketConstructorMock.CLOSING = WS_CLOSING;
  webSocketConstructorMock.CLOSED = WS_CLOSED;
  
  // Assign to global
  global.WebSocket = webSocketConstructorMock;
  
  // Mock window
  global.window = {
    addEventListener: vi.fn()
  } as any;
  
  // Mock console
  global.console = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  } as any;
  
  return {
    mockWebSocketInstance
  };
};

describe('BrowserHMR', () => {
  let browserHMR: BrowserHMR;
  let mockWebSocket: MockWebSocket;
  
  beforeEach(() => {
    const mocks = setupMockDOM();
    mockWebSocket = mocks.mockWebSocketInstance;
    
    // Create client instance
    browserHMR = new BrowserHMR();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('WebSocket connection', () => {
    it('should connect to WebSocket server on initialization', () => {
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3001');
    });
    
    it('should use correct port if specified', () => {
      browserHMR = new BrowserHMR(3002);
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3002');
    });
    
    it('should use wss protocol when using https', () => {
      global.location.protocol = 'https:';
      browserHMR = new BrowserHMR();
      expect(global.WebSocket).toHaveBeenCalledWith('wss://localhost:3001');
    });
    
    it('should register event listeners for WebSocket events', () => {
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Message handling', () => {
    it('should trigger full page reload on "full" message type', () => {
      // Use our triggerEvent helper
      mockWebSocket._triggerEvent('message', { 
        data: JSON.stringify({ type: 'full', path: 'index.js' }) 
      });
      
      expect(global.location.reload).toHaveBeenCalled();
    });
    
    it('should refresh CSS on "css" message type', () => {
      // Setup CSS mocks
      const mockLink = { href: 'http://localhost/styles/main.css' };
      global.document.querySelectorAll = vi.fn().mockReturnValue([mockLink]);
      
      // Mock refreshCSS method
      const refreshCSSSpy = vi.spyOn(browserHMR as any, 'refreshCSS');
      
      // Use our triggerEvent helper
      mockWebSocket._triggerEvent('message', { 
        data: JSON.stringify({ type: 'css', path: 'styles/main.css' }) 
      });
      
      expect(refreshCSSSpy).toHaveBeenCalledWith('styles/main.css');
    });
    
    it('should log error for invalid JSON', () => {
      // Test error handling when parsing invalid JSON
      mockWebSocket._triggerEvent('message', { data: 'invalid json' });
      
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('CSS refresh functionality', () => {
    it('should update stylesheet href with timestamp', () => {
      // Setup mock CSS link
      const mockLinks = [
        { href: 'http://localhost/styles/main.css' }
      ];
      global.document.querySelectorAll = vi.fn().mockReturnValue(mockLinks);
      
      // Mock Date.now for consistent testing
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(12345);
      
      // Access private method
      (browserHMR as any).refreshCSS('styles/main.css');
      
      // Check that href was updated with timestamp
      expect(mockLinks[0].href).toContain('t=12345');
      
      // Restore Date.now
      Date.now = originalNow;
    });
    
    it('should handle multiple stylesheets', () => {
      // Setup multiple mock CSS links
      const mockLinks = [
        { href: 'http://localhost/styles/main.css' },
        { href: 'http://localhost/styles/secondary.css' }
      ];
      global.document.querySelectorAll = vi.fn().mockReturnValue(mockLinks);
      
      // Fix URL mock with proper searchParams implementation
      class URLSearchParams {
        private params = new Map<string, string>();
        
        set(name: string, value: string) {
          this.params.set(name, value);
          return this;
        }
        
        toString() {
          let result = '';
          this.params.forEach((value, key) => {
            result += (result ? '&' : '?') + key + '=' + value;
          });
          return result;
        }
      }
      
      class MockURL {
        pathname: string;
        searchParams: URLSearchParams;
        href: string;
        
        constructor(href: string) {
          this.href = href;
          this.pathname = href.split('?')[0].split('://')[1]?.split('/').slice(1).join('/') || '';
          if (this.pathname.includes('main.css')) {
            this.pathname = 'styles/main.css';
          } else {
            this.pathname = 'styles/secondary.css';
          }
          this.searchParams = new URLSearchParams();
        }
        
        toString() {
          return this.href.split('?')[0] + this.searchParams.toString();
        }
      }
      
      global.URL = MockURL as any;
      
      // Access private method for styles/main.css only
      (browserHMR as any).refreshCSS('main.css');
      
      // Check that first href was updated (matches path)
      expect(mockLinks[0].href).toContain('?t=');
      // Check that second href was not updated (doesn't match path)
      expect(mockLinks[1].href).not.toContain('?t=');
    });
    
    it('should log warning when no stylesheets found', () => {
      // Setup no matching CSS links
      global.document.querySelectorAll = vi.fn().mockReturnValue([]);
      
      // Access private method
      (browserHMR as any).refreshCSS('styles/nonexistent.css');
      
      // Check warning was logged
      expect(global.console.warn).toHaveBeenCalled();
    });
    
    it('should handle stylesheet paths with query parameters', () => {
      // Setup mock CSS link with existing query parameter
      const mockLinks = [
        { href: 'http://localhost/styles/main.css?v=1.0' }
      ];
      
      // Create a proper URLSearchParams implementation
      class URLSearchParams {
        private params = new Map<string, string>();
        
        constructor(init?: string) {
          if (init) {
            init.split('&').forEach(pair => {
              const [key, value] = pair.split('=');
              this.params.set(key, value);
            });
          }
        }
        
        set(name: string, value: string) {
          this.params.set(name, value);
          return this;
        }
        
        toString() {
          let result = '';
          this.params.forEach((value, key) => {
            result += (result ? '&' : '') + key + '=' + value;
          });
          return result;
        }
      }
      
      class MockURL {
        pathname: string;
        searchParams: URLSearchParams;
        href: string;
        
        constructor(href: string) {
          this.href = href;
          const [url, query] = href.split('?');
          this.pathname = url.split('://')[1]?.split('/').slice(1).join('/') || '';
          this.searchParams = new URLSearchParams(query);
        }
        
        toString() {
          const params = this.searchParams.toString();
          return this.href.split('?')[0] + (params ? '?' + params : '');
        }
      }
      
      global.URL = MockURL as any;
      global.document.querySelectorAll = vi.fn().mockReturnValue(mockLinks);
      
      // Mock Date.now
      Date.now = vi.fn().mockReturnValue(12345);
      
      // Access private method
      (browserHMR as any).refreshCSS('styles/main.css');
      
      // Check that href was updated correctly - should contain both v=1.0 and t=12345
      expect(mockLinks[0].href).toContain('v=1.0');
      expect(mockLinks[0].href).toContain('t=12345');
    });
  });
});
