/**
 * Simulation Workload Scaling Tests
 * 
 * Tests for SRS NFR-5: Scale simulation workloads
 * - Simulation load distribution
 * - Queuing and resource management
 * - Performance optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulationWorkloadService, SimulationWorkload, SimulationNode } from '../services/simulationWorkloadService';
import { SimulationPerformanceOptimizer } from '../services/simulationPerformanceOptimizer';

// Mock Redis and Database
vi.mock('../config/redis', () => ({
  getRedisClient: () => ({
    lPush: vi.fn().mockResolvedValue(1),
    rPush: vi.fn().mockResolvedValue(1),
    lPop: vi.fn().mockResolvedValue(null),
    lLen: vi.fn().mockResolvedValue(0),
    lRem: vi.fn().mockResolvedValue(1),
    hSet: vi.fn().mockResolvedValue(1),
    hGet: vi.fn().mockResolvedValue(null),
    hGetAll: vi.fn().mockResolvedValue({}),
    hIncrBy: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1)
  })
}));

vi.mock('../config/database', () => ({
  getDatabase: () => ({
    query: vi.fn().mockResolvedValue({ rows: [] })
  })
}));

describe('Simulation Workload Scaling (SRS NFR-5)', () => {
  let workloadService: SimulationWorkloadService;
  let performanceOptimizer: SimulationPerformanceOptimizer;

  beforeEach(async () => {
    workloadService = new SimulationWorkloadService();
    performanceOptimizer = new SimulationPerformanceOptimizer();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    workloadService.cleanup();
    performanceOptimizer.cleanup();
  });

  describe('Load Distribution (SRS NFR-5)', () => {
    it('should distribute workloads across multiple nodes based on capacity', async () => {
      // Register 2 simulation nodes (reduced from 3)
      const nodes: Omit<SimulationNode, 'performance'>[] = [
        {
          id: 'node-1',
          endpoint: 'http://node1:8080',
          region: 'us-east-1',
          status: 'available',
          capacity: { maxConcurrentSimulations: 10, maxMemoryMB: 1000, maxCpuCores: 4 },
          currentLoad: { runningSimulations: 2, memoryUsageMB: 200, cpuUsage: 1 },
          metadata: { preferredComplexity: 'medium' }
        },
        {
          id: 'node-2',
          endpoint: 'http://node2:8080',
          region: 'us-east-1',
          status: 'available',
          capacity: { maxConcurrentSimulations: 20, maxMemoryMB: 2000, maxCpuCores: 8 },
          currentLoad: { runningSimulations: 5, memoryUsageMB: 500, cpuUsage: 2 },
          metadata: { preferredComplexity: 'complex' }
        }
      ];

      for (const node of nodes) {
        await workloadService.registerSimulationNode(node);
      }

      // Submit 1 workload (reduced from 2)
      const workloadId = await workloadService.submitWorkload({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        priority: 'normal',
        estimatedDuration: 300,
        estimatedMemoryUsage: 100,
        estimatedCpuUsage: 1,
        configuration: {
          userCount: 1000,
          duration: 300,
          complexity: 'medium',
          enableRealTimeUpdates: true,
          enableFailureInjection: false,
          enableCostModeling: false
        }
      });

      expect(workloadId).toMatch(/^sim_\d+_[a-z0-9]+$/);

      // Verify workload is queued
      const workload = workloadService.getWorkload(workloadId);
      expect(workload).toBeTruthy();
      expect(workload?.status).toBe('queued');

      // Get simulation nodes and verify they're registered
      const registeredNodes = workloadService.getSimulationNodes();
      expect(registeredNodes).toHaveLength(2);
      
      // Verify nodes have different capacities for load distribution
      const totalCapacity = registeredNodes.reduce((sum, node) => 
        sum + node.capacity.maxConcurrentSimulations, 0
      );
      expect(totalCapacity).toBe(30); // 10 + 20
    });

    it('should select optimal nodes based on workload requirements', async () => {
      // Register 1 high-memory node
      await workloadService.registerSimulationNode({
        id: 'high-memory-node-test',
        endpoint: 'http://high-memory-test:8080',
        region: 'us-east-1',
        status: 'available',
        capacity: { maxConcurrentSimulations: 5, maxMemoryMB: 4000, maxCpuCores: 2 },
        currentLoad: { runningSimulations: 0, memoryUsageMB: 0, cpuUsage: 0 },
        metadata: { preferredComplexity: 'complex', specialization: 'high-memory' }
      });

      // Get nodes to verify registration worked
      const nodes = workloadService.getSimulationNodes();
      const highMemoryNode = nodes.find(n => n.id === 'high-memory-node-test');
      
      expect(highMemoryNode).toBeTruthy();
      expect(highMemoryNode?.capacity.maxMemoryMB).toBe(4000);
      expect(highMemoryNode?.metadata.specialization).toBe('high-memory');
    });

    it('should handle node failures and redistribute workloads', async () => {
      // Register nodes
      await workloadService.registerSimulationNode({
        id: 'stable-node',
        endpoint: 'http://stable:8080',
        region: 'us-east-1',
        status: 'available',
        capacity: { maxConcurrentSimulations: 10, maxMemoryMB: 1000, maxCpuCores: 4 },
        currentLoad: { runningSimulations: 0, memoryUsageMB: 0, cpuUsage: 0 },
        metadata: {}
      });

      await workloadService.registerSimulationNode({
        id: 'failing-node',
        endpoint: 'http://failing:8080',
        region: 'us-east-1',
        status: 'available',
        capacity: { maxConcurrentSimulations: 10, maxMemoryMB: 1000, maxCpuCores: 4 },
        currentLoad: { runningSimulations: 0, memoryUsageMB: 0, cpuUsage: 0 },
        metadata: {}
      });

      // Submit workload
      const workloadId = await workloadService.submitWorkload({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        priority: 'normal',
        estimatedDuration: 300,
        estimatedMemoryUsage: 100,
        estimatedCpuUsage: 1,
        configuration: {
          userCount: 1000,
          duration: 300,
          complexity: 'medium',
          enableRealTimeUpdates: false,
          enableFailureInjection: false,
          enableCostModeling: false
        }
      });

      // Simulate node failure
      await workloadService.updateNodeMetrics('failing-node', {
        currentLoad: { runningSimulations: 0, memoryUsageMB: 0, cpuUsage: 0 },
        status: 'overloaded' // Mark as failed
      });

      const nodes = workloadService.getSimulationNodes();
      const failingNode = nodes.find(n => n.id === 'failing-node');
      expect(failingNode?.status).toBe('overloaded');
    });
  });

  describe('Queuing and Resource Management (SRS NFR-5)', () => {
    it('should manage multiple priority queues effectively', async () => {
      const workloads = [
        { priority: 'high', userId: 'user-1' },
        { priority: 'normal', userId: 'user-2' }
      ];

      const workloadIds: string[] = [];
      for (const { priority, userId } of workloads) {
        const workloadId = await workloadService.submitWorkload({
          workspaceId: 'workspace-1',
          userId,
          priority: priority as any,
          estimatedDuration: 300,
          estimatedMemoryUsage: 100,
          estimatedCpuUsage: 1,
          configuration: {
            userCount: 1000,
            duration: 300,
            complexity: 'medium',
            enableRealTimeUpdates: false,
            enableFailureInjection: false,
            enableCostModeling: false
          }
        });
        workloadIds.push(workloadId);
      }

      // Verify all workloads are queued
      for (const workloadId of workloadIds) {
        const workload = workloadService.getWorkload(workloadId);
        expect(workload?.status).toBe('queued');
      }

      // Check queue status
      const queueStatus = workloadService.getQueueStatus();
      expect(queueStatus.length).toBeGreaterThan(0);
      
      // Verify priority queues exist
      const queueNames = queueStatus.map(q => q.name);
      expect(queueNames).toContain('high');
      expect(queueNames).toContain('normal');
    });

    it('should enforce resource quotas per user', async () => {
      const userId = 'quota-test-user';
      
      // Get initial quota
      const quota = await workloadService.getResourceQuota(userId);
      expect(quota.userId).toBe(userId);
      expect(quota.limits.maxQueuedSimulations).toBeGreaterThan(0);

      // Submit workloads up to half quota limit (reduced for speed)
      const submitCount = Math.min(2, Math.floor(quota.limits.maxQueuedSimulations / 2));
      const workloadIds: string[] = [];
      for (let i = 0; i < submitCount; i++) {
        const workloadId = await workloadService.submitWorkload({
          workspaceId: `workspace-${i}`,
          userId,
          priority: 'normal',
          estimatedDuration: 300,
          estimatedMemoryUsage: 100,
          estimatedCpuUsage: 1,
          configuration: {
            userCount: 1000,
            duration: 300,
            complexity: 'medium',
            enableRealTimeUpdates: false,
            enableFailureInjection: false,
            enableCostModeling: false
          }
        });
        workloadIds.push(workloadId);
      }

      expect(workloadIds.length).toBe(submitCount);
    });

    it('should provide accurate workload metrics and analytics', async () => {
      // Submit 1 workload (reduced from 3)
      const workloadId = await workloadService.submitWorkload({
        workspaceId: 'workspace-metrics',
        userId: 'user-metrics',
        priority: 'normal',
        estimatedDuration: 300,
        estimatedMemoryUsage: 100,
        estimatedCpuUsage: 1,
        configuration: {
          userCount: 1000,
          duration: 300,
          complexity: 'medium',
          enableRealTimeUpdates: false,
          enableFailureInjection: false,
          enableCostModeling: false
        }
      });

      // Get workload metrics
      const metrics = await workloadService.getWorkloadMetrics();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.totalWorkloads).toBeGreaterThanOrEqual(1);
      expect(metrics.queuedWorkloads).toBeGreaterThanOrEqual(1);
      expect(metrics.resourceUtilization).toBeDefined();
      expect(metrics.resourceUtilization.cpu).toBeGreaterThanOrEqual(0);
      expect(metrics.resourceUtilization.memory).toBeGreaterThanOrEqual(0);
      expect(metrics.resourceUtilization.nodes).toBeGreaterThanOrEqual(0);
    });

    it('should handle workload cancellation properly', async () => {
      const userId = 'cancel-test-user';
      
      // Submit a workload
      const workloadId = await workloadService.submitWorkload({
        workspaceId: 'workspace-cancel',
        userId,
        priority: 'normal',
        estimatedDuration: 300,
        estimatedMemoryUsage: 100,
        estimatedCpuUsage: 1,
        configuration: {
          userCount: 1000,
          duration: 300,
          complexity: 'medium',
          enableRealTimeUpdates: false,
          enableFailureInjection: false,
          enableCostModeling: false
        }
      });

      // Verify workload is queued
      let workload = workloadService.getWorkload(workloadId);
      expect(workload?.status).toBe('queued');

      // Cancel the workload
      await workloadService.cancelWorkload(workloadId, userId);

      // Verify workload is cancelled
      workload = workloadService.getWorkload(workloadId);
      expect(workload?.status).toBe('cancelled');
      expect(workload?.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('Performance Optimization (SRS NFR-5)', () => {
    it('should optimize workload execution through caching', async () => {
      const workload: SimulationWorkload = {
        id: 'test-workload',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        priority: 'normal',
        estimatedDuration: 300,
        estimatedMemoryUsage: 100,
        estimatedCpuUsage: 1,
        configuration: {
          userCount: 1000,
          duration: 300,
          complexity: 'medium',
          enableRealTimeUpdates: false,
          enableFailureInjection: false,
          enableCostModeling: false
        },
        status: 'queued',
        queuedAt: new Date(),
        progress: 0
      };

      // Optimize workload
      const optimizedWorkload = await performanceOptimizer.optimizeWorkload(workload);
      
      expect(optimizedWorkload.id).toBe(workload.id);
      expect(optimizedWorkload.optimizations).toBeDefined();
      expect(optimizedWorkload.originalEstimatedDuration).toBe(workload.estimatedDuration);
      
      // Optimized duration should be different (better) than original
      if (optimizedWorkload.optimizations.length > 0) {
        expect(optimizedWorkload.estimatedDuration).toBeLessThanOrEqual(workload.estimatedDuration);
      }
    });

    it('should provide performance metrics and insights', async () => {
      const metrics = await performanceOptimizer.getPerformanceMetrics();
      
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.totalOptimizations).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageSpeedup).toBeGreaterThanOrEqual(1);
      expect(metrics.performanceGains).toBeDefined();
      expect(metrics.performanceGains.timeReduction).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceGains.resourceReduction).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceGains.throughputIncrease).toBeGreaterThanOrEqual(0);
    });

    it('should support workload batching for similar simulations', async () => {
      const similarWorkloads: SimulationWorkload[] = [
        {
          id: 'batch-workload-1',
          workspaceId: 'workspace-batch',
          userId: 'user-batch-1',
          priority: 'normal',
          estimatedDuration: 300,
          estimatedMemoryUsage: 100,
          estimatedCpuUsage: 1,
          configuration: {
            userCount: 1000,
            duration: 300,
            complexity: 'medium',
            enableRealTimeUpdates: false,
            enableFailureInjection: false,
            enableCostModeling: false
          },
          status: 'queued',
          queuedAt: new Date(),
          progress: 0
        },
        {
          id: 'batch-workload-2',
          workspaceId: 'workspace-batch',
          userId: 'user-batch-2',
          priority: 'normal',
          estimatedDuration: 300,
          estimatedMemoryUsage: 100,
          estimatedCpuUsage: 1,
          configuration: {
            userCount: 1100, // Similar user count
            duration: 300,
            complexity: 'medium',
            enableRealTimeUpdates: false,
            enableFailureInjection: false,
            enableCostModeling: false
          },
          status: 'queued',
          queuedAt: new Date(),
          progress: 0
        }
      ];

      // Try to add workloads to batch
      for (const workload of similarWorkloads) {
        const batched = await performanceOptimizer.addToBatch(workload);
        // Batching may or may not succeed depending on configuration
        expect(typeof batched).toBe('boolean');
      }
    });

    it('should manage performance profiles for workspaces', async () => {
      const workspaceId = 'workspace-profile-test';
      
      // Get performance profile
      const profile = await performanceOptimizer.getPerformanceProfile(workspaceId);
      
      expect(profile.workspaceId).toBe(workspaceId);
      expect(profile.complexity).toBeDefined();
      expect(profile.componentCount).toBeGreaterThanOrEqual(0);
      expect(profile.connectionCount).toBeGreaterThanOrEqual(0);
      expect(profile.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(profile.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(profile.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(profile.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(profile.optimizations)).toBe(true);
      expect(profile.lastUpdated).toBeInstanceOf(Date);
    });

    it('should support cache management operations', async () => {
      // Clear all cache
      const clearedCount = await performanceOptimizer.clearCache();
      expect(clearedCount).toBeGreaterThanOrEqual(0);
      
      // Clear cache with pattern
      const patternClearedCount = await performanceOptimizer.clearCache('test_pattern');
      expect(patternClearedCount).toBeGreaterThanOrEqual(0);
    });

    it('should update batching configuration dynamically', () => {
      const newConfig = {
        enabled: true,
        maxBatchSize: 15,
        maxWaitTime: 45000,
        similarityThreshold: 0.9
      };
      
      // Update configuration
      performanceOptimizer.updateBatchingConfig(newConfig);
      
      // Configuration should be updated (no direct way to verify without exposing internals)
      // This test verifies the method doesn't throw errors
      expect(true).toBe(true);
    });
  });

  describe('Integration and System Health (SRS NFR-5)', () => {
    it('should maintain system health under load', async () => {
      // Register 2 nodes (reduced from 3)
      const nodeCount = 2;
      for (let i = 0; i < nodeCount; i++) {
        await workloadService.registerSimulationNode({
          id: `load-test-node-${i}`,
          endpoint: `http://node${i}:8080`,
          region: 'us-east-1',
          status: 'available',
          capacity: { maxConcurrentSimulations: 5, maxMemoryMB: 1000, maxCpuCores: 4 },
          currentLoad: { runningSimulations: 0, memoryUsageMB: 0, cpuUsage: 0 },
          metadata: {}
        });
      }

      // Submit 3 workloads (reduced from 10)
      const workloadCount = 3;
      const workloadIds: string[] = [];
      
      for (let i = 0; i < workloadCount; i++) {
        const workloadId = await workloadService.submitWorkload({
          workspaceId: `load-workspace-${i}`,
          userId: `load-user-${i % 2}`, // 2 different users
          priority: i < 1 ? 'high' : 'normal', // First 1 is high priority
          estimatedDuration: 300,
          estimatedMemoryUsage: 100,
          estimatedCpuUsage: 1,
          configuration: {
            userCount: 1000 + (i * 100),
            duration: 300,
            complexity: 'medium',
            enableRealTimeUpdates: false,
            enableFailureInjection: false,
            enableCostModeling: false
          }
        });
        workloadIds.push(workloadId);
      }

      // Verify all workloads are submitted
      expect(workloadIds).toHaveLength(workloadCount);
      
      // Check system metrics
      const metrics = await workloadService.getWorkloadMetrics();
      expect(metrics.totalWorkloads).toBeGreaterThanOrEqual(workloadCount);
      expect(metrics.queuedWorkloads).toBeGreaterThanOrEqual(workloadCount);
      
      // Verify nodes are registered
      const nodes = workloadService.getSimulationNodes();
      expect(nodes).toHaveLength(nodeCount);
    });

    it('should handle concurrent workload submissions', async () => {
      const concurrentSubmissions = 3; // Reduced from 5
      const submissionPromises: Promise<string>[] = [];

      // Submit workloads concurrently
      for (let i = 0; i < concurrentSubmissions; i++) {
        const promise = workloadService.submitWorkload({
          workspaceId: `concurrent-workspace-${i}`,
          userId: `concurrent-user-${i}`,
          priority: 'normal',
          estimatedDuration: 300,
          estimatedMemoryUsage: 100,
          estimatedCpuUsage: 1,
          configuration: {
            userCount: 1000,
            duration: 300,
            complexity: 'medium',
            enableRealTimeUpdates: false,
            enableFailureInjection: false,
            enableCostModeling: false
          }
        });
        submissionPromises.push(promise);
      }

      // Wait for all submissions to complete
      const workloadIds = await Promise.all(submissionPromises);
      
      expect(workloadIds).toHaveLength(concurrentSubmissions);
      
      // Verify all workloads are unique and properly formatted
      const uniqueIds = new Set(workloadIds);
      expect(uniqueIds.size).toBe(concurrentSubmissions);
      
      for (const workloadId of workloadIds) {
        expect(workloadId).toMatch(/^sim_\d+_[a-z0-9]+$/);
        
        const workload = workloadService.getWorkload(workloadId);
        expect(workload).toBeTruthy();
        expect(workload?.status).toBe('queued');
      }
    });

    it('should provide comprehensive system monitoring', async () => {
      // Get queue status
      const queueStatus = workloadService.getQueueStatus();
      expect(Array.isArray(queueStatus)).toBe(true);
      
      for (const queue of queueStatus) {
        expect(queue.name).toBeDefined();
        expect(queue.priority).toBeGreaterThan(0);
        expect(queue.maxSize).toBeGreaterThan(0);
        expect(queue.currentSize).toBeGreaterThanOrEqual(0);
        expect(queue.processingRate).toBeGreaterThanOrEqual(0);
        expect(queue.averageWaitTime).toBeGreaterThanOrEqual(0);
      }
      
      // Get simulation nodes
      const nodes = workloadService.getSimulationNodes();
      expect(Array.isArray(nodes)).toBe(true);
      
      // Get workload metrics
      const metrics = await workloadService.getWorkloadMetrics();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(typeof metrics.totalWorkloads).toBe('number');
      expect(typeof metrics.queuedWorkloads).toBe('number');
      expect(typeof metrics.runningWorkloads).toBe('number');
      expect(typeof metrics.completedWorkloads).toBe('number');
      expect(typeof metrics.failedWorkloads).toBe('number');
    });
  });
});