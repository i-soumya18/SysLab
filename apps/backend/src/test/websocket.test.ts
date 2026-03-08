import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupWebSocket } from '../websocket';

describe('WebSocket Integration', () => {
  let httpServer: any;
  let io: Server;
  let clientSocket: ClientSocket;
  let serverSocket: any;
  let port: number;

  beforeEach(async () => {
    return new Promise<void>((resolve) => {
      httpServer = createServer();
      io = new Server(httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });

      setupWebSocket(io);

      httpServer.listen(() => {
        port = (httpServer.address() as any).port;
        clientSocket = Client(`http://localhost:${port}`, {
          auth: { token: 'test-token' }
        });

        io.on('connection', (socket) => {
          serverSocket = socket;
        });

        clientSocket.on('connect', () => {
          resolve();
        });
      });
    });
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (io) {
      io.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  it('should establish connection with authentication', (done) => {
    expect(clientSocket.connected).toBe(true);
    
    clientSocket.on('connection:established', (data) => {
      expect(data).toHaveProperty('socketId');
      expect(data).toHaveProperty('timestamp');
      done();
    });
  });

  it('should handle workspace join and leave', (done) => {
    const workspaceId = 'test-workspace-123';
    const userId = 'test-user-456';

    clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
      expect(response.success).toBe(true);
      expect(response.workspaceId).toBe(workspaceId);

      clientSocket.emit('leave-workspace', workspaceId, (leaveResponse: any) => {
        expect(leaveResponse.success).toBe(true);
        done();
      });
    });
  });

  it('should handle simulation control events', (done) => {
    const workspaceId = 'test-workspace-123';

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Then send simulation control
      clientSocket.emit('simulation:control', {
        workspaceId,
        action: 'start',
        parameters: { duration: 60 }
      }, (controlResponse: any) => {
        expect(controlResponse.success).toBe(true);
        expect(controlResponse.action).toBe('start');
        done();
      });
    });
  });

  it('should handle canvas updates', (done) => {
    const workspaceId = 'test-workspace-123';

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Then send canvas update
      clientSocket.emit('canvas:update', {
        workspaceId,
        type: 'component-added',
        data: { componentId: 'comp-123', type: 'database' }
      }, (updateResponse: any) => {
        expect(updateResponse.success).toBe(true);
        expect(updateResponse.type).toBe('component-added');
        done();
      });
    });
  });

  it('should respond to ping', (done) => {
    clientSocket.emit('ping', (response: any) => {
      expect(response.pong).toBe(true);
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('socketId');
      done();
    });
  });

  it('should reject unauthorized workspace access', (done) => {
    const workspaceId = 'test-workspace-123';
    const unauthorizedWorkspaceId = 'unauthorized-workspace-456';

    // First join authorized workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Try to access unauthorized workspace
      clientSocket.emit('simulation:control', {
        workspaceId: unauthorizedWorkspaceId,
        action: 'start'
      }, (controlResponse: any) => {
        expect(controlResponse.error).toBeDefined();
        expect(controlResponse.error).toContain('Not authorized');
        done();
      });
    });
  });

  it('should handle connection errors gracefully', (done) => {
    // Test with invalid data
    clientSocket.emit('join-workspace', null, (response: any) => {
      expect(response.error).toBeDefined();
      done();
    });
  });
});