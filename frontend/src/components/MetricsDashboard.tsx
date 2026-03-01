/**
 * Metrics Dashboard Component
 * Displays real-time simulation metrics with system overview and bottleneck detection
 * Implements MVLE-6: Learn from metrics and visual feedback
 */

import React from 'react';
import type { SystemMetrics, BottleneckInfo, ComponentMetrics } from '../types';

interface MetricsDashboardProps {
  isVisible: boolean;
  systemMetrics?: SystemMetrics;
  componentMetrics?: Map<string, ComponentMetrics>;
  bottlenecks?: BottleneckInfo[];
  simulationStatus: 'idle' | 'running' | 'paused' | 'completed';
  elapsedTime: number;
  loadPattern?: { currentLoad: number; pattern: string } | null;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  isVisible,
  systemMetrics,
  componentMetrics = new Map(),
  bottlenecks = [],
  simulationStatus,
  elapsedTime,
  loadPattern
}) => {
  if (!isVisible) return null;

  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get severity color for bottleneck
  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      'critical': '#dc3545',
      'high': '#fd7e14',
      'medium': '#ffc107',
      'low': '#28a745'
    };
    return colors[severity] || '#6c757d';
  };

  // Get severity icon
  const getSeverityIcon = (severity: string): string => {
    const icons: Record<string, string> = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🟢'
    };
    return icons[severity] || '⚪';
  };

  const statusColor = {
    'idle': '#6c757d',
    'running': '#28a745',
    'paused': '#ffc107',
    'completed': '#17a2b8'
  }[simulationStatus] || '#6c757d';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            Metrics Dashboard
          </h3>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: statusColor,
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'white',
              animation: simulationStatus === 'running' ? 'pulse 1.5s infinite' : 'none'
            }}
          />
          {simulationStatus.toUpperCase()}
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: 0
        }}
      >
        {/* Elapsed Time and Load Pattern */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333'
            }}
          >
            Elapsed Time: {formatTime(elapsedTime)}
          </div>
          
          {loadPattern && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#e8f5e9',
                borderLeft: '4px solid #4CAF50',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
                <div style={{ fontSize: '12px', color: '#333' }}>
                  <div style={{ fontWeight: 'bold' }}>Current Load</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                  Pattern: {loadPattern.pattern}
                  </div>
                </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4CAF50' }}>
                {typeof loadPattern.currentLoad === 'number' ? loadPattern.currentLoad.toFixed(0) : '0'} req/s
              </div>
            </div>
          )}
        </div>

        {/* System Overview Cards */}
        {systemMetrics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>
              System Overview
            </h4>

            {/* Throughput Card */}
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#e3f2fd',
                borderLeft: '4px solid #2196F3',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '12px', color: '#333' }}>
                <div style={{ fontWeight: 'bold' }}>Throughput</div>
                <div style={{ fontSize: '10px', color: '#666' }}>req/sec</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2196F3' }}>
                {systemMetrics.totalThroughput.toFixed(0)}
              </div>
            </div>

            {/* Latency Card */}
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3e5f5',
                borderLeft: '4px solid #9C27B0',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '12px', color: '#333' }}>
                <div style={{ fontWeight: 'bold' }}>Avg Latency</div>
                <div style={{ fontSize: '10px', color: '#666' }}>milliseconds</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#9C27B0' }}>
                {systemMetrics.averageLatency.toFixed(0)}ms
              </div>
            </div>

            {/* Error Rate Card */}
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#ffebee',
                borderLeft: '4px solid #F44336',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '12px', color: '#333' }}>
                <div style={{ fontWeight: 'bold' }}>Error Rate</div>
                <div style={{ fontSize: '10px', color: '#666' }}>percentage</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#F44336' }}>
                {(systemMetrics.systemErrorRate * 100).toFixed(2)}%
              </div>
            </div>

            {/* Overloaded Components Card */}
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#fce4ec',
                borderLeft: '4px solid #E91E63',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: '12px', color: '#333' }}>
                <div style={{ fontWeight: 'bold' }}>Overloaded</div>
                <div style={{ fontSize: '10px', color: '#666' }}>components</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#E91E63' }}>
                {systemMetrics.activeComponents - systemMetrics.healthyComponents}
              </div>
            </div>
          </div>
        )}

        {/* Bottlenecks Section */}
        {bottlenecks && bottlenecks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>
              Bottlenecks ({bottlenecks.length})
            </h4>

            {bottlenecks.map((bottleneck, index) => {
              // Safely handle missing properties
              const severity = bottleneck.severity || 'low';
              const componentType = bottleneck.componentType || 'Unknown';
              const type = bottleneck.type || 'bottleneck';
              const impact = bottleneck.impact || 0;
              const description = bottleneck.description || 'No description available';
              
              return (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f5f5f5',
                    borderLeft: '4px solid ' + getSeverityColor(severity),
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', flex: 1 }}>
                      <span style={{ marginRight: '4px' }}>{getSeverityIcon(severity)}</span>
                      {componentType}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        backgroundColor: getSeverityColor(severity),
                        color: 'white',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {severity.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    {type.toUpperCase()} • Impact: {impact}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic' }}>
                    {description}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Component Performance List */}
        {componentMetrics && componentMetrics.size > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>
              Component Performance
            </h4>

            {Array.from(componentMetrics.values()).slice(0, 5).map((metric) => (
              <div
                key={metric.componentId}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                  {metric.componentId}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#666'
                  }}
                >
                  <div>RPS: {metric.requestsPerSecond.toFixed(1)}</div>
                  <div>Lat: {metric.averageLatency.toFixed(0)}ms</div>
                  <div>Err: {(metric.errorRate * 100).toFixed(2)}%</div>
                  <div>Queue: {metric.queueDepth}</div>
                </div>
              </div>
            ))}

            {componentMetrics.size > 5 && (
              <div style={{ fontSize: '10px', color: '#999', textAlign: 'center', padding: '4px' }}>
                +{componentMetrics.size - 5} more components
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!systemMetrics && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: '#999',
              fontSize: '14px',
              fontStyle: 'italic'
            }}
          >
            Waiting for simulation to start...
          </div>
        )}
      </div>

      {/* Styles for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};
