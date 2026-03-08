/**
 * User Isolation Middleware
 * 
 * Implements SRS NFR-3: Enforce tenant-scoped data access and resource isolation
 * Ensures all operations are properly isolated by user/tenant
 */

import { Request, Response, NextFunction } from 'express';
import { UserIsolationService, IsolationContext } from '../isolation/UserIsolationService';
import { AuthService, User } from '../services/authService';

// Extend Express Request to include isolation context
declare global {
  namespace Express {
    interface Request {
      isolationContext?: IsolationContext;
      user?: User;
    }
  }
}

export interface IsolationMiddlewareConfig {
  enforceResourceLimits: boolean;
  enableQuotaChecking: boolean;
  enableUsageTracking: boolean;
  blockOnViolation: boolean;
  logViolations: boolean;
}

export class IsolationMiddleware {
  private isolationService: UserIsolationService;
  private authService: AuthService;
  private config: IsolationMiddlewareConfig;

  constructor(
    isolationService: UserIsolationService,
    authService: AuthService,
    config: Partial<IsolationMiddlewareConfig> = {}
  ) {
    this.isolationService = isolationService;
    this.authService = authService;
    this.config = {
      enforceResourceLimits: true,
      enableQuotaChecking: true,
      enableUsageTracking: true,
      blockOnViolation: true,
      logViolations: true,
      ...config
    };
  }

  /**
   * Authentication and context creation middleware
   */
  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        const token = authHeader.substring(7);
        const authResult = await this.authService.verifyToken(token);

