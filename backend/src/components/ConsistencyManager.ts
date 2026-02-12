/**
 * Consistency and Replication Manager for System Design Simulator
 * Implements SRS FR-3.4: Database consistency levels and cache consistency/replication settings
 */

import type { ComponentType } from '../types';

// Consistency level interfaces
export interface DatabaseConsistencyConfig {
  consistencyLevel: 'strong' | 'eventual' | 'weak' | 'session' | 'bounded-staleness';
  isolationLevel: 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
  replicationConfig: DatabaseReplicationConfig;
  transactionSupport: boolean;
  acidCompliance: ACIDCompliance;
  readPreference: 'primary' | 'secondary' | 'nearest' | 'primary-preferred' | 'secondary-preferred';
  writeConcern: WriteConcern;
  readConcern: ReadConcern;
}

export interface DatabaseReplicationConfig {
  enabled: boolean;
  replicationFactor: number;
  replicationStrategy: 'master-slave' | 'master-master' | 'peer-to-peer' | 'sharded';
  syncMode: 'synchronous' | 'asynchronous' | 'semi-synchronous';
  failoverMode: 'automatic' | 'manual';
  backupStrategy: 'continuous' | 'snapshot' | 'incremental';
  geographicDistribution: GeographicReplication[];
  conflictResolution: 'last-write-wins' | 'vector-clocks' | 'application-defined' | 'merge';
}

export interface CacheConsistencyConfig {
  consistencyModel: 'strong' | 'eventual' | 'weak' | 'session';
  replicationConfig: CacheReplicationConfig;
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO' | 'Random' | 'TTL' | 'allkeys-lru' | 'allkeys-lfu';
  invalidationStrategy: 'write-through' | 'write-behind' | 'write-around' | 'refresh-ahead';
  coherenceProtocol: 'MSI' | 'MESI' | 'MOESI' | 'directory-based';
  partitioning: CachePartitioning;
}

export interface CacheReplicationConfig {
  enabled: boolean;
  replicationFactor: number;
  replicationMode: 'master-slave' | 'peer-to-peer' | 'distributed-hash';
  syncMode: 'synchronous' | 'asynchronous';
  consistencyGuarantees: string[];
  failoverBehavior: 'fail-fast' | 'degrade-gracefully' | 'read-from-replica';
  hotStandby: boolean;
}

export interface ACIDCompliance {
  atomicity: boolean;
  consistency: boolean;
  isolation: boolean;
  durability: boolean;
  level: 'full' | 'partial' | 'none';
}

export interface WriteConcern {
  w: number | 'majority' | string;
  j: boolean; // journal
  wtimeout: number; // milliseconds
}

export interface ReadConcern {
  level: 'local' | 'available' | 'majority' | 'linearizable' | 'snapshot';
}

export interface GeographicReplication {
  region: string;
  datacenter: string;
  replicaCount: number;
  priority: number;
  latency: number; // milliseconds
}

export interface CachePartitioning {
  enabled: boolean;
  strategy: 'hash' | 'range' | 'directory' | 'consistent-hash';
  partitionCount: number;
  rebalancing: 'automatic' | 'manual';
}

export interface ConsistencyMetrics {
  componentId: string;
  timestamp: number;
  readLatency: number;
  writeLatency: number;
  replicationLag: number;
  consistencyViolations: number;
  conflictResolutions: number;
  availabilityPercentage: number;
  partitionTolerance: boolean;
  strongConsistencyPercentage: number;
}

export interface ConsistencyEvent {
  id: string;
  componentId: string;
  componentType: ComponentType;
  eventType: 'consistency-violation' | 'replication-lag' | 'failover' | 'conflict-resolution';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedOperations: string[];
  resolutionStrategy: string;
  timestamp: number;
  resolved: boolean;
  resolutionTime?: number;
}

// CAP Theorem trade-off analysis
export interface CAPAnalysis {
  consistency: number;    // 0-100 score
  availability: number;   // 0-100 score
  partitionTolerance: number; // 0-100 score
  tradeOffs: string[];
  recommendations: string[];
  optimalFor: string[];
}

