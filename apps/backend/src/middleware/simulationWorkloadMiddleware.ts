/**
 * Simulation Workload Middleware
 * 
 * Middleware for integrating simulation workload management with existing simulation endpoints
 * Implements SRS NFR-5: Scale simulation workloads
 */

import { Request, Response, NextFunction } from 'express';
import { SimulationWorkloadService } from '../services/simulationWorkloadService';
import { SimulationPerformanceOptimizer } from '../services/simulationPerformanceOptimizer';

// Extend Request interface to include workload context
declare global {
  namespace Express {
    interface Request {
      workloadContext?: {
        workloadId?: string;
        priority?: 'low' | 'normal' | 'high' | 'critical';
        estimatedDuration?: number;
        estimatedMemoryUsage?: number;
        estimatedCpuUsage?: number;
        enableOptimizations?: boolean;
      };
    }
  }
}

export class SimulationWorkloadMiddleware {
  private workloadService: SimulationWorkloadService;
  private performanceOptimizer: SimulationPerformanceOptimizer;

  constructor() {
    this.workloadService = new SimulationWorkloadService();
    this.performanceOptimizer = new SimulationPerformanceOptimizer();
  }

  /**
   * Middleware to check resource quotas before simulation
   */
  checkResourceQuota = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(); // Skip quota check for unauthenticated requests
      }

      const quota = await this.workloadService.getResourceQuota(req.user.id);
      
      // Check if user has exceeded their quota
      if (quota.current.runningSimulations >= quota.limits.maxConcurrentSimulations) {
        res.status(429).json({
          error: 'Concurrent simulation limit exceeded',
          code: 'QUOTA_EXCEEDED',
          quota: {
            current: quota.current.runningSimulations,
            limit: quota.limits.maxConcurrentSimulations
          }
        });
        return;
      }

      if (quota.current.dailySimulationsUsed >= quota.limits.dailySimulationLimit) {
        res.status(429).json({
          error: 'Daily simulation limit exceeded',
          code: 'DAILY_QUOTA_EXCEEDED',
          quota: {
            current: quota.current.dailySimulationsUsed,
            limit: quota.limits.dailySimulationLimit
          }
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Resource quota check error:', error);
      next(); // Continue on error to avoid blocking simulations
    }
  };

  /**
   * Middleware to estimate simulation workload
   */
  estimateWorkload = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const {
        userCount = 100,
        duration = 300,
        complexity = 'medium',
        enableRealTimeUpdates = false,
        enableFailureInjection = false,
        enableCostModeling = false
      } = req.body;

      // Estimate resource requirements based on simulation parameters
      let estimatedDuration = duration;
      let estimatedMemoryUsage = 100; // Base memory in MB
      let estimatedCpuUsage = 1; // Base CPU cores

      // Adjust estimates based on user count
      if (userCount > 1000) {
        estimatedMemoryUsage += Math.floor(userCount / 1000) * 50;
        estimatedCpuUsage += Math.floor(userCount / 5000);
      }

      // Adjust estimates based on complexity
      const complexityMultipliers = {
        simple: 1,
        medium: 1.5,
        complex: 2.5,
        enterprise: 4
      };
      
      const multiplier = complexityMultipliers[complexity as keyof typeof complexityMultipliers] || 1.5;
      estimatedMemoryUsage = Math.floor(estimatedMemoryUsage * multiplier);
      estimatedCpuUsage = Math.floor(estimatedCpuUsage * multiplier);

      // Adjust for additional features
      if (enableRealTimeUpdates) {
        estimatedMemoryUsage += 50;
        estimatedCpuUsage += 0.5;
      }

      if (enableFailureInjection) {
        estimatedMemoryUsage += 25;
        estimatedCpuUsage += 0.25;
      }

      if (enableCostModeling) {
        estimatedMemoryUsage += 30;
        estimatedCpuUsage += 0.3;
      }

      // Determine priority based on user subscription and simulation size
      let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';
      
      if (req.user?.subscriptionTier === 'enterprise') {
        priority = userCount > 10000 ? 'critical' : 'high';
      } else if (req.user?.subscriptionTier === 'pro') {
        priority = userCount > 5000 ? 'high' : 'normal';
      } else {
        priority = userCount > 1000 ? 'normal' : 'low';
      }

      // Add workload context to request
      req.workloadContext = {
        priority,
        estimatedDuration,
        estimatedMemoryUsage,
        estimatedCpuUsage,
        enableOptimizations: req.user?.subscriptionTier !== 'free'
      };

      next();
    } catch (error) {
      console.error('Workload estimation error:', error);
      next(); // Continue on error
    }
  };

  /**
   * Middleware to submit simulation as workload
   */
  submitAsWorkload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.workloadContext) {
        return next(); // Skip workload submission for unauthenticated requests or missing context
      }

      const { workspaceId } = req.body;
      if (!workspaceId) {
        return next(); // Skip if no workspace ID
      }

      // Check if simulation should be queued based on current load
      const metrics = await this.workloadService.getWorkloadMetrics();
      const shouldQueue = metrics.runningWorkloads >= 10 || // Max concurrent simulations
                         metrics.resourceUtilization.memory > 80 || // High memory usage
                         metrics.resourceUtilization.cpu > 80; // High CPU usage

      if (shouldQueue) {
        // Submit as workload instead of running immediately
        const workload = {
          workspaceId,
          userId: req.user.id,
          priority: req.workloadContext.priority || 'normal',
          estimatedDuration: req.workloadContext.estimatedDuration || 300,
          estimatedMemoryUsage: req.workloadContext.estimatedMemoryUsage || 100,
          estimatedCpuUsage: req.workloadContext.estimatedCpuUsage || 1,
          configuration: {
            userCount: req.body.userCount || 100,
            duration: req.body.duration || 300,
            complexity: req.body.complexity || 'medium',
            enableRealTimeUpdates: req.body.enableRealTimeUpdates || false,
            enableFailureInjection: req.body.enableFailureInjection || false,
            enableCostModeling: req.body.enableCostModeling || false
          }
        };

        const workloadId = await this.workloadService.submitWorkload(workload);
        
        // Store workload ID in context for response
        req.workloadContext.workloadId = workloadId;

        // Return workload submission response instead of continuing
        res.status(202).json({
          success: true,
          message: 'Simulation queued for execution',
          workloadId,
          estimatedWaitTime: await this.estimateWaitTime(req.workloadContext.priority || 'normal'),
          queuePosition: await this.getQueuePosition(workloadId)
        });
        return;
      }

      next(); // Continue with immediate execution
    } catch (error) {
      console.error('Workload submission error:', error);
      next(); // Continue on error
    }
  };

  /**
   * Middleware to apply performance optimizations
   */
  applyOptimizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.workloadContext?.enableOptimizations) {
        return next(); // Skip optimizations for free tier
      }

      const { workspaceId } = req.body;
      if (!workspaceId) {
        return next();
      }

      // Get performance profile for workspace
      const profile = await this.performanceOptimizer.getPerformanceProfile(workspaceId);
      
      // Apply caching optimizations
      if (profile.cacheHitRate < 0.8) {
        // Enable aggressive caching for this simulation
        req.body.enableCaching = true;
        req.body.cacheStrategy = 'aggressive';
      }

      // Apply batching optimizations
      if (profile.averageExecutionTime > 100) {
        // Enable request batching
        req.body.enableBatching = true;
        req.body.batchSize = 50;
      }

      // Apply resource optimizations
      if (profile.cpuUsage > 70) {
        // Enable resource optimization
        req.body.enableResourceOptimization = true;
      }

      next();
    } catch (error) {
      console.error('Optimization application error:', error);
      next(); // Continue on error
    }
  };

  /**
   * Middleware to track simulation metrics
   */
  trackMetrics = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const workloadService = this.workloadService;

    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(body: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Track metrics asynchronously
      setImmediate(async () => {
        try {
          if (req.user && req.workloadContext) {
            // Note: trackSimulationMetrics method needs to be implemented in SimulationWorkloadService
            console.log('Tracking simulation metrics:', {
              userId: req.user.id,
              workspaceId: req.body.workspaceId,
              duration,
              success: res.statusCode < 400,
              resourceUsage: {
                estimatedMemoryUsage: req.workloadContext.estimatedMemoryUsage || 0,
                estimatedCpuUsage: req.workloadContext.estimatedCpuUsage || 0
              },
              configuration: {
                userCount: req.body.userCount || 100,
                complexity: req.body.complexity || 'medium'
              }
            });
          }
        } catch (error) {
          console.error('Metrics tracking error:', error);
        }
      });

      return originalJson.call(this, body);
    };

    next();
  };

  /**
   * Estimate wait time for queued workload
   */
  private async estimateWaitTime(priority: string): Promise<number> {
    try {
      const queueStatus = this.workloadService.getQueueStatus();
      
      // Convert string priority to number for comparison
      const priorityMap: { [key: string]: number } = {
        'low': 1,
        'normal': 2,
        'high': 3,
        'critical': 4
      };
      
      const priorityNum = priorityMap[priority] || 2;
      const priorityQueue = queueStatus.find(q => q.priority === priorityNum);
      
      if (!priorityQueue) {
        return 0;
      }

      // Estimate based on queue size and processing rate
      return priorityQueue.currentSize * (60 / priorityQueue.processingRate);
    } catch (error) {
      console.error('Wait time estimation error:', error);
      return 300; // Default 5 minutes
    }
  }

  /**
   * Get queue position for workload
   */
  private async getQueuePosition(workloadId: string): Promise<number> {
    try {
      const workload = this.workloadService.getWorkload(workloadId);
      if (!workload) {
        return 0;
      }

      const queueStatus = this.workloadService.getQueueStatus();
      
      // Convert string priority to number for comparison
      const priorityMap: { [key: string]: number } = {
        'low': 1,
        'normal': 2,
        'high': 3,
        'critical': 4
      };
      
      const priorityNum = priorityMap[workload.priority] || 2;
      const priorityQueue = queueStatus.find(q => q.priority === priorityNum);
      
      if (!priorityQueue) {
        return 0;
      }

      return priorityQueue.currentSize;
    } catch (error) {
      console.error('Queue position error:', error);
      return 0;
    }
  }
}

// Create singleton instance
const simulationWorkloadMiddleware = new SimulationWorkloadMiddleware();

// Export middleware functions
export const checkResourceQuota = simulationWorkloadMiddleware.checkResourceQuota;
export const estimateWorkload = simulationWorkloadMiddleware.estimateWorkload;
export const submitAsWorkload = simulationWorkloadMiddleware.submitAsWorkload;
export const applyOptimizations = simulationWorkloadMiddleware.applyOptimizations;
export const trackMetrics = simulationWorkloadMiddleware.trackMetrics;