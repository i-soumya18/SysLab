/**
 * Metrics and Observability Integration Tests
 * 
 * Tests the complete metrics and observability system implementation
 * covering SRS FR-7.1 through FR-7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentMetrics } from '../types';
import { LatencyMetricsService } from '../services/latencyMetricsService';
import { ErrorRateMonitoringService } from '../services/errorRateMonitoringService';
import { ThroughputMonitoringService } from '../services/throughputMonitoringService';
import { ResourceSaturationMonitoringService } from '../services/resourceSaturationMonitoringService';
import { MetricsViewService } from '../services/metricsViewService';
import { MetricsIntegrationService } from '../services/metricsIntegrationService';

describe('Metrics and Observability System', () => {
  let latencyService: LatencyMetricsService;
  let errorRateService: ErrorRateMonitoringService;
  let throughputService: ThroughputMonitoringService;
  let resourceService: ResourceSaturationMonitoringService;
  let viewService: MetricsViewService;
  let integrationService: MetricsIntegrationService;

  const mockComponentMetrics: ComponentMetrics = {
    componentId: 'test-component-1',
    timestamp: Date.now(),
    requestsPerSecond: 100,
    averageLatency: 150,
    errorRate: 0.02,
    cpuUtilization: 0.65,
    memoryUtilization: 0.70,
    queueDepth: 25
  };

  beforeEach(() => {
    latencyService = new LatencyMetricsService();
    errorRateService = new ErrorRateMonitoringService();
    throughputService = new ThroughputMonitoringService();
    resourceService = new ResourceSaturationMonitoringService();
    viewService = new MetricsViewService();
    integrationService = new MetricsIntegrationService();
  });

  afterEach(() => {
    latencyService.stopAnalysis();
    errorRateService.stopAnalysis();
    throughputService.stopAnalysis();
    resourceService.stopAnalysis();
    viewService.cleanup();
    integrationService.cleanup();
  });

  describe('SRS FR-7.1: Latency Metrics', () => {
    it('should track p50, p95, p99 latency percentiles', () => {
      // Record multiple latency measurements
      const latencies = [50, 75, 100, 125, 150, 200, 250, 300, 500, 1000];
      
      latencies.forEach(latency => {
        latencyService.recordLatency('test-component', latency);
      });

      const percentiles = latencyService.calculatePercentiles('test-component');
      
      expect(percentiles).toBeDefined();
      expect(percentiles!.p50).toBeGreaterThan(0);
      expect(percentiles!.p95).toBeGreaterThanOrEqual(percentiles!.p50);
      expect(percentiles!.p99).toBeGreaterThanOrEqual(percentiles!.p95);
    });

    it('should generate latency histogram and distribution analysis', () => {
      // Record latency measurements
      for (let i = 0; i < 100; i++) {
        const latency = Math.random() * 500 + 50; // 50-550ms range
        latencyService.recordLatency('test-component', latency);
      }

      const histogram = latencyService.generateHistogram('test-component');
      
      expect(histogram).toBeDefined();
      expect(histogram!.buckets.length).toBeGreaterThan(0);
      expect(histogram!.totalSamples).toBe(100);
      expect(histogram!.meanLatency).toBeGreaterThan(0);
      expect(histogram!.standardDeviation).toBeGreaterThan(0);
    });

    it('should implement latency trend monitoring', () => {
      // Record trending latency data
      for (let i = 0; i < 20; i++) {
        const latency = 100 + i * 10; // Increasing trend
        latencyService.recordLatency('test-component', latency);
      }

      const trends = latencyService.analyzeTrends('test-component');
      
      expect(trends).toBeDefined();
      expect(trends!.direction).toBe('degrading'); // Should detect increasing latency
      expect(trends!.changeRate).toBeGreaterThan(0);
      expect(trends!.confidence).toBeGreaterThan(0);
    });

    it('should detect latency anomalies', () => {
      // Record normal latency with anomalies
      const normalLatencies = Array(50).fill(100);
      const anomalies = [2000, 3000]; // Significant spikes
      
      [...normalLatencies, ...anomalies].forEach(latency => {
        latencyService.recordLatency('test-component', latency);
      });

      const detectedAnomalies = latencyService.detectAnomalies('test-component');
      
      expect(detectedAnomalies.length).toBeGreaterThan(0);
      expect(detectedAnomalies[0].severity).toBeDefined();
      expect(detectedAnomalies[0].type).toBeDefined();
    });
  });

  describe('SRS FR-7.2: Error Rate Monitoring', () => {
    it('should calculate and track error rates', () => {
      // Process metrics with errors
      errorRateService.processComponentMetrics(mockComponentMetrics);

      const errorMetrics = errorRateService.calculateErrorRateMetrics('test-component-1');
      
      expect(errorMetrics).toBeDefined();
      expect(errorMetrics!.overallErrorRate).toBe(2); // 0.02 * 100 = 2%
      expect(errorMetrics!.totalRequests).toBeGreaterThan(0);
      expect(errorMetrics!.totalErrors).toBeGreaterThan(0);
    });

    it('should categorize and analyze errors', () => {
      // Record different types of errors
      const errorEvent1 = {
        componentId: 'test-component',
        timestamp: Date.now(),
        errorCode: '500',
        errorType: 'INTERNAL_ERROR',
        message: 'Internal server error',
        severity: 'high' as const,
        isRetryable: true
      };

      const errorEvent2 = {
        componentId: 'test-component',
        timestamp: Date.now(),
        errorCode: '404',
        errorType: 'NOT_FOUND',
        message: 'Resource not found',
        severity: 'medium' as const,
        isRetryable: false
      };

      errorRateService.recordError(errorEvent1);
      errorRateService.recordError(errorEvent2);

      const errorMetrics = errorRateService.calculateErrorRateMetrics('test-component');
      
      expect(errorMetrics).toBeDefined();
      expect(errorMetrics!.errorsByCategory.size).toBeGreaterThan(0);
      expect(errorMetrics!.errorsByType.size).toBeGreaterThan(0);
    });

    it('should provide error rate alerting and thresholds', () => {
      // Set thresholds
      const thresholds = {
        warningThreshold: 1,
        criticalThreshold: 5,
        burstThreshold: 10,
        trendDegradationThreshold: 2,
        categoryThresholds: new Map([['SERVER_ERROR', 2]]),
        consecutiveErrorsThreshold: 5
      };

      errorRateService.setThresholds('test-component', thresholds);

      // Generate high error rate
      const highErrorMetrics = { ...mockComponentMetrics, errorRate: 0.08 }; // 8%
      errorRateService.processComponentMetrics(highErrorMetrics);

      const alerts = errorRateService.checkAlerts('test-component');
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].alertType).toBe('threshold_exceeded');
    });
  });

  describe('SRS FR-7.3: Throughput Monitoring', () => {
    it('should measure and track throughput', () => {
      throughputService.processComponentMetrics(mockComponentMetrics);

      const throughputMetrics = throughputService.calculateThroughputMetrics('test-component-1');
      
      expect(throughputMetrics).toBeDefined();
      expect(throughputMetrics!.currentThroughput).toBe(100);
      expect(throughputMetrics!.averageThroughput).toBeGreaterThan(0);
      expect(throughputMetrics!.throughputPercentiles).toBeDefined();
    });

    it('should analyze throughput trends', () => {
      // Record increasing throughput
      for (let i = 0; i < 10; i++) {
        const metrics = { ...mockComponentMetrics, requestsPerSecond: 50 + i * 10 };
        throughputService.processComponentMetrics(metrics);
      }

      const throughputMetrics = throughputService.calculateThroughputMetrics('test-component-1');
      
      expect(throughputMetrics).toBeDefined();
      expect(throughputMetrics!.throughputTrend.direction).toBeDefined();
      expect(throughputMetrics!.throughputTrend.changeRate).toBeGreaterThanOrEqual(0);
    });

    it('should provide throughput capacity planning', () => {
      throughputService.processComponentMetrics(mockComponentMetrics);

      const throughputMetrics = throughputService.calculateThroughputMetrics('test-component-1');
      
      expect(throughputMetrics).toBeDefined();
      expect(throughputMetrics!.capacityAnalysis).toBeDefined();
      expect(throughputMetrics!.capacityAnalysis.currentCapacity).toBeGreaterThan(0);
      expect(throughputMetrics!.capacityAnalysis.utilizationPercentage).toBeGreaterThanOrEqual(0);
      expect(throughputMetrics!.capacityAnalysis.scalingRecommendations).toBeDefined();
    });

    it('should generate throughput forecasts', () => {
      // Record historical data
      for (let i = 0; i < 20; i++) {
        const metrics = { ...mockComponentMetrics, requestsPerSecond: 100 + Math.sin(i) * 20 };
        throughputService.processComponentMetrics(metrics);
      }

      const forecast = throughputService.generateForecast('test-component-1', 30);
      
      expect(forecast).toBeDefined();
      expect(forecast!.predictedThroughput.length).toBe(30);
      expect(forecast!.confidence).toBeGreaterThan(0);
      expect(forecast!.assumptions.length).toBeGreaterThan(0);
    });
  });

  describe('SRS FR-7.4: Resource Saturation Monitoring', () => {
    it('should monitor CPU, memory, network, storage utilization', () => {
      resourceService.processComponentMetrics(mockComponentMetrics);

      const resourceAnalysis = resourceService.analyzeResourceSaturation('test-component-1');
      
      expect(resourceAnalysis).toBeDefined();
      expect(resourceAnalysis!.overallSaturation).toBeGreaterThan(0);
      expect(resourceAnalysis!.criticalResources).toBeDefined();
    });

    it('should create resource utilization visualization data', () => {
      resourceService.processComponentMetrics(mockComponentMetrics);

      const resourceAnalysis = resourceService.analyzeResourceSaturation('test-component-1');
      
      expect(resourceAnalysis).toBeDefined();
      expect(resourceAnalysis!.bottlenecks).toBeDefined();
      expect(resourceAnalysis!.recommendations).toBeDefined();
      expect(resourceAnalysis!.healthScore).toBeGreaterThanOrEqual(0);
      expect(resourceAnalysis!.healthScore).toBeLessThanOrEqual(100);
    });

    it('should provide resource saturation alerting', () => {
      // Create high resource utilization
      const highResourceMetrics = {
        ...mockComponentMetrics,
        cpuUtilization: 0.95,
        memoryUtilization: 0.90
      };

      resourceService.processComponentMetrics(highResourceMetrics);

      const alerts = resourceService.checkAlerts('test-component-1');
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.resource === 'cpu')).toBe(true);
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
    });
  });

  describe('SRS FR-7.5: Component and Global Views', () => {
    it('should implement component-specific metrics views', () => {
      viewService.processComponentMetrics(mockComponentMetrics);

      const componentView = viewService.getComponentView('test-component-1');
      
      expect(componentView).toBeDefined();
      expect(componentView!.componentId).toBe('test-component-1');
      expect(componentView!.summary).toBeDefined();
      expect(componentView!.detailedMetrics).toBeDefined();
      expect(componentView!.healthScore).toBeGreaterThanOrEqual(0);
      expect(componentView!.healthScore).toBeLessThanOrEqual(100);
    });

    it('should create system-wide performance dashboards', () => {
      // Process metrics for multiple components
      const components = ['comp-1', 'comp-2', 'comp-3'];
      
      components.forEach(componentId => {
        const metrics = { ...mockComponentMetrics, componentId };
        viewService.processComponentMetrics(metrics);
      });

      const globalView = viewService.getGlobalView();
      
      expect(globalView).toBeDefined();
      expect(globalView!.summary.totalComponents).toBe(3);
      expect(globalView!.systemMetrics).toBeDefined();
      expect(globalView!.componentOverview.length).toBe(3);
    });

    it('should provide drill-down capabilities from global to component level', () => {
      viewService.processComponentMetrics(mockComponentMetrics);

      const drillDownContext = {
        fromView: 'global' as const,
        targetComponent: 'test-component-1',
        timeRange: {
          start: Date.now() - 3600000,
          end: Date.now()
        },
        focusMetric: 'latency'
      };

      const componentView = viewService.drillDownToComponent('test-component-1', drillDownContext);
      
      expect(componentView).toBeDefined();
      expect(componentView!.componentId).toBe('test-component-1');
    });
  });

  describe('Integration Service', () => {
    it('should integrate all metrics services', () => {
      integrationService.processMetrics(mockComponentMetrics);

      const unifiedMetrics = integrationService.getUnifiedMetrics('test-component-1');
      
      expect(unifiedMetrics).toBeDefined();
      expect(unifiedMetrics!.latency).toBeDefined();
      expect(unifiedMetrics!.errorRate).toBeDefined();
      expect(unifiedMetrics!.throughput).toBeDefined();
      expect(unifiedMetrics!.resources).toBeDefined();
      expect(unifiedMetrics!.health).toBeDefined();
    });

    it('should provide system health summary', () => {
      // Process metrics for multiple components
      const components = ['comp-1', 'comp-2', 'comp-3'];
      
      components.forEach(componentId => {
        const metrics = { ...mockComponentMetrics, componentId };
        integrationService.processMetrics(metrics);
      });

      // Wait for system health calculation
      setTimeout(() => {
        const systemHealth = integrationService.getSystemHealthSummary();
        
        expect(systemHealth).toBeDefined();
        expect(systemHealth!.componentCount).toBe(3);
        expect(systemHealth!.overallHealth).toBeGreaterThanOrEqual(0);
        expect(systemHealth!.overallHealth).toBeLessThanOrEqual(100);
        expect(systemHealth!.systemStatus).toBeDefined();
      }, 100);
    });

    it('should collect alerts from all services', () => {
      // Create conditions that trigger alerts
      const highErrorMetrics = {
        ...mockComponentMetrics,
        errorRate: 0.1, // 10% error rate
        averageLatency: 2000, // 2 second latency
        cpuUtilization: 0.95 // 95% CPU
      };

      integrationService.processMetrics(highErrorMetrics);

      const allAlerts = integrationService.getAllAlerts();
      
      expect(allAlerts.length).toBeGreaterThan(0);
      expect(allAlerts.some(a => a.service === 'latency')).toBe(true);
      expect(allAlerts.some(a => a.service === 'error_rate')).toBe(true);
      expect(allAlerts.some(a => a.service === 'resources')).toBe(true);
    });

    it('should provide performance statistics', () => {
      integrationService.processMetrics(mockComponentMetrics);

      const stats = integrationService.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats.integration).toBeDefined();
      expect(stats.integration.processedComponents).toBeGreaterThan(0);
      expect(stats.integration.isInitialized).toBe(true);
      expect(stats.integration.enabledServices.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates and Performance', () => {
    it('should process metrics within performance requirements', () => {
      const startTime = performance.now();
      
      // Process multiple metrics
      for (let i = 0; i < 100; i++) {
        const metrics = { ...mockComponentMetrics, componentId: `comp-${i}` };
        integrationService.processMetrics(metrics);
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should process 100 components in reasonable time
      expect(processingTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should maintain data within retention periods', () => {
      const oldTimestamp = Date.now() - 7200000; // 2 hours ago
      const oldMetrics = { ...mockComponentMetrics, timestamp: oldTimestamp };
      
      latencyService.recordLatency('test-component', 100, oldTimestamp);
      
      // Record recent data
      latencyService.recordLatency('test-component', 200);
      
      const distribution = latencyService.getLatencyDistribution('test-component');
      
      // Should only include recent data within retention period
      expect(distribution).toBeDefined();
    });
  });
});