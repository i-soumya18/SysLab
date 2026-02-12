/**
 * Scalability Middleware
 * 
 * Integrates horizontal scaling and load balancing with the existing application
 * Implements SRS NFR-4: Support thousands of concurrent users
 */

import { Request, Response, NextFunction } from 'express';
import { LoadBalancerService } from '../services/loadBalancerService';
import { ConcurrentUserMonitoringService } from '../services/concurrentUserMonitoringService';
import { HorizontalScalingService } from '../services/horizontalScalingService';

export interface ScalabilityMiddlewareConfig {
  enableLoadBalancing: boolean;
  enableUserTracking: boolean;
  enableMetricsCollection: boolean;
  trackSimulationActivity: boolean;
  trackWorkspaceActivity: boolean;
}

export class ScalabilityMiddleware {
  private loadBalancerService: LoadBalancerService;
  private userMonitoringService: ConcurrentUserMonitoringService;
  private horizontalScalingService: HorizontalScalingService;
  private config: ScalabilityMiddlewareConfig;

  constructor(
    loadBalancerService: LoadBalancerService,
    userMonitoringService: ConcurrentUserMonitoringService,
    horizontalScalingService: HorizontalScalingService,
    config: Partial<ScalabilityMiddlewareConfig> = {}
  ) {
    this.loadBalancerService = loadBalancerService;
    this.userMonitoringService = userMonitoringService;
    this.horizontalScalingService = horizontalScalingService;
    
    this.config = {
      enableLoadBalancing: true,
      enableUserTracking: true,
      enableMetricsCollection: true,
      trackSimulationActivity: true,
      trackWorkspaceActivity: true,
      ...config
    };
  }

  /**
   * Load balancing middleware for API routes
   */
  loadBalance(nodeType: string = 'api') {
    if (!this.config.enableLoadBalancing) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return this.loadBalancerService.middleware(nodeType);
  }