export class ConsistencyManager {
  private static instance: ConsistencyManager;
  private databaseConfigs: Map<string, DatabaseConsistencyConfig>;
  private cacheConfigs: Map<string, CacheConsistencyConfig>;
  private consistencyMetrics: Map<string, ConsistencyMetrics>;
  private consistencyEvents: Map<string, ConsistencyEvent[]>;

  private constructor() {
    this.databaseConfigs = new Map();
    this.cacheConfigs = new Map();
    this.consistencyMetrics = new Map();
    this.consistencyEvents = new Map();
    this.initializeConsistencyConfigurations();
  }

  public static getInstance(): ConsistencyManager {
    if (!ConsistencyManager.instance) {
      ConsistencyManager.instance = new ConsistencyManager();
    }
    return ConsistencyManager.instance;
  }

  private initializeConsistencyConfigurations(): void {
    // MySQL consistency configuration
    this.databaseConfigs.set('database-mysql', {
      consistencyLevel: 'strong',
      isolationLevel: 'repeatable-read',
      replicationConfig: {
        enabled: true,
        replicationFactor: 2,
        replicationStrategy: 'master-slave',
        syncMode: 'asynchronous',
        failoverMode: 'manual',
        backupStrategy: 'incremental',
        geographicDistribution: [
          { region: 'us-east-1', datacenter: 'primary', replicaCount: 1, priority: 1, latency: 0 },
          { region: 'us-west-2', datacenter: 'secondary', replicaCount: 1, priority: 2, latency: 50 }
        ],
        conflictResolution: 'last-write-wins'
      },
      transactionSupport: true,
      acidCompliance: {
        atomicity: true,
        consistency: true,
        isolation: true,
        durability: true,
        level: 'full'
      },
      readPreference: 'primary',
      writeConcern: { w: 1, j: true, wtimeout: 5000 },
      readConcern: { level: 'majority' }
    });

    // PostgreSQL consistency configuration
    this.databaseConfigs.set('database-postgresql', {
      consistencyLevel: 'strong',
      isolationLevel: 'serializable',
      replicationConfig: {
        enabled: true,
        replicationFactor: 3,
        replicationStrategy: 'master-slave',
        syncMode: 'synchronous',
        failoverMode: 'automatic',
        backupStrategy: 'continuous',
        geographicDistribution: [
          { region: 'us-east-1', datacenter: 'primary', replicaCount: 1, priority: 1, latency: 0 },
          { region: 'us-west-2', datacenter: 'secondary', replicaCount: 1, priority: 2, latency: 50 },
          { region: 'eu-west-1', datacenter: 'secondary', replicaCount: 1, priority: 3, latency: 100 }
        ],
        conflictResolution: 'application-defined'
      },
      transactionSupport: true,
      acidCompliance: {
        atomicity: true,
        consistency: true,
        isolation: true,
        durability: true,
        level: 'full'
      },
      readPreference: 'primary',
      writeConcern: { w: 'majority', j: true, wtimeout: 10000 },
      readConcern: { level: 'linearizable' }
    });

    // MongoDB consistency configuration
    this.databaseConfigs.set('database-mongodb', {
      consistencyLevel: 'eventual',
      isolationLevel: 'read-committed',
      replicationConfig: {
        enabled: true,
        replicationFactor: 3,
        replicationStrategy: 'peer-to-peer',
        syncMode: 'asynchronous',
        failoverMode: 'automatic',
        backupStrategy: 'snapshot',
        geographicDistribution: [
          { region: 'us-east-1', datacenter: 'primary', replicaCount: 1, priority: 1, latency: 0 },
          { region: 'us-west-2', datacenter: 'secondary', replicaCount: 1, priority: 2, latency: 50 },
          { region: 'ap-southeast-1', datacenter: 'secondary', replicaCount: 1, priority: 3, latency: 150 }
        ],
        conflictResolution: 'vector-clocks'
      },
      transactionSupport: true,
      acidCompliance: {
        atomicity: true,
        consistency: false,
        isolation: true,
        durability: true,
        level: 'partial'
      },
      readPreference: 'secondary-preferred',
      writeConcern: { w: 'majority', j: true, wtimeout: 5000 },
      readConcern: { level: 'majority' }
    });

    // Redis database consistency configuration
    this.databaseConfigs.set('database-redis', {
      consistencyLevel: 'eventual',
      isolationLevel: 'read-uncommitted',
      replicationConfig: {
        enabled: false,
        replicationFactor: 1,
        replicationStrategy: 'master-slave',
        syncMode: 'asynchronous',
        failoverMode: 'manual',
        backupStrategy: 'snapshot',
        geographicDistribution: [
          { region: 'us-east-1', datacenter: 'primary', replicaCount: 1, priority: 1, latency: 0 }
        ],
        conflictResolution: 'last-write-wins'
      },
      transactionSupport: false,
      acidCompliance: {
        atomicity: false,
        consistency: false,
        isolation: false,
        durability: false,
        level: 'none'
      },
      readPreference: 'primary',
      writeConcern: { w: 1, j: false, wtimeout: 1000 },
      readConcern: { level: 'local' }
    });

    // Redis cache consistency configuration
    this.cacheConfigs.set('cache-redis', {
      consistencyModel: 'eventual',
      replicationConfig: {
        enabled: true,
        replicationFactor: 2,
        replicationMode: 'master-slave',
        syncMode: 'asynchronous',
        consistencyGuarantees: ['read-your-writes', 'monotonic-reads'],
        failoverBehavior: 'degrade-gracefully',
        hotStandby: true
      },
      evictionPolicy: 'allkeys-lru',
      invalidationStrategy: 'write-through',
      coherenceProtocol: 'MSI',
      partitioning: {
        enabled: false,
        strategy: 'hash',
        partitionCount: 1,
        rebalancing: 'automatic'
      }
    });

    // Memcached cache consistency configuration
    this.cacheConfigs.set('cache-memcached', {
      consistencyModel: 'weak',
      replicationConfig: {
        enabled: true,
        replicationFactor: 3,
        replicationMode: 'distributed-hash',
        syncMode: 'asynchronous',
        consistencyGuarantees: ['eventual-consistency'],
        failoverBehavior: 'fail-fast',
        hotStandby: false
      },
      evictionPolicy: 'LRU',
      invalidationStrategy: 'write-around',
      coherenceProtocol: 'directory-based',
      partitioning: {
        enabled: true,
        strategy: 'consistent-hash',
        partitionCount: 16,
        rebalancing: 'automatic'
      }
    });

    // Varnish cache consistency configuration
    this.cacheConfigs.set('cache-varnish', {
      consistencyModel: 'strong',
      replicationConfig: {
        enabled: false,
        replicationFactor: 1,
        replicationMode: 'master-slave',
        syncMode: 'synchronous',
        consistencyGuarantees: ['strong-consistency'],
        failoverBehavior: 'fail-fast',
        hotStandby: false
      },
      evictionPolicy: 'LRU',
      invalidationStrategy: 'write-through',
      coherenceProtocol: 'MESI',
      partitioning: {
        enabled: false,
        strategy: 'hash',
        partitionCount: 1,
        rebalancing: 'manual'
      }
    });
  }

