/**
 * Scalability API Service
 * 
 * Provides REST API endpoints for horizontal scaling, load balancing, and user monitoring
 * Implements SRS NFR-4: Support thousands of concurrent users
 */

import { Request, Response } from 'express';
import { HorizontalScalingService } from './horizontalScalingService';
import { LoadBalancerService } from './loadBalancerService';
import { ConcurrentUserMonitoringService } from './concurrentUserMonitoringService';

export class ScalabilityApiService {
  private scalingService: HorizontalScalingService;
  private loadBalancerService: LoadBalancerService;
  private userMonitoringService: ConcurrentUserMonitoringService;

  constructor(
    scalingService: HorizontalScalingService,
    loadBalancerService: LoadBalancerService,
    userMonitoringService: ConcurrentUserMonitoringService
  ) {
    this.scalingService = scalingService;
    this.loadBalancerService = loadBalancerService;
    this.userMonitoringService = userMonitoringService;
  }

  // Horizontal Scaling Endpoints

  /**
   * Register a new scaling node
   */
  async registerNode(req: Request, res: Response): Promise<void> {
    try {
      const { type, status, capacity, endpoint, region, metadata } = req.body;

      if (!type || !status || !capacity || !endpoint || !region) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS',
          required: ['type', 'status', 'capacity', 'endpoint', 'region']
        });
        return;
      }

      const nodeId = await this.scalingService.registerNode({
        type,
        status,
        capacity: parseInt(capacity),
        currentLoad: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        endpoint,
        region,
        metadata: metadata || {}
      });

      res.status(201).json({
        success: true,
        nodeId,
        message: 'Node registered successfully'
      });

    } catch (error) {
      console.error('Register node error:', error);
      res.status(500).json({
        error: 'Failed to register node',
        code: 'REGISTRATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update node metrics (heartbeat)
   */
  async updateNodeMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { currentLoad, cpuUsage, memoryUsage, status } = req.body;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required',
          code: 'MISSING_NODE_ID'
        });
        return;
      }

      await this.scalingService.updateNodeMetrics(nodeId, {
        currentLoad: parseInt(currentLoad) || 0,
        cpuUsage: parseFloat(cpuUsage) || 0,
        memoryUsage: parseFloat(memoryUsage) || 0,
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
   * Remove a scaling node
   */
  async removeNode(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required',
          code: 'MISSING_NODE_ID'
        });
        return;
      }

      await this.scalingService.removeNode(nodeId);

      res.json({
        success: true,
        message: 'Node removed successfully'
      });

    } catch (error) {
      console.error('Remove node error:', error);
      res.status(500).json({
        error: 'Failed to remove node',
        code: 'REMOVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all scaling nodes
   */
  async getNodes(req: Request, res: Response): Promise<void> {
    try {
      const { nodeType } = req.query;
      const nodes = this.scalingService.getNodes(nodeType as string);

      res.json({
        success: true,
        nodes,
        count: nodes.length
      });

    } catch (error) {
      console.error('Get nodes error:', error);
      res.status(500).json({
        error: 'Failed to get nodes',
        code: 'GET_NODES_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get system capacity metrics
   */
  async getSystemCapacity(req: Request, res: Response): Promise<void> {
    try {
      const capacity = this.scalingService.getSystemCapacity();

      res.json({
        success: true,
        capacity,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get system capacity error:', error);
      res.status(500).json({
        error: 'Failed to get system capacity',
        code: 'CAPACITY_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Set auto-scaling policy
   */
  async setAutoScalingPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { nodeType } = req.params;
      const policy = req.body;

      if (!nodeType) {
        res.status(400).json({
          error: 'Node type is required',
          code: 'MISSING_NODE_TYPE'
        });
        return;
      }

      await this.scalingService.setAutoScalingPolicy(nodeType, policy);

      res.json({
        success: true,
        message: 'Auto-scaling policy updated successfully'
      });

    } catch (error) {
      console.error('Set auto-scaling policy error:', error);
      res.status(500).json({
        error: 'Failed to set auto-scaling policy',
        code: 'POLICY_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get auto-scaling policy
   */
  async getAutoScalingPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { nodeType } = req.params;

      if (!nodeType) {
        res.status(400).json({
          error: 'Node type is required',
          code: 'MISSING_NODE_TYPE'
        });
        return;
      }

      const policy = this.scalingService.getAutoScalingPolicy(nodeType);

      if (!policy) {
        res.status(404).json({
          error: 'Auto-scaling policy not found',
          code: 'POLICY_NOT_FOUND',
          nodeType
        });
        return;
      }

      res.json({
        success: true,
        policy,
        nodeType
      });

    } catch (error) {
      console.error('Get auto-scaling policy error:', error);
      res.status(500).json({
        error: 'Failed to get auto-scaling policy',
        code: 'POLICY_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get scaling events
   */
  async getScalingEvents(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.query;
      const events = await this.scalingService.getScalingEvents(
        limit ? parseInt(limit as string) : 100
      );

      res.json({
        success: true,
        events,
        count: events.length
      });

    } catch (error) {
      console.error('Get scaling events error:', error);
      res.status(500).json({
        error: 'Failed to get scaling events',
        code: 'EVENTS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Load Balancer Endpoints

  /**
   * Get load balancer statistics
   */
  async getLoadBalancerStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.loadBalancerService.getStats();

      res.json({
        success: true,
        stats,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get load balancer stats error:', error);
      res.status(500).json({
        error: 'Failed to get load balancer stats',
        code: 'STATS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add routing rule
   */
  async addRoutingRule(req: Request, res: Response): Promise<void> {
    try {
      const rule = req.body;

      if (!rule.name || !rule.condition || !rule.target) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS',
          required: ['name', 'condition', 'target']
        });
        return;
      }

      const ruleId = await this.loadBalancerService.addRoutingRule(rule);

      res.status(201).json({
        success: true,
        ruleId,
        message: 'Routing rule added successfully'
      });

    } catch (error) {
      console.error('Add routing rule error:', error);
      res.status(500).json({
        error: 'Failed to add routing rule',
        code: 'ROUTING_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Remove routing rule
   */
  async removeRoutingRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;

      if (!ruleId) {
        res.status(400).json({
          error: 'Rule ID is required',
          code: 'MISSING_RULE_ID'
        });
        return;
      }

      await this.loadBalancerService.removeRoutingRule(ruleId);

      res.json({
        success: true,
        message: 'Routing rule removed successfully'
      });

    } catch (error) {
      console.error('Remove routing rule error:', error);
      res.status(500).json({
        error: 'Failed to remove routing rule',
        code: 'ROUTING_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get routing rules
   */
  async getRoutingRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = this.loadBalancerService.getRoutingRules();

      res.json({
        success: true,
        rules,
        count: rules.length
      });

    } catch (error) {
      console.error('Get routing rules error:', error);
      res.status(500).json({
        error: 'Failed to get routing rules',
        code: 'ROUTING_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get circuit breaker states
   */
  async getCircuitBreakerStates(req: Request, res: Response): Promise<void> {
    try {
      const states = this.loadBalancerService.getCircuitBreakerStates();

      res.json({
        success: true,
        circuitBreakers: states,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get circuit breaker states error:', error);
      res.status(500).json({
        error: 'Failed to get circuit breaker states',
        code: 'CIRCUIT_BREAKER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reset circuit breaker
   */
  async resetCircuitBreaker(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required',
          code: 'MISSING_NODE_ID'
        });
        return;
      }

      this.loadBalancerService.resetCircuitBreaker(nodeId);

      res.json({
        success: true,
        message: 'Circuit breaker reset successfully'
      });

    } catch (error) {
      console.error('Reset circuit breaker error:', error);
      res.status(500).json({
        error: 'Failed to reset circuit breaker',
        code: 'CIRCUIT_BREAKER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = this.loadBalancerService.getHealthStatus();

      res.json({
        success: true,
        healthStatus,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get health status error:', error);
      res.status(500).json({
        error: 'Failed to get health status',
        code: 'HEALTH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // User Monitoring Endpoints

  /**
   * Get current user metrics
   */
  async getCurrentUserMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.userMonitoringService.getCurrentMetrics();

      res.json({
        success: true,
        metrics
      });

    } catch (error) {
      console.error('Get current user metrics error:', error);
      res.status(500).json({
        error: 'Failed to get current user metrics',
        code: 'METRICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      const analytics = await this.userMonitoringService.getSessionAnalytics({
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      });

      res.json({
        success: true,
        analytics
      });

    } catch (error) {
      console.error('Get session analytics error:', error);
      res.status(500).json({
        error: 'Failed to get session analytics',
        code: 'ANALYTICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get capacity alerts
   */
  async getCapacityAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.query;
      const alerts = await this.userMonitoringService.getCapacityAlerts(
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        alerts,
        count: alerts.length
      });

    } catch (error) {
      console.error('Get capacity alerts error:', error);
      res.status(500).json({
        error: 'Failed to get capacity alerts',
        code: 'ALERTS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Acknowledge capacity alert
   */
  async acknowledgeCapacityAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;

      if (!alertId) {
        res.status(400).json({
          error: 'Alert ID is required',
          code: 'MISSING_ALERT_ID'
        });
        return;
      }

      await this.userMonitoringService.acknowledgeCapacityAlert(alertId);

      res.json({
        success: true,
        message: 'Capacity alert acknowledged successfully'
      });

    } catch (error) {
      console.error('Acknowledge capacity alert error:', error);
      res.status(500).json({
        error: 'Failed to acknowledge capacity alert',
        code: 'ALERT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const { userTier, region, connectionType, hasActiveSimulations } = req.query;

      const criteria: any = {};
      if (userTier) criteria.userTier = userTier;
      if (region) criteria.region = region;
      if (connectionType) criteria.connectionType = connectionType;
      if (hasActiveSimulations !== undefined) {
        criteria.hasActiveSimulations = hasActiveSimulations === 'true';
      }

      const sessions = this.userMonitoringService.getActiveSessions(
        Object.keys(criteria).length > 0 ? criteria : undefined
      );

      res.json({
        success: true,
        sessions,
        count: sessions.length
      });

    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({
        error: 'Failed to get active sessions',
        code: 'SESSIONS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Set maximum capacity
   */
  async setMaxCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { capacity } = req.body;

      if (!capacity || capacity <= 0) {
        res.status(400).json({
          error: 'Valid capacity is required',
          code: 'INVALID_CAPACITY'
        });
        return;
      }

      this.userMonitoringService.setMaxCapacity(parseInt(capacity));

      res.json({
        success: true,
        message: 'Maximum capacity updated successfully',
        capacity: parseInt(capacity)
      });

    } catch (error) {
      console.error('Set max capacity error:', error);
      res.status(500).json({
        error: 'Failed to set maximum capacity',
        code: 'CAPACITY_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get capacity forecast
   */
  async getCapacityForecast(req: Request, res: Response): Promise<void> {
    try {
      const { hours } = req.query;
      const forecast = await this.userMonitoringService.getCapacityForecast(
        hours ? parseInt(hours as string) : 24
      );

      res.json({
        success: true,
        forecast
      });

    } catch (error) {
      console.error('Get capacity forecast error:', error);
      res.status(500).json({
        error: 'Failed to get capacity forecast',
        code: 'FORECAST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Combined Dashboard Endpoints

  /**
   * Get scalability dashboard data
   */
  async getScalabilityDashboard(req: Request, res: Response): Promise<void> {
    try {
      const [
        systemCapacity,
        userMetrics,
        loadBalancerStats,
        healthStatus,
        scalingEvents,
        capacityAlerts
      ] = await Promise.all([
        this.scalingService.getSystemCapacity(),
        this.userMonitoringService.getCurrentMetrics(),
        this.loadBalancerService.getStats(),
        this.loadBalancerService.getHealthStatus(),
        this.scalingService.getScalingEvents(10),
        this.userMonitoringService.getCapacityAlerts(5)
      ]);

      res.json({
        success: true,
        dashboard: {
          systemCapacity,
          userMetrics,
          loadBalancerStats,
          healthStatus,
          recentScalingEvents: scalingEvents,
          recentCapacityAlerts: capacityAlerts
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Get scalability dashboard error:', error);
      res.status(500).json({
        error: 'Failed to get scalability dashboard',
        code: 'DASHBOARD_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update concurrent user count (called by session management)
   */
  async updateConcurrentUsers(req: Request, res: Response): Promise<void> {
    try {
      const { count } = req.body;

      if (count === undefined || count < 0) {
        res.status(400).json({
          error: 'Valid user count is required',
          code: 'INVALID_COUNT'
        });
        return;
      }

      await this.scalingService.updateConcurrentUsers(parseInt(count));

      res.json({
        success: true,
        message: 'Concurrent user count updated successfully',
        count: parseInt(count)
      });

    } catch (error) {
      console.error('Update concurrent users error:', error);
      res.status(500).json({
        error: 'Failed to update concurrent user count',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}