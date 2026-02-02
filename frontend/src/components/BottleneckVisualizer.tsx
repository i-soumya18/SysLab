/**
 * Bottleneck Visualizer Component
 * 
 * Implements SRS FR-5.3: Visual bottleneck highlighting with color-coded component 
 * status indicators and bottleneck analysis and reporting
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Component, ComponentMetrics } from '../types';
import './BottleneckVisualizer.css';

export interface BottleneckInfo {
  componentId: string;
  componentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  utilizationPercent: number;
  limitingFactor: 'cpu' | 'memory' | 'network' | 'connections' | 'storage';
  impact: string;
  suggestedFix: string;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface BottleneckVisualizerProps {
  components: Component[];
  componentMetrics: Map<string, ComponentMetrics>;
  onComponentSelect?: (componentId: string) => void;
  showDetails?: boolean;
  enableAnimation?: boolean;
}

export const BottleneckVisualizer: React.FC<BottleneckVisualizerProps> = ({
  components,
  componentMetrics,
  onComponentSelect,
  showDetails = true,
  enableAnimation = true
}) => {
  const [selectedBottleneck, setSelectedBottleneck] = useState<string | null>(null);
  const [animationEnabled, setAnimationEnabled] = useState(enableAnimation);

  // Calculate bottlenecks from component metrics
  const bottlenecks = useMemo(() => {
    const result: BottleneckInfo[] = [];

    for (const component of components) {
      const metrics = componentMetrics.get(component.id);
      if (!metrics) continue;

      const bottleneck = analyzeComponentBottleneck(component, metrics);
      if (bottleneck) {
        result.push(bottleneck);
      }
    }

    // Sort by severity (critical first)
    return result.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }, [components, componentMetrics]);

  // Group bottlenecks by severity
  const bottlenecksBySeverity = useMemo(() => {
    return bottlenecks.reduce((acc, bottleneck) => {
      if (!acc[bottleneck.severity]) {
        acc[bottleneck.severity] = [];
      }
      acc[bottleneck.severity].push(bottleneck);
      return acc;
    }, {} as Record<string, BottleneckInfo[]>);
  }, [bottlenecks]);

  // Get color for component based on bottleneck severity
  const getComponentColor = (componentId: string): string => {
    const bottleneck = bottlenecks.find(b => b.componentId === componentId);
    if (!bottleneck) return '#28a745'; // Green - healthy

    switch (bottleneck.severity) {
      case 'critical': return '#dc3545'; // Red
      case 'high': return '#fd7e14'; // Orange
      case 'medium': return '#ffc107'; // Yellow
      case 'low': return '#17a2b8'; // Light blue
      default: return '#28a745'; // Green
    }
  };

  // Get pulse animation class for critical components
  const getAnimationClass = (componentId: string): string => {
    if (!animationEnabled) return '';
    
    const bottleneck = bottlenecks.find(b => b.componentId === componentId);
    if (bottleneck?.severity === 'critical') {
      return 'bottleneck-critical-pulse';
    }
    if (bottleneck?.severity === 'high') {
      return 'bottleneck-high-pulse';
    }
    return '';
  };

  // Handle component click
  const handleComponentClick = (componentId: string) => {
    setSelectedBottleneck(componentId);
    onComponentSelect?.(componentId);
  };

  return (
    <div className="bottleneck-visualizer">
      {/* Header */}
      <div className="visualizer-header">
        <h3>System Bottleneck Analysis</h3>
        <div className="visualizer-controls">
          <label className="animation-toggle">
            <input
              type="checkbox"
              checked={animationEnabled}
              onChange={(e) => setAnimationEnabled(e.target.checked)}
            />
            Animations
          </label>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bottleneck-summary">
        <div className="summary-item critical">
          <span className="count">{bottlenecksBySeverity.critical?.length || 0}</span>
          <span className="label">Critical</span>
        </div>
        <div className="summary-item high">
          <span className="count">{bottlenecksBySeverity.high?.length || 0}</span>
          <span className="label">High</span>
        </div>
        <div className="summary-item medium">
          <span className="count">{bottlenecksBySeverity.medium?.length || 0}</span>
          <span className="label">Medium</span>
        </div>
        <div className="summary-item low">
          <span className="count">{bottlenecksBySeverity.low?.length || 0}</span>
          <span className="label">Low</span>
        </div>
      </div>

      {/* Component Status Grid */}
      <div className="component-status-grid">
        {components.map(component => {
          const bottleneck = bottlenecks.find(b => b.componentId === component.id);
          const metrics = componentMetrics.get(component.id);
          const color = getComponentColor(component.id);
          const animationClass = getAnimationClass(component.id);

          return (
            <div
              key={component.id}
              className={`component-status-card ${animationClass} ${selectedBottleneck === component.id ? 'selected' : ''}`}
              onClick={() => handleComponentClick(component.id)}
              style={{ borderColor: color }}
            >
              <div className="component-header">
                <div 
                  className="status-indicator"
                  style={{ backgroundColor: color }}
                />
                <div className="component-info">
                  <span className="component-name">{component.name || component.type}</span>
                  <span className="component-type">{component.type}</span>
                </div>
              </div>

              {metrics && (
                <div className="component-metrics">
                  <div className="metric">
                    <span className="metric-label">CPU:</span>
                    <span className="metric-value">{(metrics.cpuUtilization * 100).toFixed(1)}%</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Memory:</span>
                    <span className="metric-value">{(metrics.memoryUtilization * 100).toFixed(1)}%</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Queue:</span>
                    <span className="metric-value">{metrics.queueDepth}</span>
                  </div>
                </div>
              )}

              {bottleneck && (
                <div className="bottleneck-indicator">
                  <span className={`severity-badge ${bottleneck.severity}`}>
                    {bottleneck.severity.toUpperCase()}
                  </span>
                  <span className="limiting-factor">
                    {bottleneck.limitingFactor.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Analysis */}
      {showDetails && bottlenecks.length > 0 && (
        <div className="bottleneck-details">
          <h4>Bottleneck Analysis</h4>
          
          {Object.entries(bottlenecksBySeverity).map(([severity, items]) => (
            items.length > 0 && (
              <div key={severity} className={`severity-section ${severity}`}>
                <h5 className="severity-header">
                  <span className={`severity-icon ${severity}`} />
                  {severity.charAt(0).toUpperCase() + severity.slice(1)} Priority ({items.length})
                </h5>
                
                <div className="bottleneck-list">
                  {items.map(bottleneck => (
                    <div 
                      key={bottleneck.componentId}
                      className={`bottleneck-item ${selectedBottleneck === bottleneck.componentId ? 'selected' : ''}`}
                      onClick={() => handleComponentClick(bottleneck.componentId)}
                    >
                      <div className="bottleneck-header">
                        <span className="component-name">
                          {components.find(c => c.id === bottleneck.componentId)?.name || bottleneck.componentType}
                        </span>
                        <span className="utilization">
                          {bottleneck.utilizationPercent.toFixed(1)}% utilized
                        </span>
                        <span className={`trend-indicator ${bottleneck.trend}`}>
                          {getTrendIcon(bottleneck.trend)}
                        </span>
                      </div>
                      
                      <div className="bottleneck-details-content">
                        <div className="limiting-factor">
                          <strong>Limiting Factor:</strong> {bottleneck.limitingFactor}
                        </div>
                        <div className="impact">
                          <strong>Impact:</strong> {bottleneck.impact}
                        </div>
                        <div className="suggested-fix">
                          <strong>Suggested Fix:</strong> {bottleneck.suggestedFix}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* No Bottlenecks Message */}
      {bottlenecks.length === 0 && (
        <div className="no-bottlenecks">
          <div className="no-bottlenecks-icon">✅</div>
          <h4>System Running Smoothly</h4>
          <p>No significant bottlenecks detected. All components are operating within normal parameters.</p>
        </div>
      )}
    </div>
  );
};

/**
 * Analyze component for bottlenecks
 */
function analyzeComponentBottleneck(component: Component, metrics: ComponentMetrics): BottleneckInfo | null {
  const cpuUtil = metrics.cpuUtilization * 100;
  const memUtil = metrics.memoryUtilization * 100;
  const queueDepth = metrics.queueDepth;
  const errorRate = metrics.errorRate * 100;

  // Determine limiting factor and severity
  let limitingFactor: BottleneckInfo['limitingFactor'] = 'cpu';
  let utilizationPercent = cpuUtil;
  let severity: BottleneckInfo['severity'] = 'low';

  // Find the most constrained resource
  if (memUtil > cpuUtil && memUtil > 70) {
    limitingFactor = 'memory';
    utilizationPercent = memUtil;
  } else if (queueDepth > 50) {
    limitingFactor = 'connections';
    utilizationPercent = Math.min(100, (queueDepth / 100) * 100);
  } else if (errorRate > 5) {
    limitingFactor = 'network';
    utilizationPercent = Math.min(100, errorRate * 10);
  }

  // Determine severity based on utilization
  if (utilizationPercent >= 95) {
    severity = 'critical';
  } else if (utilizationPercent >= 85) {
    severity = 'high';
  } else if (utilizationPercent >= 70) {
    severity = 'medium';
  } else if (utilizationPercent >= 50) {
    severity = 'low';
  } else {
    return null; // No bottleneck
  }

  // Generate impact and suggested fix
  const impact = generateImpactDescription(severity, limitingFactor, utilizationPercent);
  const suggestedFix = generateSuggestedFix(component.type, limitingFactor, severity);

  // Determine trend (simplified - in real implementation, this would analyze historical data)
  const trend = utilizationPercent > 90 ? 'degrading' : utilizationPercent < 60 ? 'improving' : 'stable';

  return {
    componentId: component.id,
    componentType: component.type,
    severity,
    utilizationPercent,
    limitingFactor,
    impact,
    suggestedFix,
    trend
  };
}

/**
 * Generate impact description
 */
function generateImpactDescription(severity: string, limitingFactor: string, utilization: number): string {
  const factor = limitingFactor.toUpperCase();
  
  switch (severity) {
    case 'critical':
      return `${factor} at ${utilization.toFixed(1)}% - System may become unresponsive or drop requests`;
    case 'high':
      return `${factor} at ${utilization.toFixed(1)}% - Significant performance degradation expected`;
    case 'medium':
      return `${factor} at ${utilization.toFixed(1)}% - Moderate performance impact under additional load`;
    case 'low':
      return `${factor} at ${utilization.toFixed(1)}% - Minor performance impact, monitor closely`;
    default:
      return `${factor} utilization within normal range`;
  }
}

/**
 * Generate suggested fix
 */
function generateSuggestedFix(componentType: string, limitingFactor: string, severity: string): string {
  const isUrgent = severity === 'critical' || severity === 'high';
  
  switch (limitingFactor) {
    case 'cpu':
      return isUrgent 
        ? `Immediately scale up ${componentType} with more CPU cores or add instances`
        : `Consider scaling up ${componentType} CPU or optimizing CPU-intensive operations`;
    case 'memory':
      return isUrgent
        ? `Immediately increase memory allocation or add instances to distribute load`
        : `Monitor memory usage and consider increasing allocation or optimizing memory usage`;
    case 'connections':
      return isUrgent
        ? `Immediately increase connection pool size or add load balancing`
        : `Optimize connection handling or consider connection pooling improvements`;
    case 'network':
      return isUrgent
        ? `Check network connectivity and increase bandwidth if possible`
        : `Monitor network performance and consider optimizing data transfer`;
    case 'storage':
      return isUrgent
        ? `Immediately optimize storage performance or add read replicas`
        : `Consider storage optimization or adding caching layer`;
    default:
      return `Monitor ${componentType} performance and consider scaling if needed`;
  }
}

/**
 * Get trend icon
 */
function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving': return '↗️';
    case 'degrading': return '↘️';
    case 'stable': return '→';
    default: return '→';
  }
}