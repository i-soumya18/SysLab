import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { setupWebSocket } from '../websocket';

describe('WebSocket Simulation Integration', () => {
  let httpServer: any;
  let io: Server;
  let clientSocket: ClientSocket;
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

  it('should handle simulation start with workspace configuration', (done) => {
    const workspaceId = 'test-workspace-123';
    const workspace = {
      id: workspaceId,
      name: 'Test Workspace',
      components: [
        {
          id: 'web-server-1',
          type: 'web-server',
          position: { x: 100, y: 100 },
          configuration: {
            capacity: 100,
            latency: 50,
            failureRate: 0.01
          }
        }
      ],
      connections: [],
      configuration: {
        duration: 5, // 5 seconds for quick test
        loadPattern: {
          type: 'constant',
          baseLoad: 10
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 300000
        }
      }
    };

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Listen for simulation started event
      clientSocket.on('simulation:started', (data) => {
        expect(data.workspaceId).toBe(workspaceId);
        expect(data.duration).toBe(5);
        done();
      });

      // Start simulation
      clientSocket.emit('simulation:control', {
        workspaceId,
        action: 'start',
        parameters: { workspace }
      }, (controlResponse: any) => {
        expect(controlResponse.success).toBe(true);
        expect(controlResponse.action).toBe('start');
      });
    });
  });

  it('should receive real-time simulation metrics', (done) => {
    const workspaceId = 'test-workspace-metrics';
    const workspace = {
      id: workspaceId,
      name: 'Metrics Test Workspace',
      components: [
        {
          id: 'test-component',
          type: 'web-server',
          position: { x: 100, y: 100 },
          configuration: {
            capacity: 50,
            latency: 25,
            failureRate: 0
          }
        }
      ],
      connections: [],
      configuration: {
        duration: 3,
        loadPattern: {
          type: 'constant',
          baseLoad: 5
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 500, // Collect metrics every 500ms
          retentionPeriod: 300000
        }
      }
    };

    let metricsReceived = false;

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Listen for simulation metrics
      clientSocket.on('simulation:metrics', (data) => {
        if (data.type === 'component_metrics') {
          expect(data.data).toHaveProperty('componentId');
          expect(data.data).toHaveProperty('timestamp');
          expect(data.data).toHaveProperty('requestsPerSecond');
          expect(data.data).toHaveProperty('averageLatency');
          metricsReceived = true;
        }
      });

      // Listen for simulation stopped to complete test
      clientSocket.on('simulation:stopped', () => {
        expect(metricsReceived).toBe(true);
        done();
      });

      // Start simulation
      clientSocket.emit('simulation:control', {
        workspaceId,
        action: 'start',
        parameters: { workspace }
      });
    });
  });

  it('should receive simulation events', (done) => {
    const workspaceId = 'test-workspace-events';
    const workspace = {
      id: workspaceId,
      name: 'Events Test Workspace',
      components: [
        {
          id: 'event-component',
          type: 'web-server',
          position: { x: 100, y: 100 },
          configuration: {
            capacity: 10,
            latency: 100,
            failureRate: 0
          }
        }
      ],
      connections: [],
      configuration: {
        duration: 2,
        loadPattern: {
          type: 'constant',
          baseLoad: 2
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 300000
        }
      }
    };

    let eventReceived = false;

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Listen for simulation events
      clientSocket.on('simulation:event', (data) => {
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('timestamp');
        eventReceived = true;
      });

      // Listen for simulation stopped to complete test
      clientSocket.on('simulation:stopped', () => {
        expect(eventReceived).toBe(true);
        done();
      });

      // Start simulation
      clientSocket.emit('simulation:control', {
        workspaceId,
        action: 'start',
        parameters: { workspace }
      });
    });
  });

  it('should handle simulation stop', (done) => {
    const workspaceId = 'test-workspace-stop';
    const workspace = {
      id: workspaceId,
      name: 'Stop Test Workspace',
      components: [
        {
          id: 'stop-component',
          type: 'web-server',
          position: { x: 100, y: 100 },
          configuration: {
            capacity: 100,
            latency: 50,
            failureRate: 0
          }
        }
      ],
      connections: [],
      configuration: {
        duration: 60, // Long duration
        loadPattern: {
          type: 'constant',
          baseLoad: 10
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 300000
        }
      }
    };

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Listen for simulation started
      clientSocket.on('simulation:started', () => {
        // Stop simulation after it starts
        setTimeout(() => {
          clientSocket.emit('simulation:control', {
            workspaceId,
            action: 'stop'
          }, (stopResponse: any) => {
            expect(stopResponse.success).toBe(true);
            expect(stopResponse.action).toBe('stop');
          });
        }, 100);
      });

      // Listen for simulation stopped
      clientSocket.on('simulation:stopped', (data) => {
        expect(data.workspaceId).toBe(workspaceId);
        expect(data).toHaveProperty('eventCount');
        expect(data).toHaveProperty('duration');
        done();
      });

      // Start simulation
      clientSocket.emit('simulation:control', {
        workspaceId,
        action: 'start',
        parameters: { workspace }
      });
    });
  });

  it('should handle simulation progress updates', (done) => {
    const workspaceId = 'test-workspace-progress';
    const workspace = {
      id: workspaceId,
      name: 'Progress Test Workspace',
      components: [
        {
          id: 'progress-component',
          type: 'web-server',
          position: { x: 100, y: 100 },
          configuration: {
            capacity: 50,
            latency: 50,
            failureRate: 0
          }
        }
      ],
      connections: [],
      configuration: {
        duration: 3,
        loadPattern: {
          type: 'constant',
          baseLoad: 20 // Higher load to generate more events
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 300000
        }
      }
    };

    let progressReceived = false;

    // First join workspace
    clientSocket.emit('join-workspace', { workspaceId }, (response: any) => {
      expect(response.success).toBe(true);

      // Listen for simulation progress
      clientSocket.on('simulation:progress', (data) => {
        expect(data).toHaveProperty('currentTime');
        expect(data).toHaveProperty('eventCount');
        expect(data).toHaveProperty('isRunning');
        expect(data.isRunning).toBe(true);
        progressReceived = true;
      });

      // Listen for simulation stopped to complete test
      clientSocket.on('simulation:stopped', () => {
        expect(progressReceived).toBe(true);
        done();
      });

      // Start simulation
      clientSocket.emit('simulation:control', {
        workspaceId,
        action: 'start',
        parameters: { workspace }
      });
    });
  });
});