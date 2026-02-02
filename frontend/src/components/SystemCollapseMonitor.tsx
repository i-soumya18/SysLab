/**
 * System Collapse Monitor Component
 * 
 * Implements SRS FR-5.4: Visual system collapse detection and recovery monitoring
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Component } from '../types';
import './SystemCollapseMonitor.css';

export interface CollapseEvent {
  id: string;
  timestamp: number;
  type: 'partial' | 'cascade' | 'total';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  triggerComponent?: string;
  rootCause: string;
  propagationPath: string[];
  estimatedRecoveryTime: number;
  confidence: number;
}

export interface RecoveryEvent {
  id: string;
  timestamp: number;
  collapseEventId: string;
  recoveredComponents: string[];
  actualRecoveryTime: number;
  recoveryMethod: 'automatic' | 'manual' | 'partial';
  remainingIssues: string[];
}

export interface SystemCollapseMonitorProps {
  components: Component[];
  collapseEvents: CollapseEvent[];
  recoveryEvents: RecoveryEvent[];
  onCollapseSelect?: (collapseId: string) => void;
  showRecoveryTimeline?: boolean;
}

export const SystemCollapseMonitor: React.FC<SystemCollapseMonitorProps> = ({
  components,
  collapseEvents,
  recoveryEvents,
  onCollapseSelect,
  showRecoveryTimeline = true
}) => {
  const [selectedCollapse, setSelectedCollapse] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    }[timeRange];

    const cutoff = now - timeRangeMs;
    
    return collapseEvents.filter(event => event.timestamp > cutoff);
  }, [collapseEvents, timeRange]);

  // Get active collapses (no recovery event or partial recovery)
  const activeCollapses = useMemo(() => {
    return filteredEvents.filter(collapse => {
      const recovery = recoveryEvents.find(r => r.collapseEventId === collapse.id);
      return !recovery || recovery.remainingIssues.length > 0;
    });
  }, [filteredEvents, recoveryEvents]);

  // Get resolved collapses
  const resolvedCollapses = useMemo(() => {
    return filteredEvents.filter(collapse => {
      const recovery = recoveryEvents.find(r => r.collapseEventId === collapse.id);
      return recovery && recovery.remainingIssues.length === 0;
    });
  }, [filteredEvents, recoveryEvents]);

  // Calculate system health score
  const systemHealthScore = useMemo(() => {
    if (activeCollapses.length === 0) return 100;
    
    const totalComponents = components.length;
    const affectedComponents = new Set();
    
    activeCollapses.forEach(collapse => {
      collapse.affectedComponents.forEach(id => affectedComponents.add(id));
    });
    
    const healthyComponents = totalComponents - affectedComponents.size;
    return Math.round((healthyComponents / totalComponents) * 100);
  }, [activeCollapses, components]);

  // Handle collapse selection
  const handleCollapseSelect = (collapseId: string) => {
    setSelectedCollapse(collapseId);
    onCollapseSelect?.(collapseId);
  };

  // Format time duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Get severity color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'total': return '🔴';
      case 'cascade': return '🟠';
      case 'partial': return '🟡';
      default: return '⚪';
    }
  };

  return (
    <div className="system-collapse-monitor">
      {/* Header */}
      <div className="monitor-header">
        <h3>System Collapse Monitor</h3>
        <div className="monitor-controls">
          <div className="time-range-selector">
            <button
              className={timeRange === '1h' ? 'active' : ''}
              onClick={() => setTimeRange('1h')}
            >
              1H
            </button>
            <button
              className={timeRange === '6h' ? 'active' : ''}
              onClick={() => setTimeRange('6h')}
            >
              6H
            </button>
            <button
              className={timeRange === '24h' ? 'active' : ''}
              onClick={() => setTimeRange('24h')}
            >
              24H
            </button>
          </div>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="system-health-overview">
        <div className="health-score">
          <div className="score-circle">
            <div 
              className="score-fill"
              style={{ 
                background: `conic-gradient(${systemHealthScore >= 80 ? '#28a745' : systemHealthScore >= 60 ? '#ffc107' : '#dc3545'} ${systemHealthScore * 3.6}deg, #e9ecef 0deg)`
              }}
            >
              <div className="score-inner">
                <span className="score-value">{systemHealthScore}%</span>
                <span className="score-label">Health</span>
              </div>
            </div>
          </div>
        </div>

        <div className="health-stats">
          <div className="stat-item">
            <span className="stat-value">{activeCollapses.length}</span>
            <span className="stat-label">Active Issues</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{resolvedCollapses.length}</span>
            <span className="stat-label">Resolved</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {activeCollapses.reduce((sum, c) => sum + c.affectedComponents.length, 0)}
            </span>
            <span className="stat-label">Affected Components</span>
          </div>
        </div>
      </div>

      {/* Active Collapses */}
      {activeCollapses.length > 0 && (
        <div className="collapse-section active">
          <h4>🚨 Active System Issues</h4>
          <div className="collapse-list">
            {activeCollapses.map(collapse => {
              const recovery = recoveryEvents.find(r => r.collapseEventId === collapse.id);
              const elapsedTime = Date.now() - collapse.timestamp;
              
              return (
                <div
                  key={collapse.id}
                  className={`collapse-item ${selectedCollapse === collapse.id ? 'selected' : ''} ${collapse.severity}`}
                  onClick={() => handleCollapseSelect(collapse.id)}
                >
                  <div className="collapse-header">
                    <div className="collapse-type">
                      <span className="type-icon">{getTypeIcon(collapse.type)}</span>
                      <span className="type-label">{collapse.type.toUpperCase()}</span>
                    </div>
                    <div className="collapse-severity">
                      <span 
                        className="severity-badge"
                        style={{ backgroundColor: getSeverityColor(collapse.severity) }}
                      >
                        {collapse.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="collapse-time">
                      <span className="elapsed-time">{formatDuration(elapsedTime)}</span>
                      <span className="time-label">elapsed</span>
                    </div>
                  </div>

                  <div className="collapse-details">
                    <div className="root-cause">
                      <strong>Root Cause:</strong> {collapse.rootCause}
                    </div>
                    <div className="affected-components">
                      <strong>Affected:</strong> {collapse.affectedComponents.length} components
                      {recovery && recovery.remainingIssues.length < collapse.affectedComponents.length && (
                        <span className="recovery-progress">
                          ({collapse.affectedComponents.length - recovery.remainingIssues.length} recovering)
                        </span>
                      )}
                    </div>
                    <div className="confidence">
                      <strong>Confidence:</strong> {(collapse.confidence * 100).toFixed(1)}%
                    </div>
                  </div>

                  {collapse.propagationPath.length > 1 && (
                    <div className="propagation-path">
                      <strong>Propagation:</strong>
                      <div className="path-visualization">
                        {collapse.propagationPath.map((componentId, index) => {
                          const component = components.find(c => c.id === componentId);
                          return (
                            <React.Fragment key={componentId}>
                              <span className="path-component">
                                {component?.name || componentId}
                              </span>
                              {index < collapse.propagationPath.length - 1 && (
                                <span className="path-arrow">→</span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recovery Timeline */}
      {showRecoveryTimeline && recoveryEvents.length > 0 && (
        <div className="recovery-timeline">
          <h4>🔄 Recovery Timeline</h4>
          <div className="timeline">
            {recoveryEvents
              .filter(recovery => {
                const collapse = collapseEvents.find(c => c.id === recovery.collapseEventId);
                return collapse && collapse.timestamp > Date.now() - (timeRange === '1h' ? 3600000 : timeRange === '6h' ? 21600000 : 86400000);
              })
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(recovery => {
                const collapse = collapseEvents.find(c => c.id === recovery.collapseEventId);
                if (!collapse) return null;

                return (
                  <div key={recovery.id} className="timeline-item">
                    <div className="timeline-marker">
                      <span className={`recovery-icon ${recovery.recoveryMethod}`}>
                        {recovery.recoveryMethod === 'automatic' ? '🔄' : 
                         recovery.recoveryMethod === 'manual' ? '🔧' : '⚠️'}
                      </span>
                    </div>
                    <div className="timeline-content">
                      <div className="recovery-header">
                        <span className="recovery-type">
                          {recovery.recoveryMethod.toUpperCase()} RECOVERY
                        </span>
                        <span className="recovery-time">
                          {new Date(recovery.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="recovery-details">
                        <div>
                          <strong>Recovered:</strong> {recovery.recoveredComponents.length} components
                        </div>
                        <div>
                          <strong>Recovery Time:</strong> {formatDuration(recovery.actualRecoveryTime)}
                        </div>
                        {recovery.remainingIssues.length > 0 && (
                          <div>
                            <strong>Remaining Issues:</strong> {recovery.remainingIssues.length} components
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* No Issues State */}
      {activeCollapses.length === 0 && filteredEvents.length === 0 && (
        <div className="no-issues">
          <div className="no-issues-icon">✅</div>
          <h4>System Operating Normally</h4>
          <p>No system collapses detected in the selected time range.</p>
        </div>
      )}

      {/* Resolved Issues Summary */}
      {resolvedCollapses.length > 0 && activeCollapses.length === 0 && (
        <div className="resolved-summary">
          <div className="resolved-icon">✅</div>
          <div className="resolved-text">
            <strong>{resolvedCollapses.length}</strong> issues resolved in the last {timeRange}
          </div>
        </div>
      )}
    </div>
  );
};