  // Get database consistency configuration
  public getDatabaseConsistencyConfig(componentKey: string): DatabaseConsistencyConfig | undefined {
    return this.databaseConfigs.get(componentKey);
  }

  // Get cache consistency configuration
  public getCacheConsistencyConfig(componentKey: string): CacheConsistencyConfig | undefined {
    return this.cacheConfigs.get(componentKey);
  }

  // Update database consistency configuration
  public updateDatabaseConsistencyConfig(componentKey: string, config: Partial<DatabaseConsistencyConfig>): void {
    const currentConfig = this.databaseConfigs.get(componentKey);
    if (currentConfig) {
      this.databaseConfigs.set(componentKey, { ...currentConfig, ...config });
    }
  }

  // Update cache consistency configuration
  public updateCacheConsistencyConfig(componentKey: string, config: Partial<CacheConsistencyConfig>): void {
    const currentConfig = this.cacheConfigs.get(componentKey);
    if (currentConfig) {
      this.cacheConfigs.set(componentKey, { ...currentConfig, ...config });
    }
  }

  // Analyze CAP theorem trade-offs
  public analyzeCAPTradeoffs(componentKey: string): CAPAnalysis {
    const dbConfig = this.getDatabaseConsistencyConfig(componentKey);
    const cacheConfig = this.getCacheConsistencyConfig(componentKey);
    
    let consistency = 50;
    let availability = 50;
    let partitionTolerance = 50;
    const tradeOffs: string[] = [];
    const recommendations: string[] = [];
    const optimalFor: string[] = [];

    if (dbConfig) {
      // Analyze database configuration
      switch (dbConfig.consistencyLevel) {
        case 'strong':
          consistency = 95;
          availability = 70;
          partitionTolerance = 60;
          tradeOffs.push('Strong consistency reduces availability during network partitions');
          optimalFor.push('Financial transactions', 'Critical data integrity');
          break;
        case 'eventual':
          consistency = 70;
          availability = 95;
          partitionTolerance = 90;
          tradeOffs.push('High availability at the cost of temporary inconsistency');
          optimalFor.push('Social media feeds', 'Content distribution');
          break;
        case 'weak':
          consistency = 40;
          availability = 98;
          partitionTolerance = 95;
          tradeOffs.push('Maximum availability with minimal consistency guarantees');
          optimalFor.push('Analytics', 'Logging systems');
          break;
      }

      if (dbConfig.replicationConfig.enabled) {
        availability += 10;
        partitionTolerance += 15;
        if (dbConfig.replicationConfig.syncMode === 'synchronous') {
          consistency += 10;
          availability -= 5;
        }
      }

      if (dbConfig.transactionSupport && dbConfig.acidCompliance.level === 'full') {
        consistency += 15;
        availability -= 10;
        recommendations.push('Consider relaxing ACID guarantees for better availability');
      }
    }

    if (cacheConfig) {
      // Analyze cache configuration
      switch (cacheConfig.consistencyModel) {
        case 'strong':
          consistency = Math.max(consistency, 90);
          availability -= 10;
          break;
        case 'eventual':
          availability += 10;
          partitionTolerance += 10;
          break;
        case 'weak':
          availability += 15;
          partitionTolerance += 15;
          consistency -= 20;
          break;
      }

      if (cacheConfig.replicationConfig.enabled) {
        availability += 5;
        partitionTolerance += 10;
      }
    }

    // Normalize scores to 0-100 range
    consistency = Math.min(100, Math.max(0, consistency));
    availability = Math.min(100, Math.max(0, availability));
    partitionTolerance = Math.min(100, Math.max(0, partitionTolerance));

    // Generate recommendations based on scores
    if (consistency > 80 && availability < 70) {
      recommendations.push('Consider eventual consistency for better availability');
    }
    if (availability > 90 && consistency < 60) {
      recommendations.push('Implement read-your-writes consistency for better user experience');
    }
    if (partitionTolerance < 70) {
      recommendations.push('Improve partition tolerance with better replication strategy');
    }

    return {
      consistency,
      availability,
      partitionTolerance,
      tradeOffs,
      recommendations,
      optimalFor
    };
  }

