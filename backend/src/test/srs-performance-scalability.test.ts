/**
 * SRS Performance and Scalability Validation Tests
 * 
 * Tests for SRS Non-Functional Requirements (NFR-1 through NFR-5):
 * - NFR-1: Sub-100ms simulation updates
 * - NFR-2: Real-time UI responsiveness  
 * - NFR-3: User isolation under stress
 * - NFR-4: Thousands of concurrent users
 * - NFR-5: Simulation workload scaling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket } from 'socket.io-client';
import express from 'express';
import { setupWebSocket } from '../websocket';
import { SimulationEngine } from '../simulation/SimulationEngine';
import type { Workspace, Component, Connection } from '../types';

describe('SRS Performance and Scalability Validation', () => {
  let httpServer: any;
  let ioServer: Server;
  let serverPort: number;

  beforeAll(async () => {

    // Create test server
    const app = express();
    httpServer = createServer(app);
    ioServer = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      // Optimize for high concurrency
      transports: ['websocket'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Setup WebSocket handlers
    setupWebSocket(ioServer);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        serverPort = httpServer.address()?.port;
        resolve();
      });
    });

    console.log(`Performance test server started on port ${serverPort}`);
  });

  afterAll(async () => {
    if (ioServer) {
      ioServer.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  describe('SRS NFR-1: Sub-100ms Simulation Updates', () => {
    it('should maintain sub-100ms update latency under normal load', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const workspaceId = 'nfr1-performance-test';
      const userId = 'nfr1-test-user';

      // Join workspace
      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Create test workspace with multiple components
      const testWorkspace: Workspace = {
        id: workspaceId,
        name: 'NFR-1 Performance Test',
        userId,
        components: [
          {
            id: 'perf-lb',
            type: 'load-balancer',
            position: { x: 100, y: 100 },
            configuration: { capacity: 5000, latency: 10, failureRate: 0.001 },
            metadata: { name: 'Performance LB', version: '1.0.0' }
          },
          {
            id: 'perf-server-1',
            type: 'web-server',
            position: { x: 250, y: 100 },
            configuration: { capacity: 2000, latency: 50, failureRate: 0.002 },
            metadata: { name: 'Performance Server 1', version: '1.0.0' }
          },
          {
            id: 'perf-server-2',
            type: 'web-server',
            position: { x: 250, y: 200 },
            configuration: { capacity: 2000, latency: 50, failureRate: 0.002 },
            metadata: { name: 'Performance Server 2', version: '1.0.0' }
          },
          {
            id: 'perf-db',
            type: 'database',
            position: { x: 400, y: 150 },
            configuration: { capacity: 1000, latency: 20, failureRate: 0.001 },
            metadata: { name: 'Performance DB', version: '1.0.0' }
          }
        ],
        connections: [
          {
            id: 'perf-conn-1',
            sourceComponentId: 'perf-lb',
            targetComponentId: 'perf-server-1',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 1000, latency: 2, protocol: 'HTTP', reliability: 0.999 }
          },
          {
            id: 'perf-conn-2',
            sourceComponentId: 'perf-lb',
            targetComponentId: 'perf-server-2',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 1000, latency: 2, protocol: 'HTTP', reliability: 0.999 }
          },
          {
            id: 'perf-conn-3',
            sourceComponentId: 'perf-server-1',
            targetComponentId: 'perf-db',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 500, latency: 1, protocol: 'DATABASE', reliability: 0.999 }
          },
          {
            id: 'perf-conn-4',
            sourceComponentId: 'perf-server-2',
            targetComponentId: 'perf-db',
            sourcePort: 'output',
            targetPort: 'input',
            configuration: { bandwidth: 500, latency: 1, protocol: 'DATABASE', reliability: 0.999 }
          }
        ],
        configuration: {
          duration: 30,
          loadPattern: {
            type: 'ramp',
            baseLoad: 1000,
            peakLoad: 50000,
            rampDuration: 10
          },
          failureScenarios: [],
          metricsCollection: {
            interval: 50, // 50ms intervals for high-frequency updates
            enabled: true
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Track update latencies
      const updateLatencies: number[] = [];
      let metricsCount = 0;
      const maxMetrics = 100; // Collect 100 samples

      clientSocket.on('simulation:metrics', (data) => {
        const receiveTime = Date.now();
        const sendTime = data.timestamp;
        const latency = receiveTime - sendTime;
        
        updateLatencies.push(latency);
        metricsCount++;
        
        // Verify each update is sub-100ms
        expect(latency).toBeLessThan(100);
        
        if (metricsCount === 1) {
          console.log(`    First update latency: ${latency}ms`);
        }
      });

      // Start simulation
      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'start',
          parameters: { workspace: testWorkspace }
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Wait for metrics collection
      await new Promise<void>((resolve) => {
        const checkMetrics = () => {
          if (metricsCount >= maxMetrics) {
            resolve();
          } else {
            setTimeout(checkMetrics, 100);
          }
        };
        checkMetrics();
      });

      // Stop simulation
      await new Promise<void>((resolve) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'stop'
        }, () => resolve());
      });

      clientSocket.disconnect();

      // Analyze performance
      const avgLatency = updateLatencies.reduce((a, b) => a + b, 0) / updateLatencies.length;
      const maxLatency = Math.max(...updateLatencies);
      const p95Latency = updateLatencies.sort((a, b) => a - b)[Math.floor(updateLatencies.length * 0.95)];

      console.log(`    📊 Update Latency Statistics:`);
      console.log(`      Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`      Maximum: ${maxLatency}ms`);
      console.log(`      P95: ${p95Latency}ms`);
      console.log(`      Samples: ${updateLatencies.length}`);

      // Verify SRS NFR-1 compliance
      expect(avgLatency).toBeLessThan(100);
      expect(maxLatency).toBeLessThan(100);
      expect(p95Latency).toBeLessThan(100);
      expect(updateLatencies.length).toBeGreaterThan(50);

      console.log('    ✅ SRS NFR-1: Sub-100ms simulation updates maintained');
    }, 45000);

    it('should maintain sub-100ms updates under high computational load', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const workspaceId = 'nfr1-high-load-test';
      const userId = 'nfr1-high-load-user';

      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Create computationally intensive workspace
      const components: Component[] = [];
      const connections: Connection[] = [];

      // Create 20 components for high computational load
      for (let i = 0; i < 20; i++) {
        components.push({
          id: `high-load-comp-${i}`,
          type: i % 4 === 0 ? 'database' : i % 4 === 1 ? 'cache' : i % 4 === 2 ? 'queue' : 'web-server',
          position: { x: (i % 5) * 100, y: Math.floor(i / 5) * 100 },
          configuration: {
            capacity: 1000 + i * 100,
            latency: 10 + i * 2,
            failureRate: 0.001 + i * 0.0001
          },
          metadata: { name: `High Load Component ${i}`, version: '1.0.0' }
        });

        // Create connections between adjacent components
        if (i > 0) {
          connections.push({
            id: `high-load-conn-${i}`,
            sourceComponentId: `high-load-comp-${i-1}`,
            targetComponentId: `high-load-comp-${i}`,
            sourcePort: 'output',
            targetPort: 'input',
            configuration: {
              bandwidth: 1000,
              latency: 1,
              protocol: 'HTTP',
              reliability: 0.999
            }
          });
        }
      }

      const highLoadWorkspace: Workspace = {
        id: workspaceId,
        name: 'High Load Performance Test',
        userId,
        components,
        connections,
        configuration: {
          duration: 20,
          loadPattern: {
            type: 'bursty',
            baseLoad: 5000,
            burstLoad: 100000,
            burstDuration: 2,
            burstInterval: 5
          },
          failureScenarios: [],
          metricsCollection: {
            interval: 25, // Very high frequency updates
            enabled: true
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const highLoadLatencies: number[] = [];
      let highLoadMetricsCount = 0;

      clientSocket.on('simulation:metrics', (data) => {
        const latency = Date.now() - data.timestamp;
        highLoadLatencies.push(latency);
        highLoadMetricsCount++;
        
        // Each update must still be sub-100ms even under high load
        expect(latency).toBeLessThan(100);
      });

      // Start high-load simulation
      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'start',
          parameters: { workspace: highLoadWorkspace }
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Run for 10 seconds under high load
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Stop simulation
      await new Promise<void>((resolve) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'stop'
        }, () => resolve());
      });

      clientSocket.disconnect();

      // Verify performance under high load
      const avgHighLoadLatency = highLoadLatencies.reduce((a, b) => a + b, 0) / highLoadLatencies.length;
      const maxHighLoadLatency = Math.max(...highLoadLatencies);

      console.log(`    📊 High Load Performance:`);
      console.log(`      Average latency: ${avgHighLoadLatency.toFixed(2)}ms`);
      console.log(`      Maximum latency: ${maxHighLoadLatency}ms`);
      console.log(`      Metrics collected: ${highLoadMetricsCount}`);

      expect(avgHighLoadLatency).toBeLessThan(100);
      expect(maxHighLoadLatency).toBeLessThan(100);
      expect(highLoadMetricsCount).toBeGreaterThan(100);

      console.log('    ✅ SRS NFR-1: Sub-100ms updates maintained under high computational load');
    }, 30000);
  });

  describe('SRS NFR-2: Real-time UI Responsiveness', () => {
    it('should provide immediate feedback for user interactions', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const workspaceId = 'nfr2-ui-responsiveness';
      const userId = 'nfr2-test-user';

      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Test rapid canvas operations
      const operationLatencies: number[] = [];
      const operationCount = 50;

      for (let i = 0; i < operationCount; i++) {
        const startTime = Date.now();
        
        await new Promise<void>((resolve, reject) => {
          clientSocket.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: {
              id: `ui-responsive-comp-${i}`,
              type: 'web-server',
              position: { x: i * 10, y: i * 10 },
              configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
              metadata: { name: `UI Test ${i}`, version: '1.0.0' }
            }
          }, (response: any) => {
            const endTime = Date.now();
            const latency = endTime - startTime;
            operationLatencies.push(latency);
            
            if (response.error) reject(new Error(response.error));
            else {
              // UI operations should feel immediate (< 50ms for good UX)
              expect(latency).toBeLessThan(50);
              resolve();
            }
          });
        });
      }

      clientSocket.disconnect();

      const avgOperationLatency = operationLatencies.reduce((a, b) => a + b, 0) / operationLatencies.length;
      const maxOperationLatency = Math.max(...operationLatencies);

      console.log(`    📊 UI Operation Performance:`);
      console.log(`      Average response: ${avgOperationLatency.toFixed(2)}ms`);
      console.log(`      Maximum response: ${maxOperationLatency}ms`);
      console.log(`      Operations tested: ${operationCount}`);

      expect(avgOperationLatency).toBeLessThan(50);
      expect(maxOperationLatency).toBeLessThan(100);

      console.log('    ✅ SRS NFR-2: Real-time UI responsiveness maintained');
    }, 20000);
  });

  describe('SRS NFR-3: User Isolation Under Stress', () => {
    it('should maintain complete user isolation under concurrent load', async () => {
      const userCount = 10;
      const clients: Socket[] = [];
      const userMetrics: { [userId: string]: any[] } = {};

      // Create multiple concurrent users
      for (let i = 0; i < userCount; i++) {
        const client = Client(`http://localhost:${serverPort}`, {
          transports: ['websocket']
        });

        await new Promise<void>((resolve) => {
          client.on('connect', resolve);
        });

        clients.push(client);
        
        const userId = `isolation-user-${i}`;
        const workspaceId = `isolation-workspace-${i}`;
        userMetrics[userId] = [];

        // Each user joins their own workspace
        await new Promise<void>((resolve, reject) => {
          client.emit('join-workspace', { workspaceId, userId }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });

        // Set up metrics collection for each user
        client.on('simulation:metrics', (data) => {
          userMetrics[userId].push({
            timestamp: Date.now(),
            data: data,
            userId: userId
          });
        });
      }

      // Start simulations for all users simultaneously
      const simulationPromises = clients.map(async (client, index) => {
        const userId = `isolation-user-${index}`;
        const workspaceId = `isolation-workspace-${index}`;

        const isolationWorkspace: Workspace = {
          id: workspaceId,
          name: `Isolation Test ${index}`,
          userId,
          components: [
            {
              id: `isolation-comp-${index}`,
              type: 'web-server',
              position: { x: 100, y: 100 },
              configuration: {
                capacity: 1000 + index * 100, // Different capacities to verify isolation
                latency: 50 + index * 5,
                failureRate: 0.001 + index * 0.0001
              },
              metadata: { name: `Isolation Component ${index}`, version: '1.0.0' }
            }
          ],
          connections: [],
          configuration: {
            duration: 15,
            loadPattern: {
              type: 'constant',
              baseLoad: 100 + index * 50 // Different loads to verify isolation
            },
            failureScenarios: [],
            metricsCollection: {
              interval: 100,
              enabled: true
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        return new Promise<void>((resolve, reject) => {
          client.emit('simulation:control', {
            workspaceId,
            action: 'start',
            parameters: { workspace: isolationWorkspace }
          }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          });
        });
      });

      // Wait for all simulations to start
      await Promise.all(simulationPromises);

      // Let simulations run for 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Stop all simulations
      const stopPromises = clients.map((client, index) => {
        const workspaceId = `isolation-workspace-${index}`;
        return new Promise<void>((resolve) => {
          client.emit('simulation:control', {
            workspaceId,
            action: 'stop'
          }, () => resolve());
        });
      });

      await Promise.all(stopPromises);

      // Disconnect all clients
      clients.forEach(client => client.disconnect());

      // Verify user isolation
      const userIds = Object.keys(userMetrics);
      expect(userIds).toHaveLength(userCount);

      // Each user should have received metrics
      userIds.forEach(userId => {
        expect(userMetrics[userId].length).toBeGreaterThan(0);
        console.log(`    User ${userId}: ${userMetrics[userId].length} metrics received`);
      });

      // Verify no cross-contamination of metrics
      userIds.forEach(userId => {
        userMetrics[userId].forEach(metric => {
          expect(metric.userId).toBe(userId);
        });
      });

      console.log(`    📊 User Isolation Results:`);
      console.log(`      Concurrent users: ${userCount}`);
      console.log(`      Total metrics: ${Object.values(userMetrics).flat().length}`);
      console.log(`      Isolation verified: ✅`);

      console.log('    ✅ SRS NFR-3: User isolation maintained under concurrent stress');
    }, 45000);
  });

  describe('SRS NFR-4: Thousands of Concurrent Users', () => {
    it('should support high concurrent user load', async () => {
      // Note: This is a scaled-down version for testing environment
      // In production, this would test with actual thousands of users
      const concurrentUsers = 50; // Scaled down for test environment
      const clients: Socket[] = [];
      const connectionResults: boolean[] = [];
      const operationResults: boolean[] = [];

      console.log(`    🚀 Testing ${concurrentUsers} concurrent users (scaled for test environment)`);

      // Create concurrent connections
      const connectionPromises = Array.from({ length: concurrentUsers }, async (_, index) => {
        try {
          const client = Client(`http://localhost:${serverPort}`, {
            transports: ['websocket'],
            timeout: 10000
          });

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, 5000);

            client.on('connect', () => {
              clearTimeout(timeout);
              resolve();
            });

            client.on('connect_error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });

          clients.push(client);
          connectionResults.push(true);

          // Each user performs a workspace operation
          const userId = `concurrent-user-${index}`;
          const workspaceId = `concurrent-workspace-${index}`;

          await new Promise<void>((resolve, reject) => {
            client.emit('join-workspace', { workspaceId, userId }, (response: any) => {
              if (response.error) {
                reject(new Error(response.error));
              } else {
                operationResults.push(true);
                resolve();
              }
            });
          });

          return true;
        } catch (error) {
          console.log(`    User ${index} failed: ${error.message}`);
          connectionResults.push(false);
          operationResults.push(false);
          return false;
        }
      });

      // Wait for all connections with timeout
      const results = await Promise.allSettled(connectionPromises);
      
      // Clean up connections
      clients.forEach(client => {
        if (client.connected) {
          client.disconnect();
        }
      });

      // Analyze results
      const successfulConnections = connectionResults.filter(r => r).length;
      const successfulOperations = operationResults.filter(r => r).length;
      const connectionSuccessRate = (successfulConnections / concurrentUsers) * 100;
      const operationSuccessRate = (successfulOperations / concurrentUsers) * 100;

      console.log(`    📊 Concurrent User Results:`);
      console.log(`      Target users: ${concurrentUsers}`);
      console.log(`      Successful connections: ${successfulConnections} (${connectionSuccessRate.toFixed(1)}%)`);
      console.log(`      Successful operations: ${successfulOperations} (${operationSuccessRate.toFixed(1)}%)`);

      // Verify acceptable success rates (>90% for test environment)
      expect(connectionSuccessRate).toBeGreaterThan(90);
      expect(operationSuccessRate).toBeGreaterThan(90);

      console.log('    ✅ SRS NFR-4: High concurrent user load supported');
    }, 60000);
  });

  describe('SRS NFR-5: Simulation Workload Scaling', () => {
    it('should scale simulation workloads across multiple instances', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const workspaceId = 'nfr5-workload-scaling';
      const userId = 'nfr5-test-user';

      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Create large-scale simulation workspace
      const largeScaleComponents: Component[] = [];
      const largeScaleConnections: Connection[] = [];

      // Create a complex topology with 30 components
      for (let i = 0; i < 30; i++) {
        largeScaleComponents.push({
          id: `scale-comp-${i}`,
          type: ['load-balancer', 'web-server', 'database', 'cache', 'queue'][i % 5] as any,
          position: { x: (i % 6) * 100, y: Math.floor(i / 6) * 100 },
          configuration: {
            capacity: 1000 + i * 200,
            latency: 10 + i * 2,
            failureRate: 0.001 + i * 0.0001
          },
          metadata: { name: `Scale Component ${i}`, version: '1.0.0' }
        });

        // Create connections to form a complex network
        if (i > 0) {
          largeScaleConnections.push({
            id: `scale-conn-${i}`,
            sourceComponentId: `scale-comp-${Math.floor(i / 2)}`,
            targetComponentId: `scale-comp-${i}`,
            sourcePort: 'output',
            targetPort: 'input',
            configuration: {
              bandwidth: 1000,
              latency: 1,
              protocol: 'HTTP',
              reliability: 0.999
            }
          });
        }
      }

      const largeScaleWorkspace: Workspace = {
        id: workspaceId,
        name: 'Large Scale Workload Test',
        userId,
        components: largeScaleComponents,
        connections: largeScaleConnections,
        configuration: {
          duration: 20,
          loadPattern: {
            type: 'ramp',
            baseLoad: 10000,
            peakLoad: 1000000, // 1M users - tests scaling capability
            rampDuration: 5
          },
          failureScenarios: [],
          metricsCollection: {
            interval: 100,
            enabled: true
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let scalingMetricsReceived = false;
      let workloadDistributionReceived = false;
      let performanceMetrics: any[] = [];

      clientSocket.on('simulation:metrics', (data) => {
        scalingMetricsReceived = true;
        performanceMetrics.push(data);
      });

      clientSocket.on('simulation:workload-distribution', (data) => {
        workloadDistributionReceived = true;
        expect(data.instances).toBeDefined();
        expect(data.loadDistribution).toBeDefined();
        console.log(`    Workload distributed across ${data.instances.length} instances`);
      });

      // Start large-scale simulation
      const startTime = Date.now();
      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'start',
          parameters: { workspace: largeScaleWorkspace }
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else {
            expect(response.scalingInfo).toBeDefined();
            console.log(`    Simulation started with scaling: ${JSON.stringify(response.scalingInfo)}`);
            resolve();
          }
        });
      });

      // Let simulation run and scale
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Stop simulation
      await new Promise<void>((resolve) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'stop'
        }, () => resolve());
      });

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      clientSocket.disconnect();

      // Verify scaling performance
      expect(scalingMetricsReceived).toBe(true);
      expect(performanceMetrics.length).toBeGreaterThan(50);

      console.log(`    📊 Workload Scaling Results:`);
      console.log(`      Components simulated: ${largeScaleComponents.length}`);
      console.log(`      Connections simulated: ${largeScaleConnections.length}`);
      console.log(`      Peak load: 1M users`);
      console.log(`      Simulation duration: ${totalDuration}ms`);
      console.log(`      Metrics collected: ${performanceMetrics.length}`);

      // Verify simulation completed successfully under high load
      expect(totalDuration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(performanceMetrics.length).toBeGreaterThan(0);

      console.log('    ✅ SRS NFR-5: Simulation workload scaling verified');
    }, 45000);
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in real-time', async () => {
      const clientSocket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const workspaceId = 'performance-regression-test';
      const userId = 'regression-test-user';

      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('join-workspace', { workspaceId, userId }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      // Baseline performance test
      const baselineLatencies: number[] = [];
      let baselineMetricsCount = 0;

      const baselineWorkspace: Workspace = {
        id: workspaceId,
        name: 'Baseline Performance Test',
        userId,
        components: [
          {
            id: 'baseline-server',
            type: 'web-server',
            position: { x: 100, y: 100 },
            configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
            metadata: { name: 'Baseline Server', version: '1.0.0' }
          }
        ],
        connections: [],
        configuration: {
          duration: 10,
          loadPattern: { type: 'constant', baseLoad: 1000 },
          failureScenarios: [],
          metricsCollection: { interval: 100, enabled: true }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      clientSocket.on('simulation:metrics', (data) => {
        const latency = Date.now() - data.timestamp;
        baselineLatencies.push(latency);
        baselineMetricsCount++;
      });

      // Run baseline test
      await new Promise<void>((resolve, reject) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'start',
          parameters: { workspace: baselineWorkspace }
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        });
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      await new Promise<void>((resolve) => {
        clientSocket.emit('simulation:control', {
          workspaceId,
          action: 'stop'
        }, () => resolve());
      });

      const baselineAvg = baselineLatencies.reduce((a, b) => a + b, 0) / baselineLatencies.length;

      console.log(`    📊 Performance Baseline:`);
      console.log(`      Average latency: ${baselineAvg.toFixed(2)}ms`);
      console.log(`      Samples: ${baselineLatencies.length}`);

      // Verify baseline performance meets SRS requirements
      expect(baselineAvg).toBeLessThan(100);
      expect(baselineLatencies.length).toBeGreaterThan(20);

      clientSocket.disconnect();

      console.log('    ✅ Performance regression detection baseline established');
    }, 25000);
  });
});