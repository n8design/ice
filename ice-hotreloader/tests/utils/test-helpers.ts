// Import the vi object directly
import { vi } from 'vitest';

// Define WebSocket readyState constants
export const WS_CONNECTING = 0;
export const WS_OPEN = 1;
export const WS_CLOSING = 2;
export const WS_CLOSED = 3;

// Use a more generic type for mocks
type MockFunction = unknown;

// Replace `Function` with explicit function types
type GenericFunction = (...args: unknown[]) => void;

// Mock WebSocket interface for server tests
export interface MockServerWebSocket {
  on: (event: string, handler: GenericFunction) => unknown;
  send: MockFunction;
  readyState: 0 | 1 | 2 | 3;
  close?: MockFunction;
  _triggerClose: () => void;
  _triggerError: (error: Error) => void;
}

// Create a mock WebSocket for server tests
export function createMockServerWebSocket(): MockServerWebSocket {
  const closeHandlers: GenericFunction[] = [];
  const errorHandlers: GenericFunction[] = [];
  
  const mockWs: MockServerWebSocket = {
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

// Mock WebSocket interface for browser tests
export interface MockBrowserWebSocket {
  addEventListener: MockFunction;
  readyState: 0 | 1 | 2 | 3;
  _listeners: Record<string, GenericFunction[]>;
  _triggerEvent: (eventName: string, data: unknown) => void;
}

// Create a mock WebSocket for browser tests
export function createMockBrowserWebSocket(): MockBrowserWebSocket {
  const listeners: Record<string, GenericFunction[]> = {
    'open': [],
    'message': [],
    'close': [],
    'error': []
  };
  
  return {
    addEventListener: vi.fn((event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    readyState: WS_OPEN,
    _listeners: listeners,
    _triggerEvent: (eventName, data) => {
      if (listeners[eventName]) {
        listeners[eventName].forEach(handler => handler(data));
      }
    }
  };
}

// Setup DOM mocks for browser tests
export function setupMockDOM() {
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
  
  // Create a mockWebSocket instance
  const mockWebSocketInstance = createMockBrowserWebSocket();
  
  // Setup WebSocket constructor
  const webSocketConstructor = vi.fn(() => mockWebSocketInstance) as any;
  webSocketConstructor.CONNECTING = WS_CONNECTING;
  webSocketConstructor.OPEN = WS_OPEN;
  webSocketConstructor.CLOSING = WS_CLOSING;
  webSocketConstructor.CLOSED = WS_CLOSED;
  
  global.WebSocket = webSocketConstructor;
  
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
}

// Replace `any` with `unknown` or specific types
const helperFunction = (arg: unknown): void => {
  // Implementation here
};

const anotherHelper: GenericFunction = () => {
  // Implementation here
};