  // Update consistency metrics
  public updateConsistencyMetrics(componentId: string, metrics: Partial<ConsistencyMetrics>): void {
    const currentMetrics = this.consistencyMetrics.get(componentId) || {
      componentId,
      timestamp: Date.now(),
      readLatency: 0,
      writeLatency: 0,
      replicationLag: 0,
      consistencyViolations: 0,
      conflictResolutions: 0,
      availabilityPercentage: 100,
      partitionTolerance: true,
      strongConsistencyPercentage: 100
    };

    const updatedMetrics: ConsistencyMetrics = {
      ...currentMetrics,
      ...metrics,
      timestamp: Date.now()
    };

    this.consistencyMetrics.set(componentId, updatedMetrics);

    // Check for consistency violations and generate events
    this.checkConsistencyViolations(componentId, updatedMetrics);
  }

  private checkConsistencyViolations(componentId: string, metrics: ConsistencyMetrics): void {
    const events: ConsistencyEvent[] = [];

    // Check for high replication lag
    if (metrics.replicationLag > 1000) { // > 1 second
      events.push({
        id: `${componentId}-replication-lag-${Date.now()}`,
        componentId,
        componentType: 'database',
        eventType: 'replication-lag',
        severity: metrics.replicationLag > 5000 ? 'critical' : 'high',
        description: `High replication lag detected: ${metrics.replicationLag}ms`,
        affectedOperations: ['read', 'write'],
        resolutionStrategy: 'Monitor replication health and consider scaling',
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check for consistency violations
    if (metrics.consistencyViolations > 0) {
      events.push({
        id: `${componentId}-consistency-violation-${Date.now()}`,
        componentId,
        componentType: 'database',
        eventType: 'consistency-violation',
        severity: 'high',
        description: `${metrics.consistencyViolations} consistency violations detected`,
        affectedOperations: ['read', 'write'],
        resolutionStrategy: 'Review consistency configuration and conflict resolution',
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check for low availability
    if (metrics.availabilityPercentage < 99) {
      events.push({
        id: `${componentId}-low-availability-${Date.now()}`,
        componentId,
        componentType: 'database',
        eventType: 'failover',
        severity: metrics.availabilityPercentage < 95 ? 'critical' : 'medium',
        description: `Low availability: ${metrics.availabilityPercentage}%`,
        affectedOperations: ['read', 'write'],
        resolutionStrategy: 'Check replica health and failover mechanisms',
        timestamp: Date.now(),
        resolved: false
      });
    }

    if (events.length > 0) {
      const existingEvents = this.consistencyEvents.get(componentId) || [];
      this.consistencyEvents.set(componentId, [...existingEvents, ...events]);
    }
  }

  // Get consistency metrics
  public getConsistencyMetrics(componentId: string): ConsistencyMetrics | undefined {
    return this.consistencyMetrics.get(componentId);
  }

  // Get consistency events
  public getConsistencyEvents(componentId: string): ConsistencyEvent[] {
    return this.consistencyEvents.get(componentId) || [];
  }

  // Resolve consistency event
  public resolveConsistencyEvent(componentId: string, eventId: string): boolean {
    const events = this.consistencyEvents.get(componentId);
    if (!events) return false;

    const event = events.find(e => e.id === eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolutionTime = Date.now();
    return true;
  }

  // Get replication factor for a component
  public getReplicationFactor(componentKey: string): number {
    const dbConfig = this.getDatabaseConsistencyConfig(componentKey);
    const cacheConfig = this.getCacheConsistencyConfig(componentKey);
    
    return dbConfig?.replicationConfig.replicationFactor || 
           cacheConfig?.replicationConfig.replicationFactor || 1;
  }

  // Check if component supports strong consistency
  public supportsStrongConsistency(componentKey: string): boolean {
    const dbConfig = this.getDatabaseConsistencyConfig(componentKey);
    const cacheConfig = this.getCacheConsistencyConfig(componentKey);
    
    return (dbConfig?.consistencyLevel === 'strong') || 
           (cacheConfig?.consistencyModel === 'strong');
  }

  // Get consistency guarantees for a component
  public getConsistencyGuarantees(componentKey: string): string[] {
    const dbConfig = this.getDatabaseConsistencyConfig(componentKey);
    const cacheConfig = this.getCacheConsistencyConfig(componentKey);
    
    const guarantees: string[] = [];
    
    if (dbConfig) {
      guarantees.push(`Consistency Level: ${dbConfig.consistencyLevel}`);
      guarantees.push(`Isolation Level: ${dbConfig.isolationLevel}`);
      if (dbConfig.acidCompliance.level === 'full') {
        guarantees.push('Full ACID Compliance');
      }
      if (dbConfig.replicationConfig.enabled) {
        guarantees.push(`Replication Factor: ${dbConfig.replicationConfig.replicationFactor}`);
        guarantees.push(`Sync Mode: ${dbConfig.replicationConfig.syncMode}`);
      }
    }
    
    if (cacheConfig) {
      guarantees.push(`Cache Consistency: ${cacheConfig.consistencyModel}`);
      guarantees.push(...cacheConfig.replicationConfig.consistencyGuarantees);
    }
    
    return guarantees;
  }
}

// Export singleton instance
export const consistencyManager = ConsistencyManager.getInstance();