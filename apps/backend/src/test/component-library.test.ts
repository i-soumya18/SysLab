/**
 * Component Library Tests
 * Tests for SRS FR-3.1: Standard Component Catalog implementation
 */

import { describe, it, expect } from 'vitest';
import { componentLibrary } from '../components/ComponentLibrary';
import { capacityManager } from '../components/CapacityManager';
import { scalingManager } from '../components/ScalingManager';
import { consistencyManager } from '../components/ConsistencyManager';

describe('Component Library - SRS FR-3.1', () => {
  describe('Standard Component Catalog', () => {
    it('should provide Load Balancer components with proper configuration', () => {
      const nginxConfig = componentLibrary.getComponentConfig('load-balancer-nginx');
      const nginxMetadata = componentLibrary.getComponentMetadata('load-balancer-nginx');

      expect(nginxConfig).toBeDefined();
      expect(nginxMetadata).toBeDefined();
      expect(nginxConfig?.algorithm).toBe('round-robin');
      expect(nginxConfig?.healthCheck).toBe(true);
      expect(nginxConfig?.sslTermination).toBe(true);
      expect(nginxMetadata?.name).toBe('Nginx Load Balancer');
    });

    it('should provide Database components with ACID properties', () => {
      const mysqlConfig = componentLibrary.getComponentConfig('database-mysql');
      const postgresConfig = componentLibrary.getComponentConfig('database-postgresql');

      expect(mysqlConfig).toBeDefined();
      expect(postgresConfig).toBeDefined();
      expect(mysqlConfig?.acidCompliance).toBeDefined();
      expect(mysqlConfig?.acidCompliance.atomicity).toBe(true);
      expect(mysqlConfig?.acidCompliance.consistency).toBe('strong');
      expect(mysqlConfig?.acidCompliance.isolation).toBe('repeatable-read');
      expect(mysqlConfig?.acidCompliance.durability).toBe(true);
    });

    it('should provide Cache components with eviction policies', () => {
      const redisConfig = componentLibrary.getComponentConfig('cache-redis');
      const memcachedConfig = componentLibrary.getComponentConfig('cache-memcached');

      expect(redisConfig).toBeDefined();
      expect(memcachedConfig).toBeDefined();
      expect(redisConfig?.evictionPolicy).toBe('allkeys-lru');
      expect(memcachedConfig?.evictionPolicy).toBe('LRU');
      expect(redisConfig?.maxMemoryPolicy).toBe('allkeys-lru');
    });

    it('should provide Queue components with messaging patterns', () => {
      const kafkaConfig = componentLibrary.getComponentConfig('queue-kafka');
      const rabbitmqConfig = componentLibrary.getComponentConfig('queue-rabbitmq');

      expect(kafkaConfig).toBeDefined();
      expect(rabbitmqConfig).toBeDefined();
      expect(kafkaConfig?.messagingPattern).toBe('publish-subscribe');
      expect(rabbitmqConfig?.messagingPattern).toBe('point-to-point');
      expect(kafkaConfig?.ordering).toBe('FIFO');
      expect(kafkaConfig?.deadLetterQueue).toBe(false);
      expect(rabbitmqConfig?.deadLetterQueue).toBe(true);
    });

    it('should provide CDN components with geographic distribution', () => {
      const cloudflareConfig = componentLibrary.getComponentConfig('cdn-cloudflare');
      const awsConfig = componentLibrary.getComponentConfig('cdn-awsCloudfront');

      expect(cloudflareConfig).toBeDefined();
      expect(awsConfig).toBeDefined();
      expect(cloudflareConfig?.geographicDistribution).toBeDefined();
      expect(cloudflareConfig?.geographicDistribution.regions).toContain('North America');
      expect(cloudflareConfig?.geographicDistribution.popLocations).toBeDefined();
      expect(cloudflareConfig?.geographicDistribution.popLocations.length).toBeGreaterThan(0);
    });

    it('should provide Service components with scaling options', () => {
      const nodejsConfig = componentLibrary.getComponentConfig('service-nodejs');
      const javaConfig = componentLibrary.getComponentConfig('service-java');

      expect(nodejsConfig).toBeDefined();
      expect(javaConfig).toBeDefined();
      expect(nodejsConfig?.scalingOptions).toBeDefined();
      expect(nodejsConfig?.scalingOptions.vertical.enabled).toBe(true);
      expect(nodejsConfig?.scalingOptions.horizontal.enabled).toBe(true);
      expect(nodejsConfig?.scalingOptions.autoScaling.enabled).toBe(true);
    });
  });

  describe('Component Creation', () => {
    it('should create components with proper metadata', () => {
      const component = componentLibrary.createComponent(
        'load-balancer-nginx',
        'load-balancer',
        { x: 100, y: 200 }
      );

      expect(component).toBeDefined();
      expect(component?.id).toBeDefined();
      expect(component?.type).toBe('load-balancer');
      expect(component?.position).toEqual({ x: 100, y: 200 });
      expect(component?.metadata.name).toBe('Nginx Load Balancer');
      expect(component?.configuration.algorithm).toBe('round-robin');
    });

    it('should return null for invalid component keys', () => {
      const component = componentLibrary.createComponent(
        'invalid-component',
        'database',
        { x: 0, y: 0 }
      );

      expect(component).toBeNull();
    });
  });

  describe('Component Types and Filtering', () => {
    it('should list all available components', () => {
      const components = componentLibrary.getAvailableComponents();
      
      expect(components.length).toBeGreaterThan(0);
      expect(components).toContain('load-balancer-nginx');
      expect(components).toContain('database-mysql');
      expect(components).toContain('cache-redis');
      expect(components).toContain('queue-kafka');
      expect(components).toContain('cdn-cloudflare');
      expect(components).toContain('service-nodejs');
    });

    it('should filter components by type', () => {
      const databases = componentLibrary.getComponentsByType('database');
      const loadBalancers = componentLibrary.getComponentsByType('load-balancer');
      const caches = componentLibrary.getComponentsByType('cache');

      expect(databases.length).toBeGreaterThan(0);
      expect(loadBalancers.length).toBeGreaterThan(0);
      expect(caches.length).toBeGreaterThan(0);
      
      expect(databases.every(db => db.startsWith('database-'))).toBe(true);
      expect(loadBalancers.every(lb => lb.startsWith('load-balancer-'))).toBe(true);
      expect(caches.every(cache => cache.startsWith('cache-'))).toBe(true);
    });
  });
});

