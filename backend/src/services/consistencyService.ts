/**
 * Consistency Service for System Design Simulator
 * Provides API endpoints for consistency and replication management
 * Implements SRS FR-3.4: Database consistency levels and cache consistency/replication settings
 */

import { Request, Response } from 'express';
import { consistencyManager, DatabaseConsistencyConfig, CacheConsistencyConfig, ConsistencyMetrics } from '../components/ConsistencyManager';

export class ConsistencyService {
  // Get database consistency configuration
  public static getDatabaseConsistencyConfig(req: Request, res: Response): void {
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

      const config = consistencyManager.getDatabaseConsistencyConfig(componentKey);
      
      if (!config) {
        res.status(404).json({
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: `Database consistency configuration not found for component '${componentKey}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentKey,
        databaseConsistency: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve database consistency configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get cache consistency configuration
  public static getCacheConsistencyConfig(req: Request, res: Response): void {
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

      const config = consistencyManager.getCacheConsistencyConfig(componentKey);
      
      if (!config) {
        res.status(404).json({
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: `Cache consistency configuration not found for component '${componentKey}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentKey,
        cacheConsistency: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve cache consistency configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update database consistency configuration
  public static updateDatabaseConsistencyConfig(req: Request, res: Response): void {
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
      const validConfig: Partial<DatabaseConsistencyConfig> = {};
      if (config.consistencyLevel) validConfig.consistencyLevel = config.consistencyLevel;
      if (config.isolationLevel) validConfig.isolationLevel = config.isolationLevel;
      if (config.replicationConfig) validConfig.replicationConfig = config.replicationConfig;
      if (typeof config.transactionSupport === 'boolean') validConfig.transactionSupport = config.transactionSupport;
      if (config.acidCompliance) validConfig.acidCompliance = config.acidCompliance;
      if (config.readPreference) validConfig.readPreference = config.readPreference;
      if (config.writeConcern) validConfig.writeConcern = config.writeConcern;
      if (config.readConcern) validConfig.readConcern = config.readConcern;

      consistencyManager.updateDatabaseConsistencyConfig(componentKey, validConfig);
      const updatedConfig = consistencyManager.getDatabaseConsistencyConfig(componentKey);

      res.json({
        componentKey,
        databaseConsistency: updatedConfig,
        updated: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update database consistency configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update cache consistency configuration
  public static updateCacheConsistencyConfig(req: Request, res: Response): void {
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
      const validConfig: Partial<CacheConsistencyConfig> = {};
      if (config.consistencyModel) validConfig.consistencyModel = config.consistencyModel;
      if (config.replicationConfig) validConfig.replicationConfig = config.replicationConfig;
      if (config.evictionPolicy) validConfig.evictionPolicy = config.evictionPolicy;
      if (config.invalidationStrategy) validConfig.invalidationStrategy = config.invalidationStrategy;
      if (config.coherenceProtocol) validConfig.coherenceProtocol = config.coherenceProtocol;
      if (config.partitioning) validConfig.partitioning = config.partitioning;

      consistencyManager.updateCacheConsistencyConfig(componentKey, validConfig);
      const updatedConfig = consistencyManager.getCacheConsistencyConfig(componentKey);

      res.json({
        componentKey,
        cacheConsistency: updatedConfig,
        updated: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update cache consistency configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Analyze CAP theorem trade-offs
  public static analyzeCAPTradeoffs(req: Request, res: Response): void {
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

      const analysis = consistencyManager.analyzeCAPTradeoffs(componentKey);

      res.json({
        componentKey,
        capAnalysis: analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze CAP trade-offs',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Update consistency metrics
  public static updateConsistencyMetrics(req: Request, res: Response): void {
    try {
      const { componentId } = req.params;
      const { metrics } = req.body;
      
      if (!componentId || !metrics) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Component ID and metrics are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate metrics
      const validMetrics: Partial<ConsistencyMetrics> = {};
      if (typeof metrics.readLatency === 'number') validMetrics.readLatency = metrics.readLatency;
      if (typeof metrics.writeLatency === 'number') validMetrics.writeLatency = metrics.writeLatency;
      if (typeof metrics.replicationLag === 'number') validMetrics.replicationLag = metrics.replicationLag;
      if (typeof metrics.consistencyViolations === 'number') validMetrics.consistencyViolations = metrics.consistencyViolations;
      if (typeof metrics.conflictResolutions === 'number') validMetrics.conflictResolutions = metrics.conflictResolutions;
      if (typeof metrics.availabilityPercentage === 'number') validMetrics.availabilityPercentage = metrics.availabilityPercentage;
      if (typeof metrics.partitionTolerance === 'boolean') validMetrics.partitionTolerance = metrics.partitionTolerance;
      if (typeof metrics.strongConsistencyPercentage === 'number') validMetrics.strongConsistencyPercentage = metrics.strongConsistencyPercentage;

      consistencyManager.updateConsistencyMetrics(componentId, validMetrics);
      const updatedMetrics = consistencyManager.getConsistencyMetrics(componentId);
      const events = consistencyManager.getConsistencyEvents(componentId);

      res.json({
        componentId,
        metrics: updatedMetrics,
        events: events.filter(e => !e.resolved),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update consistency metrics',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get consistency metrics
  public static getConsistencyMetrics(req: Request, res: Response): void {
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

      const metrics = consistencyManager.getConsistencyMetrics(componentId);
      
      if (!metrics) {
        res.status(404).json({
          error: {
            code: 'METRICS_NOT_FOUND',
            message: `Consistency metrics not found for component '${componentId}'`,
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
          message: 'Failed to retrieve consistency metrics',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get consistency events
  public static getConsistencyEvents(req: Request, res: Response): void {
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

      const events = consistencyManager.getConsistencyEvents(componentId);

      res.json({
        componentId,
        events,
        eventCount: events.length,
        unresolvedCount: events.filter(e => !e.resolved).length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve consistency events',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Resolve consistency event
  public static resolveConsistencyEvent(req: Request, res: Response): void {
    try {
      const { componentId, eventId } = req.params;
      
      if (!componentId || !eventId) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'Component ID and Event ID are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const resolved = consistencyManager.resolveConsistencyEvent(componentId, eventId);
      
      if (!resolved) {
        res.status(404).json({
          error: {
            code: 'EVENT_NOT_FOUND',
            message: `Event '${eventId}' not found for component '${componentId}'`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.json({
        componentId,
        eventId,
        resolved: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resolve consistency event',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  // Get replication factor
  public static getReplicationFactor(req: Request, res: Response): void {
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

      const replicationFactor = consistencyManager.getReplicationFactor(componentKey);
      const supportsStrongConsistency = consistencyManager.supportsStrongConsistency(componentKey);
      const guarantees = consistencyManager.getConsistencyGuarantees(componentKey);

      res.json({
        componentKey,
        replicationFactor,
        supportsStrongConsistency,
        consistencyGuarantees: guarantees,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve replication information',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }
}