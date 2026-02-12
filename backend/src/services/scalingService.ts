/**
 * Scaling Service for System Design Simulator
 * Provides API endpoints for scaling strategies and auto-scaling policies
 * Implements SRS FR-3.3: Vertical scaling, horizontal scaling, and auto-scaling policies
 */

import { Request, Response } from 'express';
import { scalingManager, VerticalScalingConfig, HorizontalScalingConfig, AutoScalingPolicy, ScalingAction } from '../components/ScalingManager';

export class ScalingService {
  // Get vertical scaling configuration
  public static getVerticalScalingConfig(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      
      if (!componentKey) {
        res.status(400).json({
          error: {
            code: 'MISSING_COMPONENT_KEY',
            message: 'Component key is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const config = scalingManager.getVerticalScalingConfig(componentKey);
      
      if (!config) {
        res.status(404).json({
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: `Vertical scaling configuration not found for component '${componentKey}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentKey,
        verticalScaling: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve vertical scaling configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get horizontal scaling configuration
  public static getHorizontalScalingConfig(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      
      if (!componentKey) {
        res.status(400).json({
          error: {
            code: 'MISSING_COMPONENT_KEY',
            message: 'Component key is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const config = scalingManager.getHorizontalScalingConfig(componentKey);
      
      if (!config) {
        res.status(404).json({
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: `Horizontal scaling configuration not found for component '${componentKey}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentKey,
        horizontalScaling: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve horizontal scaling configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get auto-scaling policy
  public static getAutoScalingPolicy(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      
      if (!componentKey) {
        res.status(400).json({
          error: {
            code: 'MISSING_COMPONENT_KEY',
            message: 'Component key is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const policy = scalingManager.getAutoScalingPolicy(componentKey);
      
      if (!policy) {
        res.status(404).json({
          error: {
            code: 'POLICY_NOT_FOUND',
            message: `Auto-scaling policy not found for component '${componentKey}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentKey,
        autoScalingPolicy: policy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve auto-scaling policy',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update vertical scaling configuration
  public static updateVerticalScalingConfig(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      const { config } = req.body;
      
      if (!componentKey || !config) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component key and configuration are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate configuration
      const validConfig: Partial<VerticalScalingConfig> = {};
      if (typeof config.enabled === 'boolean') validConfig.enabled = config.enabled;
      if (typeof config.minCpu === 'number') validConfig.minCpu = config.minCpu;
      if (typeof config.maxCpu === 'number') validConfig.maxCpu = config.maxCpu;
      if (typeof config.scaleUpThreshold === 'number') validConfig.scaleUpThreshold = config.scaleUpThreshold;
      if (typeof config.scaleDownThreshold === 'number') validConfig.scaleDownThreshold = config.scaleDownThreshold;
      if (typeof config.cooldownPeriod === 'number') validConfig.cooldownPeriod = config.cooldownPeriod;

      scalingManager.updateVerticalScalingConfig(componentKey, validConfig);
      const updatedConfig = scalingManager.getVerticalScalingConfig(componentKey);

      res.json({
        componentKey,
        verticalScaling: updatedConfig,
        updated: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update vertical scaling configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update horizontal scaling configuration
  public static updateHorizontalScalingConfig(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      const { config } = req.body;
      
      if (!componentKey || !config) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component key and configuration are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate configuration
      const validConfig: Partial<HorizontalScalingConfig> = {};
      if (typeof config.enabled === 'boolean') validConfig.enabled = config.enabled;
      if (typeof config.minInstances === 'number') validConfig.minInstances = config.minInstances;
      if (typeof config.maxInstances === 'number') validConfig.maxInstances = config.maxInstances;
      if (typeof config.targetCpuUtilization === 'number') validConfig.targetCpuUtilization = config.targetCpuUtilization;
      if (typeof config.scaleUpCooldown === 'number') validConfig.scaleUpCooldown = config.scaleUpCooldown;
      if (typeof config.scaleDownCooldown === 'number') validConfig.scaleDownCooldown = config.scaleDownCooldown;

      scalingManager.updateHorizontalScalingConfig(componentKey, validConfig);
      const updatedConfig = scalingManager.getHorizontalScalingConfig(componentKey);

      res.json({
        componentKey,
        horizontalScaling: updatedConfig,
        updated: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update horizontal scaling configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update auto-scaling policy
  public static updateAutoScalingPolicy(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      const { policy } = req.body;
      
      if (!componentKey || !policy) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component key and policy are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate policy
      const validPolicy: Partial<AutoScalingPolicy> = {};
      if (typeof policy.enabled === 'boolean') validPolicy.enabled = policy.enabled;
      if (Array.isArray(policy.metrics)) validPolicy.metrics = policy.metrics;
      if (typeof policy.thresholds === 'object') validPolicy.thresholds = policy.thresholds;
      if (typeof policy.evaluationPeriod === 'number') validPolicy.evaluationPeriod = policy.evaluationPeriod;

      scalingManager.updateAutoScalingPolicy(componentKey, validPolicy);
      const updatedPolicy = scalingManager.getAutoScalingPolicy(componentKey);

      res.json({
        componentKey,
        autoScalingPolicy: updatedPolicy,
        updated: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update auto-scaling policy',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Evaluate scaling needs for a component
  public static evaluateScalingNeeds(req: Request, res: Response): void {
    try {
      const { componentId } = req.params;
      const { componentKey } = req.query;
      
      if (!componentId || !componentKey) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'Component ID and component key are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const recommendation = scalingManager.evaluateScalingNeeds(componentId, componentKey as string);

      res.json({
        componentId,
        componentKey,
        recommendation,
        hasRecommendation: recommendation !== null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to evaluate scaling needs',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Execute scaling action
  public static async executeScalingAction(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const { componentKey, action, currentConfig } = req.body;
      
      if (!componentId || !componentKey || !action || !currentConfig) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component ID, component key, action, and current configuration are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate scaling action
      const validAction: ScalingAction = {
        type: action.type,
        adjustment: action.adjustment,
        adjustmentType: action.adjustmentType || 'absolute',
        cooldown: action.cooldown || 300,
        priority: action.priority || 1
      };

      const scalingEvent = await scalingManager.executeScalingAction(
        componentId,
        componentKey,
        validAction,
        currentConfig
      );

      res.json({
        componentId,
        componentKey,
        scalingEvent,
        success: scalingEvent.success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute scaling action',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get scaling events for a component
  public static getScalingEvents(req: Request, res: Response): void {
    try {
      const { componentId } = req.params;
      
      if (!componentId) {
        res.status(400).json({
          error: {
            code: 'MISSING_COMPONENT_ID',
            message: 'Component ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const events = scalingManager.getScalingEvents(componentId);

      res.json({
        componentId,
        events,
        eventCount: events.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve scaling events',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get scaling capabilities for a component
  public static getScalingCapabilities(req: Request, res: Response): void {
    try {
      const { componentKey } = req.params;
      
      if (!componentKey) {
        res.status(400).json({
          error: {
            code: 'MISSING_COMPONENT_KEY',
            message: 'Component key is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const capabilities = scalingManager.getScalingCapabilities(componentKey);

      res.json({
        componentKey,
        capabilities,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve scaling capabilities',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get all scaling events
  public static getAllScalingEvents(req: Request, res: Response): void {
    try {
      const allEvents = scalingManager.getAllScalingEvents();
      const eventsArray: { componentId: string; events: any[] }[] = [];
      let totalEvents = 0;

      allEvents.forEach((events, componentId) => {
        eventsArray.push({ componentId, events });
        totalEvents += events.length;
      });

      res.json({
        events: eventsArray,
        totalEvents,
        componentCount: eventsArray.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve all scaling events',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }
}