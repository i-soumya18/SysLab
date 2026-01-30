/**
 * End-to-End Integration Test
 * Tests complete system integration between frontend and backend
 */

const { spawn } = require('child_process');
const axios = require('axios');
const { io } = require('socket.io-client');

// Test configuration
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5174;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const WEBSOCKET_URL = `http://localhost:${BACKEND_PORT}`;

// Test timeout
const TEST_TIMEOUT = 30000;

class E2ETestRunner {
  constructor() {
    this.backendProcess = null;
    this.frontendProcess = null;
    this.testResults = [];
  }

  async runTests() {
    console.log('🚀 Starting End-to-End Integration Tests...\n');

    try {
      // Start backend and frontend servers
      await this.startServers();
      
      // Wait for servers to be ready
      await this.waitForServers();
      
      // Run test suites
      await this.runTestSuite('Backend Health Check', this.testBackendHealth.bind(this));
      await this.runTestSuite('Frontend Accessibility', this.testFrontendAccessibility.bind(this));
      await this.runTestSuite('WebSocket Connection', this.testWebSocketConnection.bind(this));
      await this.runTestSuite('Complete Workflow', this.testCompleteWorkflow.bind(this));
      await this.runTestSuite('Multi-User Scenario', this.testMultiUserScenario.bind(this));
      await this.runTestSuite('Error Recovery', this.testErrorRecovery.bind(this));
      
      // Print results
      this.printResults();
      
    } catch (error) {
      console.error('❌ E2E Test Suite Failed:', error.message);
      process.exit(1);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  async startServers() {
    console.log('📦 Starting backend server...');
    this.backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: './backend',
      stdio: 'pipe',
      env: { ...process.env, PORT: BACKEND_PORT }
    });

    console.log('🎨 Starting frontend server...');
    this.frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: './frontend',
      stdio: 'pipe',
      env: { ...process.env, PORT: FRONTEND_PORT }
    });

    // Log server outputs for debugging
    this.backendProcess.stdout.on('data', (data) => {
      if (process.env.DEBUG) console.log(`Backend: ${data}`);
    });

    this.frontendProcess.stdout.on('data', (data) => {
      if (process.env.DEBUG) console.log(`Frontend: ${data}`);
    });
  }

  async waitForServers() {
    console.log('⏳ Waiting for servers to be ready...');
    
    // Wait for backend
    await this.waitForUrl(BACKEND_URL + '/health', 'Backend');
    
    // Wait for frontend (check if Vite dev server is running)
    await this.waitForUrl(FRONTEND_URL, 'Frontend');
    
    console.log('✅ Servers are ready!\n');
  }

  async waitForUrl(url, serviceName, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(url, { timeout: 2000 });
        console.log(`✅ ${serviceName} is ready`);
        return;
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw new Error(`${serviceName} failed to start after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async runTestSuite(name, testFunction) {
    console.log(`🧪 Running: ${name}`);
    const startTime = Date.now();
    
    try {
      await Promise.race([
        testFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
        )
      ]);
      
      const duration = Date.now() - startTime;
      this.testResults.push({ name, status: 'PASS', duration });
      console.log(`✅ ${name} - PASSED (${duration}ms)\n`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({ name, status: 'FAIL', duration, error: error.message });
      console.log(`❌ ${name} - FAILED (${duration}ms): ${error.message}\n`);
    }
  }

  async testBackendHealth() {
    // Test health endpoint
    const response = await axios.get(`${BACKEND_URL}/health`);
    
    if (response.status !== 200) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    
    if (!response.data.status || response.data.status !== 'ok') {
      throw new Error('Health check returned invalid status');
    }
    
    console.log('  ✓ Health endpoint responding correctly');
  }

  async testFrontendAccessibility() {
    // Test that frontend is serving content
    const response = await axios.get(FRONTEND_URL);
    
    if (response.status !== 200) {
      throw new Error(`Frontend not accessible, status: ${response.status}`);
    }
    
    // Check for basic HTML structure
    if (!response.data.includes('<div id="root">')) {
      throw new Error('Frontend HTML structure not found');
    }
    
    console.log('  ✓ Frontend is accessible and serving content');
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const socket = io(WEBSOCKET_URL, {
        timeout: 5000,
        forceNew: true
      });

      let connectionEstablished = false;
      let pingReceived = false;

      socket.on('connect', () => {
        console.log('  ✓ WebSocket connected successfully');
        connectionEstablished = true;
        
        // Test ping functionality
        socket.emit('ping', (response) => {
          if (response && response.pong) {
            console.log('  ✓ WebSocket ping/pong working');
            pingReceived = true;
            
            if (connectionEstablished && pingReceived) {
              socket.disconnect();
              resolve();
            }
          } else {
            reject(new Error('Ping response invalid'));
          }
        });
      });

      socket.on('connection:established', (data) => {
        console.log('  ✓ Connection establishment event received');
      });

      socket.on('connect_error', (error) => {
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });

      socket.on('disconnect', () => {
        if (connectionEstablished && pingReceived) {
          console.log('  ✓ WebSocket disconnected cleanly');
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!connectionEstablished) {
          socket.disconnect();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  async testCompleteWorkflow() {
    return new Promise((resolve, reject) => {
      const socket = io(WEBSOCKET_URL, { forceNew: true });
      const workspaceId = 'e2e-test-workspace';
      const userId = 'e2e-test-user';

      let workspaceJoined = false;
      let canvasUpdated = false;
      let simulationStarted = false;
      let metricsReceived = false;

      socket.on('connect', () => {
        console.log('  ✓ Connected for workflow test');
        
        // Step 1: Join workspace
        socket.emit('join-workspace', { workspaceId, userId }, (response) => {
          if (response.error) {
            reject(new Error(`Failed to join workspace: ${response.error}`));
            return;
          }
          
          console.log('  ✓ Joined workspace successfully');
          workspaceJoined = true;
          
          // Step 2: Update canvas
          socket.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: {
              id: 'test-component',
              type: 'web-server',
              position: { x: 100, y: 100 },
              configuration: { capacity: 1000, latency: 50, failureRate: 0.001 },
              metadata: { name: 'Test Server', version: '1.0.0' }
            }
          }, (response) => {
            if (response.error) {
              reject(new Error(`Canvas update failed: ${response.error}`));
              return;
            }
            
            console.log('  ✓ Canvas updated successfully');
            canvasUpdated = true;
            
            // Step 3: Start simulation
            const testWorkspace = {
              id: workspaceId,
              name: 'E2E Test Workspace',
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
                duration: 10,
                loadPattern: { type: 'constant', baseLoad: 50 },
                failureScenarios: [],
                metricsCollection: { interval: 1000, enabled: true }
              },
              createdAt: new Date(),
              updatedAt: new Date()
            };

            socket.emit('simulation:control', {
              workspaceId,
              action: 'start',
              parameters: { workspace: testWorkspace }
            }, (response) => {
              if (response.error) {
                reject(new Error(`Simulation start failed: ${response.error}`));
                return;
              }
              
              console.log('  ✓ Simulation started successfully');
              simulationStarted = true;
            });
          });
        });
      });

      // Listen for simulation events
      socket.on('simulation:started', () => {
        console.log('  ✓ Simulation started event received');
      });

      socket.on('simulation:metrics', (data) => {
        console.log('  ✓ Simulation metrics received');
        metricsReceived = true;
        
        // Stop simulation after receiving metrics
        setTimeout(() => {
          socket.emit('simulation:control', {
            workspaceId,
            action: 'stop'
          }, (response) => {
            if (response.error) {
              reject(new Error(`Simulation stop failed: ${response.error}`));
              return;
            }
            
            console.log('  ✓ Simulation stopped successfully');
            
            // Check if all steps completed
            if (workspaceJoined && canvasUpdated && simulationStarted && metricsReceived) {
              socket.disconnect();
              resolve();
            }
          });
        }, 2000);
      });

      socket.on('connect_error', (error) => {
        reject(new Error(`Workflow test connection failed: ${error.message}`));
      });

      // Timeout
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Complete workflow test timeout'));
      }, 20000);
    });
  }

  async testMultiUserScenario() {
    return new Promise((resolve, reject) => {
      const socket1 = io(WEBSOCKET_URL, { forceNew: true });
      const socket2 = io(WEBSOCKET_URL, { forceNew: true });
      const workspaceId = 'e2e-multi-user-workspace';

      let user1Connected = false;
      let user2Connected = false;
      let user1ReceivedUpdate = false;
      let user2ReceivedUpdate = false;

      // User 1 setup
      socket1.on('connect', () => {
        socket1.emit('join-workspace', { workspaceId, userId: 'user1' }, (response) => {
          if (response.error) {
            reject(new Error(`User 1 failed to join: ${response.error}`));
            return;
          }
          user1Connected = true;
          console.log('  ✓ User 1 connected and joined workspace');
        });
      });

      socket1.on('canvas:update', (data) => {
        if (data.updatedBy === 'user2') {
          user1ReceivedUpdate = true;
          console.log('  ✓ User 1 received update from User 2');
          checkCompletion();
        }
      });

      // User 2 setup
      socket2.on('connect', () => {
        socket2.emit('join-workspace', { workspaceId, userId: 'user2' }, (response) => {
          if (response.error) {
            reject(new Error(`User 2 failed to join: ${response.error}`));
            return;
          }
          user2Connected = true;
          console.log('  ✓ User 2 connected and joined workspace');
          
          // User 2 makes a canvas update
          setTimeout(() => {
            socket2.emit('canvas:update', {
              workspaceId,
              type: 'component-added',
              data: { id: 'user2-component', type: 'database' }
            }, (response) => {
              if (response.error) {
                reject(new Error(`User 2 canvas update failed: ${response.error}`));
                return;
              }
              console.log('  ✓ User 2 made canvas update');
            });
          }, 1000);
        });
      });

      socket2.on('canvas:update', (data) => {
        if (data.updatedBy === 'user1') {
          user2ReceivedUpdate = true;
          console.log('  ✓ User 2 received update from User 1');
          checkCompletion();
        }
      });

      // User 1 makes an update after User 2 joins
      setTimeout(() => {
        if (user1Connected && user2Connected) {
          socket1.emit('canvas:update', {
            workspaceId,
            type: 'component-added',
            data: { id: 'user1-component', type: 'load-balancer' }
          }, (response) => {
            if (response.error) {
              reject(new Error(`User 1 canvas update failed: ${response.error}`));
              return;
            }
            console.log('  ✓ User 1 made canvas update');
          });
        }
      }, 2000);

      function checkCompletion() {
        if (user1ReceivedUpdate && user2ReceivedUpdate) {
          console.log('  ✓ Multi-user communication successful');
          socket1.disconnect();
          socket2.disconnect();
          resolve();
        }
      }

      // Timeout
      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();
        reject(new Error('Multi-user test timeout'));
      }, 15000);
    });
  }

  async testErrorRecovery() {
    return new Promise((resolve, reject) => {
      const socket = io(WEBSOCKET_URL, { forceNew: true });

      socket.on('connect', () => {
        console.log('  ✓ Connected for error recovery test');
        
        // Test 1: Invalid workspace join
        socket.emit('join-workspace', { workspaceId: '' }, (response) => {
          if (!response.error) {
            reject(new Error('Expected error for invalid workspace ID'));
            return;
          }
          console.log('  ✓ Invalid workspace join properly rejected');
          
          // Test 2: Unauthorized simulation control
          socket.emit('simulation:control', {
            workspaceId: 'unauthorized-workspace',
            action: 'start'
          }, (response) => {
            if (!response.error) {
              reject(new Error('Expected error for unauthorized simulation control'));
              return;
            }
            console.log('  ✓ Unauthorized simulation control properly rejected');
            
            // Test 3: Invalid canvas update
            socket.emit('canvas:update', {
              workspaceId: 'unauthorized-workspace',
              type: 'invalid-type',
              data: {}
            }, (response) => {
              if (!response.error) {
                reject(new Error('Expected error for unauthorized canvas update'));
                return;
              }
              console.log('  ✓ Unauthorized canvas update properly rejected');
              
              socket.disconnect();
              resolve();
            });
          });
        });
      });

      socket.on('connect_error', (error) => {
        reject(new Error(`Error recovery test connection failed: ${error.message}`));
      });

      // Timeout
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Error recovery test timeout'));
      }, 10000);
    });
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.name} (${result.duration}ms)`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.status === 'PASS') passed++;
      else failed++;
    });
    
    console.log('=' .repeat(50));
    console.log(`Total: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Some tests failed. Check the output above for details.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! System integration is working correctly.');
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.backendProcess) {
      this.backendProcess.kill('SIGTERM');
      console.log('✅ Backend server stopped');
    }
    
    if (this.frontendProcess) {
      this.frontendProcess.kill('SIGTERM');
      console.log('✅ Frontend server stopped');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = E2ETestRunner;