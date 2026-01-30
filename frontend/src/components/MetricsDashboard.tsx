/**
 * Comprehensive metrics dashboard combining all visualization components
 */

import React, { useState, useEffect } from 'react';
import { PerformanceDashboard } from './PerformanceDashboard';
import { ResourceUtilizationChart } from './ResourceUtilizationChart';
import { LatencyDistributionChart } from './LatencyDistributionChart';
import type { 
  Component, 
  ComponentMetrics, 
  AggregatedMetrics, 
  SystemMetrics 
} from '../types';

export interface MetricsDashboardProps {
  components: Component[];
  isSimulationRunning: boolean;
  onRefreshMetrics?: () => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  components,
  isSimulationRunning,
  onRefreshMetrics
}) => {
  const [rawMetrics, setRawMetrics] = useState<Map<string, ComponentMetrics[]>>(new Map());
  const [aggregatedMetrics, setAggregatedMetrics] = useState<Map<string, AggregatedMetrics[]>>(new Map());
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'overview' | 'components' | 'resources' | 'latency'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data for demonstration - in real implementation, this would come from WebSocket or API
  useEffect(() => {
    if (!isSimulationRunning && !autoRefresh) return;

    const generateMockMetrics = () => {
      const now = Date.now();
      
      // Generate mock raw metrics for each component
      const newRawMetrics = new Map<string, ComponentMetrics[]>();
      const newAggregatedMetrics = new Map<string, AggregatedMetrics[]>();
      
      components.forEach(component => {
        // Generate raw metrics
        const existingRaw = rawMetrics.get(component.id) || [];
        const newRawMetric: ComponentMetrics = {
          componentId: component.id,
          timestamp: now,
          requestsPerSecond: Math.random() * 100 + 10,
          averageLatency: Math.random() * 200 + 50,
          errorRate: Math.random() * 0.05,
          cpuUtilization: Math.random() * 0.8 + 0.1,
          memoryUtilization: Math.random() * 0.7 + 0.1,
          queueDepth: Math.floor(Math.random() * 20)
        };
        
        const updatedRaw = [...existingRaw, newRawMetric].slice(-50); // Keep last 50 points
        newRawMetrics.set(component.id, updatedRaw);

        // Generate aggregated metrics (every 5th update)
        const existingAgg = aggregatedMetrics.get(component.id) || [];
        if (existingRaw.length % 5 === 0) {
          const newAggMetric: AggregatedMetrics = {
            componentId: component.id,
            timeWindow: 5000,
            startTime: now - 5000,
            endTime: now,
            requestsPerSecond: {
              min: newRawMetric.requestsPerSecond * 0.8,
              max: newRawMetric.requestsPerSecond * 1.2,
              avg: newRawMetric.requestsPerSecond,
              p50: newRawMetric.requestsPerSecond * 0.95,
              p95: newRawMetric.requestsPerSecond * 1.1,
              p99: newRawMetric.requestsPerSecond * 1.15
            },
            latency: {
              min: newRawMetric.averageLatency * 0.7,
              max: newRawMetric.averageLatency * 1.5,
              avg: newRawMetric.averageLatency,
              p50: newRawMetric.averageLatency * 0.9,
              p95: newRawMetric.averageLatency * 1.3,
              p99: newRawMetric.averageLatency * 1.4
            },
            errorRate: {
              min: 0,
              max: newRawMetric.errorRate * 2,
              avg: newRawMetric.errorRate
            },
            resourceUtilization: {
              cpu: {
                min: newRawMetric.cpuUtilization * 0.8,
                max: newRawMetric.cpuUtilization * 1.1,
                avg: newRawMetric.cpuUtilization
              },
              memory: {
                min: newRawMetric.memoryUtilization * 0.9,
                max: newRawMetric.memoryUtilization * 1.1,
                avg: newRawMetric.memoryUtilization
              }
            },
            queueDepth: {
              min: Math.max(0, newRawMetric.queueDepth - 5),
              max: newRawMetric.queueDepth + 5,
              avg: newRawMetric.queueDepth
            },
            totalRequests: newRawMetric.requestsPerSecond * 5,
            totalErrors: newRawMetric.requestsPerSecond * newRawMetric.errorRate * 5
          };
          
          const updatedAgg = [...existingAgg, newAggMetric].slice(-20); // Keep last 20 points
          newAggregatedMetrics.set(component.id, updatedAgg);
        } else {
          newAggregatedMetrics.set(component.id, existingAgg);
        }
      });

      // Generate system metrics
      const totalThroughput = Array.from(newRawMetrics.values())
        .reduce((sum, metrics) => {
          const latest = metrics[metrics.length - 1];
          return sum + (latest?.requestsPerSecond || 0);
        }, 0);

      const avgLatency = Array.from(newRawMetrics.values())
        .reduce((sum, metrics, _, array) => {
          const latest = metrics[metrics.length - 1];
          return sum + (latest?.averageLatency || 0) / array.length;
        }, 0);

      const systemErrorRate = Array.from(newRawMetrics.values())
        .reduce((sum, metrics, _, array) => {
          const latest = metrics[metrics.length - 1];
          return sum + (latest?.errorRate || 0) / array.length;
        }, 0);

      const healthyComponents = Array.from(newRawMetrics.values())
        .filter(metrics => {
          const latest = metrics[metrics.length - 1];
          return latest && latest.errorRate < 0.05;
        }).length;

      const totalQueueDepth = Array.from(newRawMetrics.values())
        .reduce((sum, metrics) => {
          const latest = metrics[metrics.length - 1];
          return sum + (latest?.queueDepth || 0);
        }, 0);

      const newSystemMetric: SystemMetrics = {
        timestamp: now,
        totalThroughput,
        averageLatency: avgLatency,
        systemErrorRate,
        activeComponents: components.length,
        healthyComponents,
        totalQueueDepth,
        componentMetrics: new Map(
          Array.from(newAggregatedMetrics.entries())
            .map(([key, value]) => [key, value[value.length - 1]] as [string, AggregatedMetrics])
            .filter(([_, value]) => value !== undefined)
        )
      };

      setRawMetrics(newRawMetrics);
      setAggregatedMetrics(newAggregatedMetrics);
      setSystemMetrics(prev => [...prev, newSystemMetric].slice(-50)); // Keep last 50 points
    };

    generateMockMetrics();

    const interval = setInterval(generateMockMetrics, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [components, isSimulationRunning, autoRefresh, rawMetrics, aggregatedMetrics]);

  const handleTabChange = (tab: 'overview' | 'components' | 'resources' | 'latency') => {
    setActiveTab(tab);
  };

  return (
    <div className="metrics-dashboard">
      <div className="dashboard-header">
        <h1>System Metrics Dashboard</h1>
        
        <div className="dashboard-controls">
          <div className="status-indicator">
            <span className={`status-dot ${isSimulationRunning ? 'running' : 'stopped'}`}></span>
            <span>{isSimulationRunning ? 'Simulation Running' : 'Simulation Stopped'}</span>
          </div>

          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>

          {onRefreshMetrics && (
            <button onClick={onRefreshMetrics} className="refresh-button">
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
        >
          System Overview
        </button>
        <button
          className={`tab ${activeTab === 'components' ? 'active' : ''}`}
          onClick={() => handleTabChange('components')}
        >
          Component Details
        </button>
        <button
          className={`tab ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => handleTabChange('resources')}
        >
          Resource Utilization
        </button>
        <button
          className={`tab ${activeTab === 'latency' ? 'active' : ''}`}
          onClick={() => handleTabChange('latency')}
        >
          Latency Analysis
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <PerformanceDashboard
            components={components}
            rawMetrics={rawMetrics}
            aggregatedMetrics={aggregatedMetrics}
            systemMetrics={systemMetrics}
            selectedComponentId={selectedComponentId}
            onComponentSelect={setSelectedComponentId}
          />
        )}

        {activeTab === 'components' && (
          <PerformanceDashboard
            components={components}
            rawMetrics={rawMetrics}
            aggregatedMetrics={aggregatedMetrics}
            systemMetrics={systemMetrics}
            selectedComponentId={selectedComponentId}
            onComponentSelect={setSelectedComponentId}
          />
        )}

        {activeTab === 'resources' && (
          <div className="resources-tab">
            <ResourceUtilizationChart
              components={components}
              metrics={rawMetrics}
              height={400}
            />
            
            <div className="resource-summary">
              <h3>Resource Summary</h3>
              <p>Monitor CPU, memory, and queue depth across all components in real-time.</p>
            </div>
          </div>
        )}

        {activeTab === 'latency' && (
          <div className="latency-tab">
            <LatencyDistributionChart
              components={components}
              aggregatedMetrics={aggregatedMetrics}
              height={400}
            />
            
            <div className="latency-summary">
              <h3>Latency Analysis</h3>
              <p>View latency percentiles (P50, P95, P99) to identify performance bottlenecks.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};