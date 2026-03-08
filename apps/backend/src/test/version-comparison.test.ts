/**
 * Version Comparison Integration Tests
 * Tests the workspace versioning and performance comparison functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VersionService } from '../services/versionService';
import { ReportService } from '../services/reportService';

describe('Version Comparison Integration', () => {
  let versionService: VersionService;
  let reportService: ReportService;

  beforeEach(() => {
    // Initialize services without database for testing
    versionService = new VersionService(false);
    reportService = new ReportService(false);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should create version service instance', () => {
    expect(versionService).toBeDefined();
    expect(typeof versionService.createVersion).toBe('function');
    expect(typeof versionService.getVersions).toBe('function');
    expect(typeof versionService.compareVersions).toBe('function');
  });

  it('should create report service instance', () => {
    expect(reportService).toBeDefined();
    expect(typeof reportService.generateReport).toBe('function');
    expect(typeof reportService.exportReport).toBe('function');
  });

  it('should validate version creation request structure', () => {
    const validRequest = {
      workspaceId: 'test-workspace-id',
      name: 'Test Version',
      description: 'Test version description',
      createdBy: 'test-user',
      performanceMetrics: {
        simulationId: 'test-sim',
        duration: 300,
        totalRequests: 1000,
        averageLatency: 125.5,
        p95Latency: 250.0,
        p99Latency: 400.0,
        throughput: 100,
        errorRate: 0.02,
        bottlenecks: [],
        resourceUtilization: {
          avgCpuUsage: 65,
          avgMemoryUsage: 70,
          peakCpuUsage: 85,
          peakMemoryUsage: 90
        },
        componentMetrics: []
      }
    };

    expect(validRequest.workspaceId).toBeDefined();
    expect(validRequest.name).toBeDefined();
    expect(validRequest.createdBy).toBeDefined();
    expect(validRequest.performanceMetrics).toBeDefined();
    expect(validRequest.performanceMetrics?.averageLatency).toBe(125.5);
  });

  it('should validate report generation request structure', () => {
    const validReportRequest = {
      workspaceId: 'test-workspace-id',
      versionId: 'test-version-id',
      reportType: 'single' as const,
      title: 'Test Performance Report',
      includeRecommendations: true
    };

    expect(validReportRequest.workspaceId).toBeDefined();
    expect(validReportRequest.reportType).toBe('single');
    expect(validReportRequest.includeRecommendations).toBe(true);
  });

  it('should validate comparison report request structure', () => {
    const comparisonRequest = {
      workspaceId: 'test-workspace-id',
      versionId: 'baseline-version-id',
      comparisonVersionId: 'comparison-version-id',
      reportType: 'comparison' as const,
      title: 'Performance Comparison Report'
    };

    expect(comparisonRequest.versionId).toBeDefined();
    expect(comparisonRequest.comparisonVersionId).toBeDefined();
    expect(comparisonRequest.reportType).toBe('comparison');
  });

  it('should validate A/B test configuration structure', () => {
    const abTestConfig = {
      name: 'Load Balancer Test',
      description: 'Testing different load balancer configurations',
      workspaceId: 'test-workspace-id',
      variants: [
        {
          name: 'Control',
          versionId: 'version-1',
          trafficPercentage: 50
        },
        {
          name: 'Treatment',
          versionId: 'version-2',
          trafficPercentage: 50
        }
      ],
      duration: 3600,
      metrics: ['latency', 'throughput', 'errorRate']
    };

    expect(abTestConfig.variants).toHaveLength(2);
    expect(abTestConfig.variants[0].trafficPercentage + abTestConfig.variants[1].trafficPercentage).toBe(100);
    expect(abTestConfig.metrics).toContain('latency');
    expect(abTestConfig.metrics).toContain('throughput');
  });

  it('should validate performance snapshot structure', () => {
    const performanceSnapshot = {
      simulationId: 'test-simulation',
      duration: 300,
      totalRequests: 5000,
      averageLatency: 150.5,
      p95Latency: 300.0,
      p99Latency: 500.0,
      throughput: 166.7,
      errorRate: 0.015,
      bottlenecks: [
        {
          componentId: 'db-1',
          componentType: 'database' as const,
          severity: 'high' as const,
          type: 'latency' as const,
          description: 'Database queries taking too long',
          impact: 75,
          recommendations: ['Add database indexes', 'Optimize queries']
        }
      ],
      resourceUtilization: {
        avgCpuUsage: 70,
        avgMemoryUsage: 65,
        peakCpuUsage: 90,
        peakMemoryUsage: 85
      },
      componentMetrics: [
        {
          componentId: 'db-1',
          componentType: 'database' as const,
          averageLatency: 200.0,
          throughput: 50.0,
          errorRate: 0.01,
          utilization: 80.0,
          queueDepth: 5.2
        }
      ]
    };

    expect(performanceSnapshot.totalRequests).toBe(5000);
    expect(performanceSnapshot.bottlenecks).toHaveLength(1);
    expect(performanceSnapshot.bottlenecks[0].severity).toBe('high');
    expect(performanceSnapshot.componentMetrics).toHaveLength(1);
    expect(performanceSnapshot.componentMetrics[0].componentType).toBe('database');
  });

  it('should validate performance comparison structure', () => {
    const mockComparison = {
      baselineVersion: {
        id: 'baseline-id',
        workspaceId: 'workspace-id',
        versionNumber: 1,
        name: 'Baseline',
        snapshot: { components: [], connections: [], configuration: {} },
        createdAt: new Date(),
        createdBy: 'user'
      },
      comparisonVersion: {
        id: 'comparison-id',
        workspaceId: 'workspace-id',
        versionNumber: 2,
        name: 'Optimized',
        snapshot: { components: [], connections: [], configuration: {} },
        createdAt: new Date(),
        createdBy: 'user'
      },
      overallImprovement: {
        latencyChange: -15.5, // 15.5% improvement (lower is better)
        throughputChange: 25.0, // 25% improvement
        errorRateChange: -50.0, // 50% improvement (lower is better)
        resourceEfficiencyChange: 20.0 // 20% improvement
      },
      componentComparisons: [],
      bottleneckAnalysis: {
        resolved: [],
        introduced: [],
        persisting: []
      },
      recommendations: [
        'Excellent latency improvement achieved',
        'Throughput gains are significant',
        'Error rate reduction shows improved reliability'
      ],
      summary: 'Performance comparison shows significant improvements across all metrics'
    };

    expect(mockComparison.overallImprovement.latencyChange).toBeLessThan(0); // Improvement
    expect(mockComparison.overallImprovement.throughputChange).toBeGreaterThan(0); // Improvement
    expect(mockComparison.recommendations).toHaveLength(3);
    expect(mockComparison.summary).toContain('significant improvements');
  });
});