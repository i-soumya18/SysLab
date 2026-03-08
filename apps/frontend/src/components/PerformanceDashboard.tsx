/**
 * Performance dashboard component displaying real-time system metrics
 */

import React, { useState } from 'react';
import { MetricsChart } from './MetricsChart';
import type { ComponentMetrics, AggregatedMetrics, SystemMetrics, Component } from '../types';

export interface PerformanceDashboardProps {
  components: Component[];
  rawMetrics: Map<string, ComponentMetrics[]>;
  aggregatedMetrics: Map<string, AggregatedMetrics[]>;
  systemMetrics: SystemMetrics[];
  selectedComponentId?: string;
  onComponentSelect?: (componentId: string | undefined) => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  components,
  rawMetrics,
  aggregatedMetrics,
  systemMetrics,
  selectedComponentId,
  onComponentSelect
}) => {
  const [viewMode, setViewMode] = useState<'system' | 'component'>('system');
  const [metricsType, setMetricsType] = useState<'raw' | 'aggregated'>('aggregated');

  // Get current metrics based on selection
  const getCurrentMetrics = () => {
    if (viewMode === 'system') {
      return systemMetrics;
    }

    if (!selectedComponentId) {
      return [];
    }

    return metricsType === 'raw' 
      ? rawMetrics.get(selectedComponentId) || []
      : aggregatedMetrics.get(selectedComponentId) || [];
  };

  const currentMetrics = getCurrentMetrics();

  return (
    <div className="performance-dashboard">
      <div className="dashboard-header">
        <h2>Performance Dashboard</h2>
        
        <div className="dashboard-controls">
          <div className="view-mode-selector">
            <label>
              <input
                type="radio"
                value="system"
                checked={viewMode === 'system'}
                onChange={(e) => setViewMode(e.target.value as 'system')}
              />
              System Overview
            </label>
            <label>
              <input
                type="radio"
                value="component"
                checked={viewMode === 'component'}
                onChange={(e) => setViewMode(e.target.value as 'component')}
              />
              Component Details
            </label>
          </div>

          {viewMode === 'component' && (
            <>
              <div className="component-selector">
                <select
                  value={selectedComponentId || ''}
                  onChange={(e) => onComponentSelect?.(e.target.value || undefined)}
                >
                  <option value="">Select Component</option>
                  {components.map(component => (
                    <option key={component.id} value={component.id}>
                      {component.metadata.name} ({component.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="metrics-type-selector">
                <label>
                  <input
                    type="radio"
                    value="raw"
                    checked={metricsType === 'raw'}
                    onChange={(e) => setMetricsType(e.target.value as 'raw')}
                  />
                  Raw Data
                </label>
                <label>
                  <input
                    type="radio"
                    value="aggregated"
                    checked={metricsType === 'aggregated'}
                    onChange={(e) => setMetricsType(e.target.value as 'aggregated')}
                  />
                  Aggregated
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-content">
        {viewMode === 'system' ? (
          <SystemMetricsView systemMetrics={systemMetrics} />
        ) : (
          <ComponentMetricsView
            componentId={selectedComponentId}
            metrics={currentMetrics}
            metricsType={metricsType}
          />
        )}
      </div>
    </div>
  );
};

interface SystemMetricsViewProps {
  systemMetrics: SystemMetrics[];
}

const SystemMetricsView: React.FC<SystemMetricsViewProps> = ({ systemMetrics }) => {
  return (
    <div className="system-metrics-view">
      <div className="metrics-grid">
        <div className="metric-card">
          <MetricsChart
            title="Total Throughput"
            metrics={systemMetrics}
            metricKey="totalThroughput"
            color="#10B981"
            unit=" req/s"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Average Latency"
            metrics={systemMetrics}
            metricKey="averageLatency"
            color="#F59E0B"
            unit=" ms"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="System Error Rate"
            metrics={systemMetrics}
            metricKey="systemErrorRate"
            color="#EF4444"
            unit="%"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Component Health"
            metrics={systemMetrics}
            metricKey="healthyComponents"
            color="#8B5CF6"
            unit=" components"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Total Queue Depth"
            metrics={systemMetrics}
            metricKey="totalQueueDepth"
            color="#06B6D4"
            unit=" requests"
          />
        </div>
      </div>

      {systemMetrics.length > 0 && (
        <SystemSummaryCard metrics={systemMetrics[systemMetrics.length - 1]} />
      )}
    </div>
  );
};

interface ComponentMetricsViewProps {
  componentId?: string;
  metrics: ComponentMetrics[] | AggregatedMetrics[] | SystemMetrics[];
  metricsType: 'raw' | 'aggregated';
}

const ComponentMetricsView: React.FC<ComponentMetricsViewProps> = ({
  componentId,
  metrics,
  metricsType
}) => {
  if (!componentId) {
    return (
      <div className="no-component-selected">
        <p>Please select a component to view detailed metrics.</p>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="no-metrics">
        <p>No metrics available for the selected component.</p>
      </div>
    );
  }

  // Filter out SystemMetrics for component view
  const componentMetrics = metrics.filter(m => 'componentId' in m || 'requestsPerSecond' in m) as (ComponentMetrics[] | AggregatedMetrics[]);

  const showPercentiles = metricsType === 'aggregated';

  return (
    <div className="component-metrics-view">
      <div className="metrics-grid">
        <div className="metric-card">
          <MetricsChart
            title="Requests per Second"
            metrics={componentMetrics}
            metricKey={showPercentiles ? "requestsPerSecond" : "requestsPerSecond"}
            color="#10B981"
            showPercentiles={showPercentiles}
            unit=" req/s"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Average Latency"
            metrics={componentMetrics}
            metricKey={showPercentiles ? "latency" : "averageLatency"}
            color="#F59E0B"
            showPercentiles={showPercentiles}
            unit=" ms"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Error Rate"
            metrics={componentMetrics}
            metricKey={showPercentiles ? "errorRate.avg" : "errorRate"}
            color="#EF4444"
            unit="%"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="CPU Utilization"
            metrics={componentMetrics}
            metricKey={showPercentiles ? "resourceUtilization.cpu.avg" : "cpuUtilization"}
            color="#8B5CF6"
            unit="%"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Memory Utilization"
            metrics={componentMetrics}
            metricKey={showPercentiles ? "resourceUtilization.memory.avg" : "memoryUtilization"}
            color="#06B6D4"
            unit="%"
          />
        </div>

        <div className="metric-card">
          <MetricsChart
            title="Queue Depth"
            metrics={componentMetrics}
            metricKey={showPercentiles ? "queueDepth.avg" : "queueDepth"}
            color="#EC4899"
            unit=" requests"
          />
        </div>
      </div>
    </div>
  );
};

interface SystemSummaryCardProps {
  metrics: SystemMetrics;
}

const SystemSummaryCard: React.FC<SystemSummaryCardProps> = ({ metrics }) => {
  const healthPercentage = metrics.activeComponents > 0 
    ? (metrics.healthyComponents / metrics.activeComponents) * 100 
    : 0;

  return (
    <div className="system-summary-card">
      <h3>Current System Status</h3>
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-label">Total Throughput:</span>
          <span className="stat-value">{metrics.totalThroughput.toFixed(1)} req/s</span>
        </div>
        <div className="stat">
          <span className="stat-label">Average Latency:</span>
          <span className="stat-value">{metrics.averageLatency.toFixed(1)} ms</span>
        </div>
        <div className="stat">
          <span className="stat-label">Error Rate:</span>
          <span className="stat-value">{(metrics.systemErrorRate * 100).toFixed(2)}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Component Health:</span>
          <span className="stat-value">
            {metrics.healthyComponents}/{metrics.activeComponents} ({healthPercentage.toFixed(1)}%)
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Total Queue Depth:</span>
          <span className="stat-value">{metrics.totalQueueDepth.toFixed(0)} requests</span>
        </div>
      </div>
    </div>
  );
};