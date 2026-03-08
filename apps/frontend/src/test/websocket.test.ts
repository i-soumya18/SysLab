import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create a mock socket that we can control
const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  join: vi.fn(),
  leave: vi.fn()
};

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

// Import after mocking
import { WebSocketService } from '../services/websocket';
import { io } from 'socket.io-client';

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock socket state
    Object.assign(mockSocket, {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      join: vi.fn(),
      leave: vi.fn()
    });
    
    webSocketService = new WebSocketService({
      url: 'http://localhost:3000',
      token: 'test-token'
    });
  });

  afterEach(() => {
    webSocketService.disconnect();
  });

  it('should initialize with correct configuration', () => {
    expect(webSocketService).toBeDefined();
    expect(webSocketService.getConnectionStatus().connected).toBe(false);
    expect(webSocketService.getConnectionStatus().connecting).toBe(false);
  });

  it('should handle connection establishment', async () => {
    // Mock successful connection
    mockSocket.connected = true;
    
    // Mock the event handlers to simulate connection
    const eventHandlers: { [key: string]: Function } = {};
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      eventHandlers[event] = handler;
    });

    // Start the connection process
    const connectPromise = webSocketService.connect();
    
    // Simulate the connect event being fired
    setTimeout(() => {
      if (eventHandlers['connect']) {
        eventHandlers['connect']();
      }
    }, 10);

    await connectPromise;
    
    expect(io).toHaveBeenCalledWith('http://localhost:3000', {
      auth: { token: 'test-token' },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    expect(webSocketService.getConnectionStatus().connected).toBe(true);
  });

  it('should handle workspace operations', async () => {
    // First establish connection
    mockSocket.connected = true;
    const eventHandlers: { [key: string]: Function } = {};
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      eventHandlers[event] = handler;
    });

    // Connect first
    const connectPromise = webSocketService.connect();
    setTimeout(() => {
      if (eventHandlers['connect']) {
        eventHandlers['connect']();
      }
    }, 10);
    await connectPromise;
    
    // Mock successful join response
    mockSocket.emit.mockImplementation((event: string, data: any, callback?: Function) => {
      if (event === 'join-workspace' && callback) {
        setTimeout(() => callback({ success: true, workspaceId: data.workspaceId }), 10);
      }
    });

    await webSocketService.joinWorkspace('test-workspace', 'test-user');
    
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'join-workspace',
      { workspaceId: 'test-workspace', userId: 'test-user' },
      expect.any(Function)
    );
    expect(webSocketService.getCurrentWorkspaceId()).toBe('test-workspace');
  });

  it('should handle event listeners', () => {
    const listener = vi.fn();
    
    webSocketService.on('test-event', listener);
    
    // Simulate event emission
    (webSocketService as any).emit('test-event', { data: 'test' });
    
    expect(listener).toHaveBeenCalledWith({ data: 'test' });
    
    // Remove listener
    webSocketService.off('test-event', listener);
    (webSocketService as any).emit('test-event', { data: 'test2' });
    
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should handle disconnection', () => {
    // Set up a mock socket first
    (webSocketService as any).socket = mockSocket;
    
    webSocketService.disconnect();
    
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(webSocketService.getConnectionStatus().connected).toBe(false);
    expect(webSocketService.getCurrentWorkspaceId()).toBeNull();
  });

  it('should reject operations when not connected', async () => {
    mockSocket.connected = false;
    
    await expect(webSocketService.joinWorkspace('test')).rejects.toThrow('WebSocket not connected');
    await expect(webSocketService.controlSimulation('start')).rejects.toThrow('WebSocket not connected');
    await expect(webSocketService.updateCanvas('component-added', {})).rejects.toThrow('WebSocket not connected');
  });

  it('should reject operations when no workspace joined', async () => {
    mockSocket.connected = true;
    
    await expect(webSocketService.controlSimulation('start')).rejects.toThrow('no workspace joined');
    await expect(webSocketService.updateCanvas('component-added', {})).rejects.toThrow('no workspace joined');
  });
});