describe('Capacity Manager - SRS FR-3.2', () => {
  it('should provide capacity limits for all component types', () => {
    const nginxLimits = capacityManager.getCapacityLimits('load-balancer-nginx');
    const mysqlLimits = capacityManager.getCapacityLimits('database-mysql');
    const redisLimits = capacityManager.getCapacityLimits('cache-redis');

    expect(nginxLimits).toBeDefined();
    expect(mysqlLimits).toBeDefined();
    expect(redisLimits).toBeDefined();

    expect(nginxLimits?.maxThroughput).toBeGreaterThan(0);
    expect(mysqlLimits?.maxConnections).toBeGreaterThan(0);
    expect(redisLimits?.maxMemoryUsage).toBeGreaterThan(0);
  });

  it('should detect capacity violations and generate alerts', () => {
    const componentId = 'test-component-1';
    const componentKey = 'database-mysql';

    // Update metrics to exceed capacity
    capacityManager.updateCapacityMetrics(componentId, componentKey, {
      currentThroughput: 1200, // Exceeds MySQL limit of 1000
      currentCpuUsage: 95,     // Exceeds threshold
      currentMemoryUsage: 4500 // Exceeds limit
    });

    const alerts = capacityManager.getActiveAlerts(componentId);
    expect(alerts.length).toBeGreaterThan(0);
    
    const criticalAlerts = alerts.filter(alert => alert.alertType === 'critical' || alert.alertType === 'capacity_exceeded');
    expect(criticalAlerts.length).toBeGreaterThan(0);
  });
});

describe('Scaling Manager - SRS FR-3.3', () => {
  it('should provide vertical scaling configurations', () => {
    const nodejsVertical = scalingManager.getVerticalScalingConfig('service-nodejs');
    const mysqlVertical = scalingManager.getVerticalScalingConfig('database-mysql');

    expect(nodejsVertical).toBeDefined();
    expect(mysqlVertical).toBeDefined();
    expect(nodejsVertical?.enabled).toBe(true);
    expect(nodejsVertical?.minCpu).toBeLessThan(nodejsVertical?.maxCpu);
    expect(mysqlVertical?.scaleUpThreshold).toBeGreaterThan(0);
  });

  it('should provide horizontal scaling configurations', () => {
    const nodejsHorizontal = scalingManager.getHorizontalScalingConfig('service-nodejs');
    const kafkaHorizontal = scalingManager.getHorizontalScalingConfig('queue-kafka');

    expect(nodejsHorizontal).toBeDefined();
    expect(kafkaHorizontal).toBeDefined();
    expect(nodejsHorizontal?.enabled).toBe(true);
    expect(nodejsHorizontal?.minInstances).toBeLessThan(nodejsHorizontal?.maxInstances);
    expect(kafkaHorizontal?.minInstances).toBe(3); // Minimum for fault tolerance
  });

  it('should provide auto-scaling policies', () => {
    const nodejsPolicy = scalingManager.getAutoScalingPolicy('service-nodejs');
    const databasePolicy = scalingManager.getAutoScalingPolicy('database-mysql');

    expect(nodejsPolicy).toBeDefined();
    expect(databasePolicy).toBeDefined();
    expect(nodejsPolicy?.enabled).toBe(true);
    expect(nodejsPolicy?.metrics).toContain('cpu');
    expect(nodejsPolicy?.scaleUpActions.length).toBeGreaterThan(0);
  });

  it('should evaluate scaling needs based on metrics', () => {
    const componentId = 'test-service-1';
    const componentKey = 'service-nodejs';

    // First update capacity metrics to simulate high load
    capacityManager.updateCapacityMetrics(componentId, componentKey, {
      currentCpuUsage: 85,
      currentMemoryUsage: 75,
      currentThroughput: 2800
    });

    const recommendation = scalingManager.evaluateScalingNeeds(componentId, componentKey);
    
    expect(recommendation).toBeDefined();
    expect(recommendation?.urgency).toMatch(/medium|high|critical/);
    expect(recommendation?.suggestedActions.length).toBeGreaterThan(0);
  });
});

