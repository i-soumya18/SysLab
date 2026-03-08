/**
 * Cost Modeling Service Tests
 * Tests for SRS FR-8: Cost Modeling Engine implementation
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { costModelingService, storageCostAnalyzer, networkCostAnalyzer, trafficCostScalingAnalyzer, costPerformanceTradeoffAnalyzer } from '../services/costModelingService';
import type { Component, ComponentType } from '../types';

describe('Cost Modeling Service', () => {
  let sampleComponents: Component[];

  beforeEach(() => {
    sampleComponents = [
      {
        id: 'lb-1',
        type: 'load-balancer' as ComponentType,
        position: { x: 0, y: 0 },
        configuration: {
          capacity: 10000,
          latency: 2,
          failureRate: 0.0001,
          algorithm: 'round-robin',
          maxConnections: 10000
        },
        metadata: {
          name: 'Load Balancer',
          version: '1.0',
          description: 'Test load balancer'
        }
      },
      {
        id: 'db-1',
        type: 'database' as ComponentType,
        position: { x: 100, y: 100 },
        configuration: {
          capacity: 1000,
          latency: 5,
          failureRate: 0.001,
          storageType: 'gp2',
          replicationFactor: 2
        },
        metadata: {
          name: 'Database',
          version: '1.0',
          description: 'Test database'
        }
      }
    ];
  });

  describe('SRS FR-8.1: Compute Cost Estimation', () => {
    test('should calculate compute costs for different user scales', () => {
      const userCounts = [100, 1000, 10000];
      
      userCounts.forEach(userCount => {
        const computeCost = costModelingService.calculateComputeCost(
          sampleComponents[0],
          userCount,
          'aws'
        );
        
        expect(computeCost).toBeDefined();
        expect(computeCost.hourlyRate).toBeGreaterThan(0);
        expect(computeCost.vcpus).toBeGreaterThan(0);
        expect(computeCost.memory).toBeGreaterThan(0);
        expect(computeCost.provider).toBe('aws');
      });
    });

    test('should select appropriate instance types based on user count', () => {
      const smallScale = costModelingService.calculateComputeCost(sampleComponents[0], 100, 'aws');
      const largeScale = costModelingService.calculateComputeCost(sampleComponents[0], 100000, 'aws');
      
      expect(largeScale.hourlyRate).toBeGreaterThan(smallScale.hourlyRate);
      expect(largeScale.vcpus).toBeGreaterThanOrEqual(smallScale.vcpus);
    });

    test('should handle auto-scaling cost implications', () => {
      const componentWithAutoScaling = {
        ...sampleComponents[0],
        configuration: {
          ...sampleComponents[0].configuration,
          scalingOptions: {
            autoScaling: { enabled: true },
            horizontal: { maxInstances: 10 }
          }
        }
      };

      const cost = costModelingService.calculateComputeCost(componentWithAutoScaling, 5000, 'aws');
      expect(cost.hourlyRate).toBeGreaterThan(0);
    });
  });

  describe('SRS FR-8.2: Storage Cost Modeling', () => {
    test('should calculate storage costs with replication', () => {
      const storageCost = costModelingService.calculateStorageCost(
        sampleComponents[1],
        100, // 100GB
        'aws'
      );
      
      expect(storageCost).toBeDefined();
      expect(storageCost.pricePerGB).toBeGreaterThan(0);
      expect(storageCost.replicationFactor).toBe(2);
    });

    test('should analyze storage tiers and recommend optimizations', () => {
      const analysis = storageCostAnalyzer.analyzeStorageTiers(
        sampleComponents[1],
        500, // 500GB
        {
          readFrequency: 100,
          writeFrequency: 50,
          dataRetention: 365
        },
        'aws'
      );
      
      expect(analysis).toBeDefined();
      expect(analysis.currentTier).toBeDefined();
      expect(analysis.recommendedTier).toBeDefined();
      expect(analysis.currentCost).toBeGreaterThan(0);
      expect(analysis.projectedCost).toBeGreaterThan(0);
    });

    test('should generate storage lifecycle policies', () => {
      const policies = storageCostAnalyzer.generateLifecyclePolicies(
        sampleComponents[1],
        1000, // 1TB
        {
          hotData: 30,
          warmData: 90,
          coldData: 365,
          archiveData: 2555 // 7 years
        },
        'aws'
      );
      
      expect(policies).toBeDefined();
      expect(policies.length).toBeGreaterThan(0);
      expect(policies[0].estimatedSavings).toBeGreaterThan(0);
    });
  });

  describe('SRS FR-8.3: Network Cost Estimation', () => {
    test('should calculate network costs for component connections', () => {
      const connections = [
        {
          sourceComponent: sampleComponents[0],
          targetComponent: sampleComponents[1],
          dataVolumeGB: 10
        }
      ];

      const networkCost = costModelingService.calculateNetworkCost(connections, 'aws');
      
      expect(networkCost).toBeDefined();
      expect(networkCost.dataTransferOut).toBeGreaterThan(0);
    });

    test('should analyze geographic distribution costs', () => {
      const userDistribution = [
        { region: 'us-east-1', userPercentage: 60, dataVolumeGB: 100 },
        { region: 'eu-west-1', userPercentage: 30, dataVolumeGB: 50 },
        { region: 'ap-southeast-1', userPercentage: 10, dataVolumeGB: 20 }
      ];

      const analysis = networkCostAnalyzer.analyzeGeographicCosts(
        sampleComponents,
        userDistribution,
        'aws'
      );
      
      expect(analysis).toBeDefined();
      expect(analysis.regionalCosts.length).toBe(3);
      expect(analysis.totalCost).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    test('should analyze CDN effectiveness', () => {
      const trafficPattern = {
        totalRequests: 1000000,
        dataVolumeGB: 500,
        cacheablePercentage: 80,
        globalDistribution: true
      };

      const cdnAnalysis = networkCostAnalyzer.analyzeCDNEffectiveness(
        sampleComponents,
        trafficPattern,
        'aws'
      );
      
      expect(cdnAnalysis).toBeDefined();
      expect(cdnAnalysis.length).toBeGreaterThan(0);
      expect(cdnAnalysis[0].costBreakdown).toBeDefined();
      expect(cdnAnalysis[0].performanceImpact).toBeDefined();
      expect(cdnAnalysis[0].roi).toBeDefined();
    });
  });

  describe('SRS FR-8.4: Traffic-Based Cost Scaling', () => {
    test('should calculate traffic-based cost scaling', () => {
      const trafficScaling = {
        userCount: 10000,
        requestsPerUser: 100,
        dataVolumePerUser: 5, // 5MB
        peakMultiplier: 3,
        averageMultiplier: 1.2,
        sessionDuration: 30
      };

      const scaling = costModelingService.calculateTrafficBasedCostScaling(
        sampleComponents,
        trafficScaling,
        'aws'
      );
      
      expect(scaling).toBeDefined();
      expect(scaling.peakCost.total).toBeGreaterThan(scaling.averageCost.total);
      expect(scaling.scalingAnalysis.costVariability).toBeGreaterThan(0);
    });

    test('should analyze traffic patterns and cost implications', () => {
      const historicalTraffic = [
        { timestamp: new Date('2024-01-01T08:00:00Z'), requestsPerSecond: 100, userCount: 1000, dataVolumeGB: 10 },
        { timestamp: new Date('2024-01-01T12:00:00Z'), requestsPerSecond: 500, userCount: 5000, dataVolumeGB: 50 },
        { timestamp: new Date('2024-01-01T20:00:00Z'), requestsPerSecond: 200, userCount: 2000, dataVolumeGB: 20 }
      ];

      const analysis = trafficCostScalingAnalyzer.analyzeTrafficPatterns(
        sampleComponents,
        historicalTraffic,
        'aws'
      );
      
      expect(analysis).toBeDefined();
      expect(analysis.patternType).toBeDefined();
      expect(analysis.characteristics).toBeDefined();
      expect(analysis.costImplications).toBeDefined();
      expect(analysis.scalingRecommendations.length).toBeGreaterThanOrEqual(0);
    });

    test('should analyze user load cost correlation', () => {
      const userScales = [1000, 10000, 100000];
      const userBehavior = {
        requestsPerUser: 50,
        dataPerUser: 2, // 2MB
        sessionDuration: 20,
        concurrencyRatio: 0.1
      };

      const correlation = trafficCostScalingAnalyzer.analyzeUserLoadCostCorrelation(
        sampleComponents,
        userScales,
        userBehavior,
        'aws'
      );
      
      expect(correlation).toBeDefined();
      expect(correlation.length).toBe(3);
      expect(correlation[2].costBreakdown.total).toBeGreaterThan(correlation[0].costBreakdown.total);
      expect(correlation[1].economiesOfScale).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SRS FR-8.5: Cost vs Performance Tradeoff Analysis', () => {
    test('should analyze performance cost tradeoffs', () => {
      const performanceRequirements = {
        maxLatency: 100,
        minThroughput: 1000,
        minAvailability: 99.9
      };

      const tradeoffs = costModelingService.analyzePerformanceCostTradeoffs(
        sampleComponents,
        10000,
        performanceRequirements,
        'aws'
      );
      
      expect(tradeoffs).toBeDefined();
      expect(tradeoffs.length).toBeGreaterThan(0);
      expect(tradeoffs[0].scenario).toBeDefined();
      expect(tradeoffs[0].performanceMetrics).toBeDefined();
      expect(tradeoffs[0].costMetrics).toBeDefined();
      expect(tradeoffs[0].efficiency).toBeDefined();
    });

    test('should generate performance cost matrix', () => {
      const requirements = {
        maxLatency: 50,
        minThroughput: 2000,
        minAvailability: 99.5,
        budgetConstraint: 1000
      };

      const matrix = costPerformanceTradeoffAnalyzer.generatePerformanceCostMatrix(
        sampleComponents,
        5000,
        requirements,
        'aws'
      );
      
      expect(matrix).toBeDefined();
      expect(matrix.scenarios.length).toBeGreaterThan(0);
      expect(matrix.paretoFrontier.length).toBeGreaterThan(0);
      expect(matrix.recommendations).toBeDefined();
      expect(matrix.tradeoffAnalysis).toBeDefined();
    });

    test('should generate cost-effective scaling strategies', () => {
      const performanceRequirements = {
        maxLatency: 100,
        minThroughput: 1000,
        targetAvailability: 99.9
      };

      const budgetConstraints = {
        maxInitialInvestment: 50000,
        maxMonthlyBudget: 10000
      };

      const strategies = costPerformanceTradeoffAnalyzer.generateCostEffectiveScalingStrategies(
        sampleComponents,
        1000,
        10000,
        performanceRequirements,
        budgetConstraints
      );
      
      expect(strategies).toBeDefined();
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].strategy).toBeDefined();
      expect(strategies[0].costImpact).toBeDefined();
      expect(strategies[0].performanceImpact).toBeDefined();
      expect(strategies[0].implementationPlan).toBeDefined();
    });
  });

  describe('Real-time Cost Estimation', () => {
    test('should provide real-time cost estimates', () => {
      const estimate = costModelingService.getRealTimeCostEstimate(
        sampleComponents,
        5000,
        'aws'
      );
      
      expect(estimate).toBeDefined();
      expect(estimate.hourly.total).toBeGreaterThan(0);
      expect(estimate.daily.total).toBe(estimate.hourly.total * 24);
      expect(estimate.monthly.total).toBe(estimate.hourly.total * 24 * 30);
      expect(estimate.projections.length).toBeGreaterThan(0);
    });

    test('should show cost scaling across different user counts', () => {
      const estimate = costModelingService.getRealTimeCostEstimate(
        sampleComponents,
        1000,
        'aws'
      );
      
      expect(estimate.projections).toBeDefined();
      expect(estimate.projections.length).toBe(5); // [100, 1000, 10000, 100000, 1000000]
      
      // Costs should generally increase with user count
      for (let i = 1; i < estimate.projections.length; i++) {
        expect(estimate.projections[i].cost).toBeGreaterThan(estimate.projections[i-1].cost);
      }
    });
  });

  describe('Cost Optimization Recommendations', () => {
    test('should generate cost optimization recommendations', () => {
      const currentCost = {
        compute: 500,
        storage: 200,
        network: 100,
        total: 800,
        currency: 'USD' as const,
        period: 'month' as const
      };

      const performanceBaseline = {
        latency: { p50: 50, p95: 100, p99: 200 },
        throughput: 1000,
        availability: 99.9,
        reliability: 99.5,
        scalability: 80
      };

      const acceptableDegradation = {
        latencyIncrease: 20,
        throughputDecrease: 10,
        availabilityDecrease: 0.1
      };

      const opportunities = costPerformanceTradeoffAnalyzer.analyzeCostOptimizationOpportunities(
        sampleComponents,
        currentCost,
        performanceBaseline,
        acceptableDegradation
      );
      
      expect(opportunities).toBeDefined();
      expect(opportunities.length).toBeGreaterThan(0);
      expect(opportunities[0].costSavings).toBeGreaterThan(0);
      expect(opportunities[0].recommendation).toBeDefined();
    });
  });
});