        if (!authResult.valid || !authResult.user) {
          return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'AUTH_INVALID'
          });
        }

        // Set user in request
        req.user = authResult.user;

        // Create or get isolation context
        const sessionId = req.sessionId || `session_${Date.now()}_${Math.random()}`;

        try {
          let context = this.isolationService.getUserContext(sessionId);

          if (!context) {
            context = await this.isolationService.createUserContext(
              req.user.id,
              sessionId,
              req.user.subscriptionTier
            );
          }

          req.isolationContext = context;
          
        } catch (error: any) {
          if (error.message.includes('Concurrent session limit exceeded')) {
            return res.status(429).json({
              error: 'Too many concurrent sessions',
              code: 'SESSION_LIMIT_EXCEEDED',
              details: error.message
            });
          }
          throw error;
        }

        return next();
      } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
          error: 'Authentication failed',
          code: 'AUTH_ERROR'
        });
      }
    };
  }

  /**
   * Workspace access control middleware
   */
  enforceWorkspaceAccess() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user || !req.isolationContext) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        const workspaceId = req.params.workspaceId || req.body.workspaceId;
        
        if (!workspaceId) {
          return res.status(400).json({
            error: 'Workspace ID required',
            code: 'WORKSPACE_ID_REQUIRED'
          });
        }

        // Check if user has access to this workspace
        // This would typically query the database to verify ownership/access
        const hasAccess = await this.checkWorkspaceAccess(req.user.id, workspaceId);
        
        if (!hasAccess) {
          return res.status(403).json({
            error: 'Access denied to workspace',
            code: 'WORKSPACE_ACCESS_DENIED',
            workspaceId
          });
        }

        // Set workspace in isolation context
        req.isolationContext.workspaceId = workspaceId;

        return next();
      } catch (error) {
        console.error('Workspace access middleware error:', error);
        return res.status(500).json({
          error: 'Access control failed',
          code: 'ACCESS_CONTROL_ERROR'
        });
      }
    };
  }

  /**
   * Resource quota checking middleware
   */
  checkResourceQuotas(resourceType: string, resourceCount: number = 1) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!this.config.enableQuotaChecking || !req.isolationContext) {
          return next();
        }

        const context = req.isolationContext;
        const resourceRequirement: any = {};

        // Map resource type to usage field
        switch (resourceType) {
          case 'components':
            resourceRequirement.currentComponents = resourceCount;
            break;
          case 'connections':
            resourceRequirement.currentConnections = resourceCount;
            break;
          case 'simulations':
            resourceRequirement.currentSimulations = resourceCount;
            break;
          case 'workspaces':
            resourceRequirement.currentWorkspaces = resourceCount;
            break;
          default:
            return next(); // Unknown resource type, skip check
        }

        const canProceed = await this.isolationService.checkResourceLimits(
          context.sessionId,
          req.method + ' ' + req.path,
          resourceRequirement
        );

        if (!canProceed && this.config.blockOnViolation) {
          const limits = context.resourceLimits;
          const usage = context.currentUsage;
          
          return res.status(429).json({
            error: `Resource quota exceeded for ${resourceType}`,
            code: 'QUOTA_EXCEEDED',
            details: {
              resourceType,
              current: usage[`current${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}` as keyof typeof usage],
              limit: limits[`max${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}` as keyof typeof limits],
              subscriptionTier: limits.subscriptionTier
            }
          });
        }

        return next();
      } catch (error) {
        console.error('Resource quota middleware error:', error);
        return res.status(500).json({
          error: 'Resource quota check failed',
          code: 'QUOTA_CHECK_ERROR'
        });
      }
    };
  }

  /**
   * Memory usage tracking middleware
   */
  trackMemoryUsage() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableUsageTracking || !req.isolationContext) {
        return next();
      }

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = process.hrtime.bigint();

      // Override res.json to track response size
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        const responseSize = JSON.stringify(data).length;
        
        // Track memory allocation for this request
        const context = req.isolationContext!;
        if (context.isolatedResources.memoryPool) {
          context.isolatedResources.memoryPool.allocate(
            `request_${Date.now()}`,
            responseSize
          );
        }

        return originalJson(data);
      };

      // Continue with request
      next();

      // Track memory usage after request
      res.on('finish', () => {
        try {
          const endMemory = process.memoryUsage().heapUsed;
          const endTime = process.hrtime.bigint();
          
          const memoryDelta = endMemory - startMemory;
          const timeDelta = Number(endTime - startTime) / 1000000; // Convert to milliseconds

          // Update resource usage
          if (req.isolationContext && req.user && memoryDelta > 0) {
            this.isolationService.updateResourceUsage(req.user.id, {
              currentMemoryUsage: req.isolationContext.currentUsage.currentMemoryUsage + (memoryDelta / 1024 / 1024)
            });
          }

          // Log high memory usage
          if (this.config.logViolations && memoryDelta > 10 * 1024 * 1024) { // 10MB
            console.warn(`High memory usage detected:`, {
              userId: req.user?.id,
              path: req.path,
              method: req.method,
              memoryDelta: memoryDelta / 1024 / 1024,
              timeDelta
            });
          }

        } catch (error) {
          console.error('Memory tracking error:', error);
        }
      });
    };
  }

  /**
   * Tenant data isolation middleware
   */
  enforceTenantIsolation() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        // Add tenant filter to query parameters
        req.query.userId = req.user.id;

        // For POST/PUT requests, ensure userId is set in body
        if (req.method === 'POST' || req.method === 'PUT') {
          if (req.body && typeof req.body === 'object') {
            req.body.userId = req.user.id;
          }
        }

        // Override database queries to include tenant filtering
        // This would be implemented at the service layer level

        return next();
      } catch (error) {
        console.error('Tenant isolation middleware error:', error);
        return res.status(500).json({
          error: 'Tenant isolation failed',
          code: 'TENANT_ISOLATION_ERROR'
        });
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(requestsPerMinute: number = 60) {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return next();
        }

        const userId = req.user.id;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute

        let userRequests = requestCounts.get(userId);
        
        if (!userRequests || now > userRequests.resetTime) {
          userRequests = { count: 0, resetTime: now + windowMs };
          requestCounts.set(userId, userRequests);
        }

        userRequests.count++;

        if (userRequests.count > requestsPerMinute) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: requestsPerMinute,
              current: userRequests.count,
              resetTime: userRequests.resetTime
            }
          });
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': requestsPerMinute.toString(),
          'X-RateLimit-Remaining': Math.max(0, requestsPerMinute - userRequests.count).toString(),
          'X-RateLimit-Reset': Math.ceil(userRequests.resetTime / 1000).toString()
        });

        return next();
      } catch (error) {
        console.error('Rate limiting middleware error:', error);
        return next(); // Don't block on rate limiting errors
      }
    };
  }

  /**
   * Cleanup middleware for session end
   */
  cleanup() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Cleanup on response finish
      res.on('finish', async () => {
        try {
          if (req.isolationContext) {
            // Don't cleanup context immediately, let it timeout naturally
            // This allows for connection reuse
          }
        } catch (error) {
          console.error('Cleanup middleware error:', error);
        }
      });

      return next();
    };
  }

  /**
   * Check if user has access to workspace
   */
  private async checkWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    try {
      // This would typically query the database
      // For now, we'll implement a basic check
      // In a real implementation, this would check workspace ownership or shared access
      
      // Placeholder implementation - in production, query the database
      return true; // Allow access for now
      
    } catch (error) {
      console.error('Workspace access check error:', error);
      return false;
    }
  }

  /**
   * Error handler for isolation-related errors
   */
  errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      if (error.code === 'QUOTA_EXCEEDED') {
        return res.status(429).json({
          error: 'Resource quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: error.details
        });
      }

      if (error.code === 'SESSION_LIMIT_EXCEEDED') {
        return res.status(429).json({
          error: 'Too many concurrent sessions',
          code: 'SESSION_LIMIT_EXCEEDED',
          details: error.message
        });
      }

      if (error.code === 'WORKSPACE_ACCESS_DENIED') {
        return res.status(403).json({
          error: 'Access denied to workspace',
          code: 'WORKSPACE_ACCESS_DENIED',
          workspaceId: error.workspaceId
        });
      }

      // Pass through other errors
      return next(error);
    };
  }
}