describe('Consistency Manager - SRS FR-3.4', () => {
  it('should provide database consistency configurations with ACID properties', () => {
    const mysqlConsistency = consistencyManager.getDatabaseConsistencyConfig('database-mysql');
    const postgresConsistency = consistencyManager.getDatabaseConsistencyConfig('database-postgresql');
    const mongoConsistency = consistencyManager.getDatabaseConsistencyConfig('database-mongodb');

    expect(mysqlConsistency).toBeDefined();
    expect(postgresConsistency).toBeDefined();
    expect(mongoConsistency).toBeDefined();

    // MySQL should have strong consistency
    expect(mysqlConsistency?.consistencyLevel).toBe('strong');
    expect(mysqlConsistency?.acidCompliance.level).toBe('full');
    
    // PostgreSQL should have strongest guarantees
    expect(postgresConsistency?.isolationLevel).toBe('serializable');
    expect(postgresConsistency?.replicationConfig.syncMode).toBe('synchronous');
    
    // MongoDB should have eventual consistency
    expect(mongoConsistency?.consistencyLevel).toBe('eventual');
    expect(mongoConsistency?.replicationConfig.conflictResolution).toBe('vector-clocks');
  });

  it('should provide cache consistency configurations with replication settings', () => {
    const redisConsistency = consistencyManager.getCacheConsistencyConfig('cache-redis');
    const memcachedConsistency = consistencyManager.getCacheConsistencyConfig('cache-memcached');

    expect(redisConsistency).toBeDefined();
    expect(memcachedConsistency).toBeDefined();

    expect(redisConsistency?.replicationConfig.enabled).toBe(true);
    expect(redisConsistency?.replicationConfig.replicationFactor).toBeGreaterThan(1);
    expect(memcachedConsistency?.partitioning.enabled).toBe(true);
    expect(memcachedConsistency?.partitioning.strategy).toBe('consistent-hash');
  });

  it('should analyze CAP theorem trade-offs', () => {
    const mysqlAnalysis = consistencyManager.analyzeCAPTradeoffs('database-mysql');
    const mongoAnalysis = consistencyManager.analyzeCAPTradeoffs('database-mongodb');

    expect(mysqlAnalysis).toBeDefined();
    expect(mongoAnalysis).toBeDefined();

    // MySQL should favor consistency
    expect(mysqlAnalysis.consistency).toBeGreaterThan(80);
    
    // MongoDB should favor availability and partition tolerance
    expect(mongoAnalysis.availability).toBeGreaterThan(mongoAnalysis.consistency);
    expect(mongoAnalysis.partitionTolerance).toBeGreaterThan(80);
    
    expect(mysqlAnalysis.recommendations.length).toBeGreaterThan(0);
    expect(mongoAnalysis.optimalFor.length).toBeGreaterThan(0);
  });

  it('should provide replication factors and consistency guarantees', () => {
    const mysqlReplication = consistencyManager.getReplicationFactor('database-mysql');
    const postgresReplication = consistencyManager.getReplicationFactor('database-postgresql');
    const redisReplication = consistencyManager.getReplicationFactor('cache-redis');

    expect(mysqlReplication).toBe(2);
    expect(postgresReplication).toBe(3);
    expect(redisReplication).toBe(2);

    const mysqlGuarantees = consistencyManager.getConsistencyGuarantees('database-mysql');
    expect(mysqlGuarantees).toContain('Consistency Level: strong');
    expect(mysqlGuarantees).toContain('Full ACID Compliance');
    expect(mysqlGuarantees).toContain('Replication Factor: 2');
  });
});