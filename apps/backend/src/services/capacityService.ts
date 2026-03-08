/**
 * Capacity Service for System Design Simulator
 * Provides API endpoints for capacity monitoring and alerting
 * Implements SRS FR-3.2: Capacity monitoring and alerting
 */

import { Request, Response } from 'express';
import { capacityManager, CapacityMetrics, CapacityAlert, CapacityThresholds } from '../components/CapacityManager';

export class CapacityService {
  // Get capacity limits for a component
  public static getCapacityLimits(req: Request, res: Response): void {
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

      const limits = capacityManager.getCapacityLimits(componentKey);
      
      if (!limits) {
        res.status(404).json({
          error: {
            code: 'COMPONENT_NOT_FOUND',
            message: `Component with key '${componentKey}' not found`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentKey,
        limits,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve capacity limits',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get current capacity metrics for a component
  public static getCapacityMetrics(req: Request, res: Response): void {
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

      const metrics = capacityManager.getCapacityMetrics(componentId);
      
      if (!metrics) {
        res.status(404).json({
          error: {
            code: 'METRICS_NOT_FOUND',
            message: `No metrics found for component '${componentId}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentId,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve capacity metrics',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update capacity metrics for a component
  public static updateCapacityMetrics(req: Request, res: Response): void {
    try {
      const { componentId } = req.params;
      const { componentKey, metrics } = req.body;
      
      if (!componentId || !componentKey || !metrics) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component ID, component key, and metrics are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate metrics structure
      const validMetrics: Partial<CapacityMetrics> = {};
      const allowedFields = [
        'currentThroughput', 'currentConnections', 'currentMemoryUsage',
        'currentCpuUsage', 'currentQueueDepth', 'currentStorageUsage', 'currentBandwidth'
      ];

      for (const field of allowedFields) {
        if (metrics[field] !== undefined && typeof metrics[field] === 'number') {
          validMetrics[field as keyof CapacityMetrics] = metrics[field];
        }
      }

      capacityManager.updateCapacityMetrics(componentId, componentKey, validMetrics);

      const updatedMetrics = capacityManager.getCapacityMetrics(componentId);
      const alerts = capacityManager.getActiveAlerts(componentId);

      res.json({
        componentId,
        componentKey,
        metrics: updatedMetrics,
        alerts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update capacity metrics',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get active alerts for a component
  public static getActiveAlerts(req: Request, res: Response): void {
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

      const alerts = capacityManager.getActiveAlerts(componentId);

      res.json({
        componentId,
        alerts,
        alertCount: alerts.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve active alerts',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get all active alerts across all components
  public static getAllActiveAlerts(req: Request, res: Response): void {
    try {
      const allAlerts = capacityManager.getAllActiveAlerts();
      const alertsArray: { componentId: string; alerts: CapacityAlert[] }[] = [];
      let totalAlerts = 0;

      allAlerts.forEach((alerts, componentId) => {
        alertsArray.push({ componentId, alerts });
        totalAlerts += alerts.length;
      });

      res.json({
        alerts: alertsArray,
        totalAlerts,
        componentCount: alertsArray.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve all active alerts',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Acknowledge an alert
  public static acknowledgeAlert(req: Request, res: Response): void {
    try {
      const { componentId, alertId } = req.params;
      
      if (!componentId || !alertId) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'Component ID and Alert ID are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const acknowledged = capacityManager.acknowledgeAlert(componentId, alertId);
      
      if (!acknowledged) {
        res.status(404).json({
          error: {
            code: 'ALERT_NOT_FOUND',
            message: `Alert '${alertId}' not found for component '${componentId}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentId,
        alertId,
        acknowledged: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to acknowledge alert',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Clear acknowledged alerts for a component
  public static clearAcknowledgedAlerts(req: Request, res: Response): void {
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

      capacityManager.clearAcknowledgedAlerts(componentId);
      const remainingAlerts = capacityManager.getActiveAlerts(componentId);

      res.json({
        componentId,
        clearedAcknowledged: true,
        remainingAlerts: remainingAlerts.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear acknowledged alerts',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Check if component is at capacity
  public static checkCapacityStatus(req: Request, res: Response): void {
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

      const isAtCapacity = capacityManager.isAtCapacity(componentId, componentKey as string);
      const utilization = capacityManager.getCapacityUtilization(componentId);
      const performanceImpact = capacityManager.calculatePerformanceImpact(componentId, componentKey as string);

      res.json({
        componentId,
        componentKey,
        isAtCapacity,
        utilizationPercentage: utilization,
        performanceImpact,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check capacity status',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update capacity thresholds
  public static updateThresholds(req: Request, res: Response): void {
    try {
      const { thresholds } = req.body;
      
      if (!thresholds || typeof thresholds !== 'object') {
        res.status(400).json({
          error: {
            code: 'INVALID_THRESHOLDS',
            message: 'Valid thresholds object is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate threshold values
      const validThresholds: Partial<CapacityThresholds> = {};
      if (typeof thresholds.warning === 'number' && thresholds.warning > 0 && thresholds.warning <= 100) {
        validThresholds.warning = thresholds.warning;
      }
      if (typeof thresholds.critical === 'number' && thresholds.critical > 0 && thresholds.critical <= 100) {
        validThresholds.critical = thresholds.critical;
      }
      if (typeof thresholds.maximum === 'number' && thresholds.maximum > 0 && thresholds.maximum <= 100) {
        validThresholds.maximum = thresholds.maximum;
      }

      capacityManager.updateThresholds(validThresholds);
      const updatedThresholds = capacityManager.getThresholds();

      res.json({
        thresholds: updatedThresholds,
        updated: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update thresholds',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get current capacity thresholds
  public static getThresholds(req: Request, res: Response): void {
    try {
      const thresholds = capacityManager.getThresholds();

      res.json({
        thresholds,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve thresholds',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }
}