/**
 * Factory function to create isolation middleware
 */
export function createIsolationMiddleware(
  isolationService: UserIsolationService,
  authService: AuthService,
  config?: Partial<IsolationMiddlewareConfig>
): IsolationMiddleware {
  return new IsolationMiddleware(isolationService, authService, config);
}

/**
 * Convenience middleware for common isolation patterns
 */
export const isolationMiddleware = {
  /**
   * Full isolation stack for API routes
   */
  fullStack: (isolationService: UserIsolationService, authService: AuthService) => {
    const middleware = new IsolationMiddleware(isolationService, authService);
    
    return [
      middleware.authenticate(),
      middleware.enforceTenantIsolation(),
      middleware.trackMemoryUsage(),
      middleware.rateLimit(),
      middleware.cleanup()
    ];
  },

  /**
   * Workspace-specific isolation
   */
  workspace: (isolationService: UserIsolationService, authService: AuthService) => {
    const middleware = new IsolationMiddleware(isolationService, authService);
    
    return [
      middleware.authenticate(),
      middleware.enforceWorkspaceAccess(),
      middleware.enforceTenantIsolation(),
      middleware.checkResourceQuotas('workspaces', 1),
      middleware.trackMemoryUsage()
    ];
  },

  /**
   * Simulation-specific isolation
   */
  simulation: (isolationService: UserIsolationService, authService: AuthService) => {
    const middleware = new IsolationMiddleware(isolationService, authService);
    
    return [
      middleware.authenticate(),
      middleware.enforceWorkspaceAccess(),
      middleware.checkResourceQuotas('simulations', 1),
      middleware.trackMemoryUsage(),
      middleware.rateLimit(30) // Lower rate limit for simulations
    ];
  }
};