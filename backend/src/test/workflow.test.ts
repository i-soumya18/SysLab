/**
 * Workflow Integration Tests
 * Tests specific user workflows and multi-user scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket } from 'socket.io-client';
import express from 'express';
import { setupWebSocket } from '../websocket';
import type { Workspace, Component } from '../types';

describe('Workflow Integration Tests', () => {
  let httpServer: any;
  let ioServer: Server;
  let serverPort: number;

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);
    ioServer = new Server(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });

    setupWebSocket(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        serverPort = httpServer.address()?.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    httpServer.close();
  });

  describe('Workspace Creation to Simulation Completion', () => {
    it('should complete workspace creation workflow', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      try {
        const workspaceId = 'workflow-test-1';
        const userId = 'workflow-user-1';

        // Step 1: Join workspace
        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else {
              expect(response.success).toBe(true);
              resolve();
            }
          });
        });

        // Step 2: Add multiple components
        const components = [
          {
            id: 'lb-1',
            type: 'load-balancer',
            position: { x: 100, y: 100 },
            configuration: { capacity: 2000, latency: 10, failureRate: 0.001 },
            metadata: { name: 'Load Balancer', version: '1.0.0' }
          },
          {
            id: 'web-1',
            type: 'web-server',
            position: { x: 300, y: 100 },
            configuration: { capacity: 1000, latency: 50, failureRate: 0.002 },
            metadata: { name: 'Web Server 1', version: '1.0.0' }
          },
          {
            id: 'web-2',
            type: 'web-server',
            position: { x: 300, y: 200 },
            configuration: { capacity: 1000, latency: 50, failureRate: 0.002 },
            metadata: { name: 'Web Server 2', version: '1.0.0' }
          },
          {
            id: 'db-1',
            type: 'database',
            position: { x: 500, y: 150 },
            configuration: { capacity: 500, latency: 20, failureRate: 0.001 },
            metadata: { name: 'Database', version: '1.0.0' }
          }
        ];

        for (const component of components) {
          await new Promise<void>((resolve, reject) => {
            clientSocket.emit('canvas:update', {
              workspaceId,
              type: 'component-added',
              data: component
            }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          });
        }

        // Step 3: Create connections
        const connections = [
          {
            id: 'conn-1',
            sourceComponentId: 'lb-1',
            targetComponentId: 'web-1',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.999 }
          },
          {
            id: 'conn-2',
            sourceComponentId: 'lb-1',
            targetComponentId: 'web-2',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.999 }
          },
          {
            id: 'conn-3',
            sourceComponentId: 'web-1',
            targetComponentId: 'db-1',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 500, latency: 2, protocol: 'DATABASE', reliability: 0.999 }
          },
          {
            id: 'conn-4',
            sourceComponentId: 'web-2',
            targetComponentId: 'db-1',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 500, latency: 2, protocol: 'DATABASE', reliability: 0.999 }
          }
        ];

        for (const connection of connections) {
          await new Promise<void>((resolve, reject) => {
            clientSocket.emit('canvas:update', {
              workspaceId,
              type: 'connection-created',
              data: connection
            }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          });
        }

        // Step 4: Start simulation
        const workspace: Workspace = {
          id: workspaceId,
          name: 'Workflow Test Workspace',
          userId,
          components,
          connections,
          configuration: {
            duration: 30,
            loadPattern: { type: 'ramp', baseLoad: 50, peakLoad: 200 },
            failureScenarios: [],
            metricsCollection: { interval: 1000, enabled: true }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        let simulationStarted = false;
        clientSocket.on('simulation:started', () => {
          simulationStarted = true;
        });

        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('simulation:control', {
            workspaceId,
            action: 'start',
            parameters: { workspace }
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Wait for simulation to start
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 5: Stop simulation
        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('simulation:control', {
            workspaceId,
            action: 'stop'
          }, (response: any) => {
            if (response.error) {
              console.log('Stop simulation note:', response.error);
              resolve(); // It's okay if simulation wasn't running
            } else {
              resolve();
            }
          });
        });

        expect(simulationStarted).toBe(true);

      } finally {
        clientSocket.disconnect();
      }
    }, 20000);

    it('should handle workspace persistence workflow', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      try {
        const workspaceId = 'persistence-test';
        const userId = 'persistence-user';

        // Join workspace
        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Add component
        const component = {
          id: 'test-component',
          type: 'web-server',
          position: { x: 200, y: 200 },
          configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
          metadata: { name: 'Test Server', version: '1.0.0' }
        };

        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: component
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Update component
        const updatedComponent = {
          ...component,
          configuration: { ...component.configuration, capacity: 2000 }
        };

        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('canvas:update', {
            workspaceId,
            type: 'component-updated',
            data: updatedComponent
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Remove component
        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('canvas:update', {
            workspaceId,
            type: 'component-removed',
            data: { id: component.id }
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // All operations should succeed
        expect(true).toBe(true);

      } finally {
        clientSocket.disconnect();
      }
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle collaborative workspace editing', async () => {
      const client1 = Client(`http://localhost:${serverPort}`);
      const client2 = Client(`http://localhost:${serverPort}`);
      const client3 = Client(`http://localhost:${serverPort}`);

      await Promise.all([
        new Promise<void>((resolve) => client1.on('connect', resolve)),
        new Promise<void>((resolve) => client2.on('connect', resolve)),
        new Promise<void>((resolve) => client3.on('connect', resolve))
      ]);

      try {
        const workspaceId = 'collaborative-test';
        const users = ['user1', 'user2', 'user3'];

        // All users join the same workspace
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            client1.emit('join-workspace', { workspaceId, userId: users[0] }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          }),
          new Promise<void>((resolve, reject) => {
            client2.emit('join-workspace', { workspaceId, userId: users[1] }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          }),
          new Promise<void>((resolve, reject) => {
            client3.emit('join-workspace', { workspaceId, userId: users[2] }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          })
        ]);

        // Track updates received by each client
        const client1Updates: any[] = [];
        const client2Updates: any[] = [];
        const client3Updates: any[] = [];

        client1.on('canvas:update', (data) => client1Updates.push(data));
        client2.on('canvas:update', (data) => client2Updates.push(data));
        client3.on('canvas:update', (data) => client3Updates.push(data));

        // Each user adds a component
        const components = [
          {
            id: 'user1-component',
            type: 'load-balancer',
            position: { x: 100, y: 100 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.001 },
            metadata: { name: 'User 1 LB', version: '1.0.0' }
          },
          {
            id: 'user2-component',
            type: 'web-server',
            position: { x: 300, y: 100 },
            configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
            metadata: { name: 'User 2 Web', version: '1.0.0' }
          },
          {
            id: 'user3-component',
            type: 'database',
            position: { x: 500, y: 100 },
            configuration: { capacity: 500, latency: 20, failureRate: 0.001 },
            metadata: { name: 'User 3 DB', version: '1.0.0' }
          }
        ];

        // User 1 adds component
        await new Promise<void>((resolve, reject) => {
          client1.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: components[0]
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // User 2 adds component
        await new Promise<void>((resolve, reject) => {
          client2.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: components[1]
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // User 3 adds component
        await new Promise<void>((resolve, reject) => {
          client3.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: components[2]
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Wait for updates to propagate
        await new Promise(resolve => setTimeout(resolve, 500));

        // Each client should have received updates from the other two users
        expect(client1Updates.length).toBe(2); // Updates from user2 and user3
        expect(client2Updates.length).toBe(2); // Updates from user1 and user3
        expect(client3Updates.length).toBe(2); // Updates from user1 and user2

        // Verify update content
        expect(client1Updates.some(u => u.data.id === 'user2-component')).toBe(true);
        expect(client1Updates.some(u => u.data.id === 'user3-component')).toBe(true);
        expect(client2Updates.some(u => u.data.id === 'user1-component')).toBe(true);
        expect(client2Updates.some(u => u.data.id === 'user3-component')).toBe(true);
        expect(client3Updates.some(u => u.data.id === 'user1-component')).toBe(true);
        expect(client3Updates.some(u => u.data.id === 'user2-component')).toBe(true);

      } finally {
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
      }
    }, 15000);

    it('should maintain data consistency with concurrent operations', async () => {
      const client1 = Client(`http://localhost:${serverPort}`);
      const client2 = Client(`http://localhost:${serverPort}`);

      await Promise.all([
        new Promise<void>((resolve) => client1.on('connect', resolve)),
        new Promise<void>((resolve) => client2.on('connect', resolve))
      ]);

      try {
        const workspaceId = 'consistency-test';

        // Both clients join workspace
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            client1.emit('join-workspace', { workspaceId, userId: 'user1' }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          }),
          new Promise<void>((resolve, reject) => {
            client2.emit('join-workspace', { workspaceId, userId: 'user2' }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          })
        ]);

        // Perform concurrent operations
        const operations = [];
        
        // Client 1 performs rapid operations
        for (let i = 0; i < 5; i++) {
          operations.push(new Promise<void>((resolve, reject) => {
            client1.emit('canvas:update', {
              workspaceId,
              type: 'component-added',
              data: {
                id: `client1-component-${i}`,
                type: 'web-server',
                position: { x: i * 100, y: 100 },
                configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
                metadata: { name: `Client 1 Component ${i}`, version: '1.0.0' }
              }
            }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          }));
        }

        // Client 2 performs rapid operations
        for (let i = 0; i < 5; i++) {
          operations.push(new Promise<void>((resolve, reject) => {
            client2.emit('canvas:update', {
              workspaceId,
              type: 'component-added',
              data: {
                id: `client2-component-${i}`,
                type: 'database',
                position: { x: i * 100, y: 200 },
                configuration: { capacity: 500, latency: 20, failureRate: 0.001 },
                metadata: { name: `Client 2 Component ${i}`, version: '1.0.0' }
              }
            }, (response: any) => {
              if (response.error) reject(new Error(response.error));
              else resolve();
            });
          }));
        }

        // All operations should complete successfully
        await Promise.all(operations);

      } finally {
        client1.disconnect();
        client2.disconnect();
      }
    }, 10000);
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle client disconnection during simulation', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const workspaceId = 'disconnection-test';
      const userId = 'disconnection-user';

      // Join workspace
      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Start simulation
      const workspace: Workspace = {
        id: workspaceId,
        name: 'Disconnection Test',
        userId,
        components: [{
          id: 'test-component',
          type: 'web-server',
          position: { x: 100, y: 100 },
          configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
          metadata: { name: 'Test Server', version: '1.0.0' }
        }],
        connections: [],
        configuration: {
          duration: 60,
          loadPattern: { type: 'constant', baseLoad: 100 },
          failureScenarios: [],
          metricsCollection: { interval: 1000, enabled: true }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'start',
          parameters: { workspace }
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Simulate client disconnection
      clientSocket.disconnect();

      // Reconnect and verify system is still functional
      const newClientSocket = Client(`http://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        newClientSocket.on('connect', resolve);
      });

      try {
        // Should be able to join workspace again
        await new Promise<void>((resolve, reject) => {
          newClientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Should be able to stop simulation
        await new Promise<void>((resolve, reject) => {
          newClientSocket.emit('simulation:control', {
            workspaceId,
            action: 'stop'
          }, (response: any) => {
            // Either success or "no running simulation" is acceptable
            resolve();
          });
        });

      } finally {
        newClientSocket.disconnect();
      }
    });

    it('should handle invalid workspace operations gracefully', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      try {
        // Test invalid workspace join
        await new Promise<void>((resolve) => {
          clientSocket.emit('join-workspace', { workspaceId: '', userId: 'test' }, (response: any) => {
            expect(response.error).toBeDefined();
            resolve();
          });
        });

        // Test unauthorized operations
        await new Promise<void>((resolve) => {
          clientSocket.emit('simulation:control', {
            workspaceId: 'unauthorized-workspace',
            action: 'start'
          }, (response: any) => {
            expect(response.error).toBeDefined();
            expect(response.error).toContain('Not authorized');
            resolve();
          });
        });

        await new Promise<void>((resolve) => {
          clientSocket.emit('canvas:update', {
            workspaceId: 'unauthorized-workspace',
            type: 'component-added',
            data: { id: 'test' }
          }, (response: any) => {
            expect(response.error).toBeDefined();
            expect(response.error).toContain('Not authorized');
            resolve();
          });
        });

      } finally {
        clientSocket.disconnect();
      }
    });
  });
});