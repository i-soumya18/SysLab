/**
 * Simulation Workload API Service
 * 
 * Provides REST API endpoints for simulation workload management
 * Implements SRS NFR-5: Scale simulation workloads
 */

import { Request, Response } from 'express';
import { SimulationWorkloadService, SimulationWorkload } from './simulationWorkloadService';
import { SimulationPerformanceOptimizer } from './simulationPerformanceOptimizer';

export class SimulationWorkloadApiService {
  private workloadService: SimulationWorkloadService;
  private performanceOptimizer: SimulationPerformanceOptimizer;

  constructor(
    workloadService: SimulationWorkloadService,
    performanceOptimizer: SimulationPerformanceOptimizer
  ) {
    this.workloadService = workloadService;
    this.performanceOptimizer = performanceOptimizer;
  }

  // Workload Management Endpoints

  /**
   * Submit a simulation workload
   */
  async submitWorkload(req: Request, res: Response): Promise<void> {
    try {
      const {
        workspaceId,
        priority = 'normal',
        estimatedDuration,
        estimatedMemoryUsage,
        estimatedCpuUsage,
        configuration
      } = req.body;

      if (!workspaceId || !estimatedDuration || !configuration) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS',
          required: ['workspaceId', 'estimatedDuration', 'configuration']
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const workload: Omit<SimulationWorkload, 'id' | 'status' | 'queuedAt' | 'progress'> = {
        workspaceId,
        userId: req.user.id,
        priority,
        estimatedDuration: parseInt(estimatedDuration),
        estimatedMemoryUsage: parseInt(estimatedMemoryUsage) || 100,
        estimatedCpuUsage: parseInt(estimatedCpuUsage) || 1,
        configuration: {
          userCount: configuration.userCount || 100,
          duration: configuration.duration || 300,
          complexity: configuration.complexity || 'medium',
          enableRealTimeUpdates: configuration.enableRealTimeUpdates || false,
          enableFailureInjection: configuration.enableFailureInjection || false,
          enableCostModeling: configuration.enableCostModeling || false
        }
      };

      const workloadId = await this.workloadService.submitWorkload(workload);

      res.status(201).json({
        success: true,
        workloadId,
        message: 'Simulation workload submitted successfully'
      });

    } catch (error) {
      console.error('Submit workload error:', error);
      
      if (error instanceof Error && error.message.includes('quota exceeded')) {
        res.status(429).json({
          error: 'Resource quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to submit workload',
          code: 'SUBMISSION_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Get workload status
   */
  async getWorkload(req: Request, res: Response): Promise<void> {
    try {
      const { workloadId } = req.params;

      if (!workloadId) {
        res.status(400).json({
          error: 'Workload ID is required',
          code: 'MISSING_WORKLOAD_ID'
        });
        return;
      }

      const workload = this.workloadService.getWorkload(workloadId);

      if (!workload) {
        res.status(404).json({
          error: 'Workload not found',
          code: 'WORKLOAD_NOT_FOUND',
          workloadId
        });
        return;
      }

      // Check access permissions
      if (req.user && workload.userId !== req.user.id) {
        res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      res.json({
        success: true,
        workload
      });

    } catch (error) {
      console.error('Get workload error:', error);
      res.status(500).json({
        error: 'Failed to get workload',
        code: 'GET_WORKLOAD_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cancel a workload
   */
  async cancelWorkload(req: Request, res: Response): Promise<void> {
    try {
      const { workloadId } = req.params;

      if (!workloadId) {
        res.status(400).json({
          error: 'Workload ID is required',
          code: 'MISSING_WORKLOAD_ID'
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      await this.workloadService.cancelWorkload(workloadId, req.user.id);

      res.json({
        success: true,
        message: 'Workload cancelled successfully'
      });

    } catch (error) {
      console.error('Cancel workload error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            error: 'Workload not found',
            code: 'WORKLOAD_NOT_FOUND'
          });
        } else if (error.message.includes('Access denied')) {
          res.status(403).json({
            error: 'Access denied',
            code: 'ACCESS_DENIED'
          });
        } else if (error.message.includes('Cannot cancel')) {
          res.status(400).json({
            error: 'Cannot cancel workload',
            code: 'CANNOT_CANCEL',
            details: error.message
          });
        } else {
          res.status(500).json({
            error: 'Failed to cancel workload',
            code: 'CANCEL_ERROR',
            details: error.message
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to cancel workload',
          code: 'CANCEL_ERROR'
        });
      }
    }
  }

  /**
   * Get user's workloads
   */
  async getUserWorkloads(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const { status, limit = '50', offset = '0' } = req.query;
      
      let workloads = this.workloadService.getUserWorkloads(
        req.user.id,
        status as SimulationWorkload['status']
      );

      // Apply pagination
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      const total = workloads.length;
      
      workloads = workloads.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        workloads,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < total
        }
      });

    } catch (error) {
      console.error('Get user workloads error:', error);
      res.status(500).json({
        error: 'Failed to get user workloads',
        code: 'GET_WORKLOADS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Node Management Endpoints

  /**
   * Register a simulation node
   */
  async registerSimulationNode(req: Request, res: Response): Promise<void> {
    try {
      const { id, endpoint, region, status, capacity, currentLoad, metadata } = req.body;

      if (!id || !endpoint || !region || !status || !capacity) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS',
          required: ['id', 'endpoint', 'region', 'status', 'capacity']
        });
        return;
      }

      await this.workloadService.registerSimulationNode({
        id,
        endpoint,
        region,
        status,
        capacity: {
          maxConcurrentSimulations: capacity.maxConcurrentSimulations || 10,
          maxMemoryMB: capacity.maxMemoryMB || 1000,
          maxCpuCores: capacity.maxCpuCores || 4
        },
        currentLoad: currentLoad || {
          runningSimulations: 0,
          memoryUsageMB: 0,
          cpuUsage: 0
        },
        metadata: metadata || {}
      });

      res.status(201).json({
        success: true,
        message: 'Simulation node registered successfully'
      });

    } catch (error) {
      console.error('Register simulation node error:', error);
      res.status(500).json({
        error: 'Failed to register simulation node',
        code: 'REGISTRATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update node metrics
   */
  async updateNodeMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { currentLoad, performance, status } = req.body;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required',
          code: 'MISSING_NODE_ID'
        });
      }

      if (!currentLoad) {
        res.status(400).json({
          error: 'Current load metrics are required',
          code: 'MISSING_METRICS'
        });
        return;
      }

      await this.workloadService.updateNodeMetrics(nodeId, {
        currentLoad,
        performance,
        status
      });

      res.json({
        success: true,
        message: 'Node metrics updated successfully'
      });

    } catch (error) {
      console.error('Update node metrics error:', error);
      res.status(500).json({
        error: 'Failed to update node metrics',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get simulation nodes
   */
  async getSimulationNodes(req: Request, res: Response): Promise<void> {
    try {
      const nodes = this.workloadService.getSimulationNodes();

      res.json({
        success: true,
        nodes,
        count: nodes.length
      });

    } catch (error) {
      console.error('Get simulation nodes error:', error);
      res.status(500).json({
        error: 'Failed to get simulation nodes',
        code: 'GET_NODES_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Metrics and Analytics Endpoints

  /**
   * Get workload metrics
   */
  async getWorkloadMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.workloadService.getWorkloadMetrics();

      res.json({
        success: true,
        metrics
      });

    } catch (error) {
      console.error('Get workload metrics error:', error);
      res.status(500).json({
        error: 'Failed to get workload metrics',
        code: 'METRICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      const queues = this.workloadService.getQueueStatus();

      res.json({
        success: true,
        queues
      });

    } catch (error) {
      console.error('Get queue status error:', error);
      res.status(500).json({
        error: 'Failed to get queue status',
        code: 'QUEUE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get resource quota
   */
  async getResourceQuota(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const quota = await this.workloadService.getResourceQuota(req.user.id);

      res.json({
        success: true,
        quota
      });

    } catch (error) {
      console.error('Get resource quota error:', error);
      res.status(500).json({
        error: 'Failed to get resource quota',
        code: 'QUOTA_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Performance Optimization Endpoints

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.performanceOptimizer.getPerformanceMetrics();

      res.json({
        success: true,
        metrics
      });

    } catch (error) {
      console.error('Get performance metrics error:', error);
      res.status(500).json({
        error: 'Failed to get performance metrics',
        code: 'PERFORMANCE_METRICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get performance profile
   */
  async getPerformanceProfile(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        res.status(400).json({
          error: 'Workspace ID is required',
          code: 'MISSING_WORKSPACE_ID'
        });
        return;
      }

      const profile = await this.performanceOptimizer.getPerformanceProfile(workspaceId);

      res.json({
        success: true,
        profile
      });

    } catch (error) {
      console.error('Get performance profile error:', error);
      res.status(500).json({
        error: 'Failed to get performance profile',
        code: 'PROFILE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update batching configuration
   */
  async updateBatchingConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;

      this.performanceOptimizer.updateBatchingConfig(config);

      res.json({
        success: true,
        message: 'Batching configuration updated successfully'
      });

    } catch (error) {
      console.error('Update batching config error:', error);
      res.status(500).json({
        error: 'Failed to update batching configuration',
        code: 'CONFIG_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear cache
   */
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      const { pattern } = req.query;

      const clearedCount = await this.performanceOptimizer.clearCache(pattern as string);

      res.json({
        success: true,
        message: 'Cache cleared successfully',
        clearedCount
      });

    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        code: 'CACHE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Dashboard Endpoints

  /**
   * Get simulation workload dashboard
   */
  async getWorkloadDashboard(req: Request, res: Response): Promise<void> {
    try {
      const [
        workloadMetrics,
        queueStatus,
        simulationNodes,
        performanceMetrics
      ] = await Promise.all([
        this.workloadService.getWorkloadMetrics(),
        this.workloadService.getQueueStatus(),
        this.workloadService.getSimulationNodes(),
        this.performanceOptimizer.getPerformanceMetrics()
      ]);

      // Get user-specific data if authenticated
      let userQuota = null;
      let userWorkloads = null;
      
      if (req.user) {
        try {
          userQuota = await this.workloadService.getResourceQuota(req.user.id);
          userWorkloads = this.workloadService.getUserWorkloads(req.user.id).slice(0, 10); // Last 10
        } catch (error) {
          console.error('Failed to get user-specific data:', error);
        }
      }

      res.json({
        success: true,
        dashboard: {
          workloadMetrics,
          queueStatus,
          simulationNodes: simulationNodes.map(node => ({
            id: node.id,
            region: node.region,
            status: node.status,
            utilization: {
              simulations: (node.currentLoad.runningSimulations / node.capacity.maxConcurrentSimulations) * 100,
              memory: (node.currentLoad.memoryUsageMB / node.capacity.maxMemoryMB) * 100,
              cpu: (node.currentLoad.cpuUsage / node.capacity.maxCpuCores) * 100
            },
            performance: node.performance
          })),
          performanceMetrics,
          userQuota,
          recentUserWorkloads: userWorkloads
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get workload dashboard error:', error);
      res.status(500).json({
        error: 'Failed to get workload dashboard',
        code: 'DASHBOARD_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get workload statistics
   */
  async getWorkloadStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = '24h' } = req.query;
      
      // Get basic metrics
      const metrics = await this.workloadService.getWorkloadMetrics();
      
      // Calculate additional statistics
      const statistics = {
        overview: {
          totalWorkloads: metrics.totalWorkloads,
          queuedWorkloads: metrics.queuedWorkloads,
          runningWorkloads: metrics.runningWorkloads,
          completedWorkloads: metrics.completedWorkloads,
          failedWorkloads: metrics.failedWorkloads,
          successRate: metrics.totalWorkloads > 0 ? 
            ((metrics.completedWorkloads / (metrics.completedWorkloads + metrics.failedWorkloads)) * 100) : 0
        },
        performance: {
          averageQueueTime: metrics.averageQueueTime,
          averageExecutionTime: metrics.averageExecutionTime,
          throughputPerMinute: metrics.throughputPerMinute,
          resourceUtilization: metrics.resourceUtilization
        },
        queues: {
          byPriority: metrics.queuesByPriority,
          totalQueued: metrics.queuedWorkloads
        },
        trends: {
          // In a real implementation, this would include historical data
          timeRange,
          dataPoints: [] // Would contain time-series data
        }
      };

      res.json({
        success: true,
        statistics,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get workload statistics error:', error);
      res.status(500).json({
        error: 'Failed to get workload statistics',
        code: 'STATISTICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}