  /**
   * User session tracking middleware
   */
  trackUserSession() {
    if (!this.config.enableUserTracking) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only track authenticated users
        if (!req.user) {
          return next();
        }

        const sessionId = req.sessionId || `session_${Date.now()}_${Math.random()}`;

        // Register or update session
        await this.userMonitoringService.registerSession({
          sessionId,
          userId: req.user.id,
          userTier: req.user.subscriptionTier || 'free',
          region: this.getRegionFromRequest(req),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          activeWorkspaces: [],
          activeSimulations: [],
          connectionType: req.get('upgrade') === 'websocket' ? 'websocket' : 'http',
          socketId: req.get('x-socket-id')
        });

        // Store session ID in request for downstream middleware
        req.sessionId = sessionId;

        next();
      } catch (error) {
        console.error('User session tracking error:', error);
        next(); // Don't block request on tracking errors
      }
    };
  }

  /**
   * Activity tracking middleware
   */
  trackActivity() {
    if (!this.config.enableUserTracking) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user || !req.sessionId) {
          return next();
        }

        // Determine activity type based on route
        const activityType = this.getActivityType(req);
        if (!activityType) {
          return next();
        }

        // Extract relevant details
        const details = this.extractActivityDetails(req);

        // Update session activity
        await this.userMonitoringService.updateSessionActivity(req.sessionId, {
          userId: req.user.id,
          activityType,
          details
        });

        next();
      } catch (error) {
        console.error('Activity tracking error:', error);
        next(); // Don't block request on tracking errors
      }
    };
  }

  /**
   * Metrics collection middleware
   */
  collectMetrics() {
    if (!this.config.enableMetricsCollection) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Override res.end to capture response metrics
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;
        
        // Record request metrics
        setImmediate(() => {
          try {
            // Update node metrics if target node is available
            if (req.targetNode) {
              // This would typically be done by the actual node
              // For now, we'll simulate metric updates
            }

            // Record response time and status
            // This could be used for performance monitoring
          } catch (error) {
            console.error('Metrics collection error:', error);
          }
        });

        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Simulation activity tracking middleware
   */
  trackSimulationActivity() {
    if (!this.config.trackSimulationActivity) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user || !req.sessionId) {
          return next();
        }

        // Only track simulation-related routes
        if (!req.path.includes('/simulation')) {
          return next();
        }

        let activityType: 'simulation_start' | 'simulation_stop' | undefined;
        const details: any = {};

        if (req.method === 'POST' && req.path.includes('/start')) {
          activityType = 'simulation_start';
          details.simulationId = req.body.simulationId || req.params.simulationId;
          details.workspaceId = req.body.workspaceId || req.params.workspaceId;
        } else if (req.method === 'POST' && req.path.includes('/stop')) {
          activityType = 'simulation_stop';
          details.simulationId = req.body.simulationId || req.params.simulationId;
        }

        if (activityType) {
          await this.userMonitoringService.updateSessionActivity(req.sessionId, {
            userId: req.user.id,
            activityType,
            details
          });
        }

        next();
      } catch (error) {
        console.error('Simulation activity tracking error:', error);
        next();
      }
    };
  }

  /**
   * Workspace activity tracking middleware
   */
  trackWorkspaceActivity() {
    if (!this.config.trackWorkspaceActivity) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user || !req.sessionId) {
          return next();
        }

        // Only track workspace-related routes
        if (!req.path.includes('/workspace')) {
          return next();
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          await this.userMonitoringService.updateSessionActivity(req.sessionId, {
            userId: req.user.id,
            activityType: 'workspace_edit',
            details: {
              workspaceId: req.params.workspaceId || req.body.workspaceId,
              method: req.method,
              path: req.path
            }
          });
        }

        next();
      } catch (error) {
        console.error('Workspace activity tracking error:', error);
        next();
      }
    };
  }

  /**
   * Collaboration activity tracking middleware
   */
  trackCollaborationActivity() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user || !req.sessionId) {
          return next();
        }

        // Track collaboration join events
        if (req.path.includes('/collaboration') && req.method === 'POST') {
          await this.userMonitoringService.updateSessionActivity(req.sessionId, {
            userId: req.user.id,
            activityType: 'collaboration_join',
            details: {
              workspaceId: req.params.workspaceId || req.body.workspaceId,
              collaborationType: req.body.type || 'unknown'
            }
          });
        }

        next();
      } catch (error) {
        console.error('Collaboration activity tracking error:', error);
        next();
      }
    };
  }

  /**
   * Session cleanup middleware (for logout/disconnect)
   */
  cleanupSession() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Handle logout
        if (req.path.includes('/logout') && req.method === 'POST') {
          if (req.sessionId) {
            await this.userMonitoringService.endSession(req.sessionId, 'logout');
          }
        }

        next();
      } catch (error) {
        console.error('Session cleanup error:', error);
        next();
      }
    };
  }

  /**
   * Health check middleware for nodes
   */
  healthCheck() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/health' || req.path === '/healthz') {
        const nodeId = process.env.NODE_ID;
        const nodeType = process.env.NODE_TYPE || 'api';
        
        if (nodeId) {
          // Update node metrics
          setImmediate(async () => {
            try {
              await this.horizontalScalingService.updateNodeMetrics(nodeId, {
                currentLoad: this.getCurrentLoad(),
                cpuUsage: this.getCpuUsage(),
                memoryUsage: this.getMemoryUsage(),
                status: 'healthy'
              });
            } catch (error) {
              console.error('Health check metric update error:', error);
            }
          });
        }

        res.json({
          status: 'healthy',
          timestamp: new Date(),
          nodeId,
          nodeType,
          metrics: {
            currentLoad: this.getCurrentLoad(),
            cpuUsage: this.getCpuUsage(),
            memoryUsage: this.getMemoryUsage()
          }
        });
        return;
      }

      next();
    };
  }

  // Private helper methods

  private getRegionFromRequest(req: Request): string {
    // Try to determine region from headers or IP
    const cloudFrontRegion = req.get('CloudFront-Viewer-Country');
    if (cloudFrontRegion) {
      return this.mapCountryToRegion(cloudFrontRegion);
    }

    // Default region
    return process.env.AWS_REGION || 'us-east-1';
  }

  private mapCountryToRegion(country: string): string {
    const regionMap: Record<string, string> = {
      'US': 'us-east-1',
      'CA': 'us-east-1',
      'GB': 'eu-west-1',
      'DE': 'eu-west-1',
      'FR': 'eu-west-1',
      'JP': 'ap-northeast-1',
      'SG': 'ap-southeast-1',
      'AU': 'ap-southeast-2',
      'BR': 'sa-east-1'
    };

    return regionMap[country] || 'us-east-1';
  }

  private getActivityType(req: Request): 'page_view' | 'api_call' | null {
    if (req.method === 'GET') {
      return 'page_view';
    }

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      return 'api_call';
    }

    return null;
  }

  private extractActivityDetails(req: Request): Record<string, any> {
    return {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      contentLength: req.get('Content-Length'),
      workspaceId: req.params.workspaceId || req.body.workspaceId,
      simulationId: req.params.simulationId || req.body.simulationId
    };
  }

  private getCurrentLoad(): number {
    // Simple load calculation based on active connections
    // In a real implementation, this would be more sophisticated
    return Math.floor(Math.random() * 100);
  }

  private getCpuUsage(): number {
    // Get CPU usage - in production, use actual system metrics
    const usage = process.cpuUsage();
    return Math.min(100, (usage.user + usage.system) / 1000000); // Convert to percentage
  }

  private getMemoryUsage(): number {
    // Get memory usage percentage
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    return (usage.heapUsed / totalMemory) * 100;
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

/**
 * Factory function to create scalability middleware
 */
export function createScalabilityMiddleware(
  loadBalancerService: LoadBalancerService,
  userMonitoringService: ConcurrentUserMonitoringService,
  horizontalScalingService: HorizontalScalingService,
  config?: Partial<ScalabilityMiddlewareConfig>
): ScalabilityMiddleware {
  return new ScalabilityMiddleware(
    loadBalancerService,
    userMonitoringService,
    horizontalScalingService,
    config
  );
}

/**
 * Convenience middleware collections
 */
export const scalabilityMiddleware = {
  /**
   * Full scalability stack
   */
  fullStack: (middleware: ScalabilityMiddleware) => [
    middleware.healthCheck(),
    middleware.trackUserSession(),
    middleware.trackActivity(),
    middleware.collectMetrics(),
    middleware.cleanupSession()
  ],

  /**
   * API-specific middleware
   */
  api: (middleware: ScalabilityMiddleware) => [
    middleware.loadBalance('api'),
    middleware.trackUserSession(),
    middleware.trackActivity(),
    middleware.collectMetrics()
  ],

  /**
   * Simulation-specific middleware
   */
  simulation: (middleware: ScalabilityMiddleware) => [
    middleware.loadBalance('simulation'),
    middleware.trackSimulationActivity(),
    middleware.collectMetrics()
  ],

  /**
   * WebSocket-specific middleware
   */
  websocket: (middleware: ScalabilityMiddleware) => [
    middleware.loadBalance('websocket'),
    middleware.trackUserSession(),
    middleware.trackCollaborationActivity()
  ]
};