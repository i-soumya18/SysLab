/**
 * Failure Injection Panel Component
 * Allows users to inject failures during simulation to test resilience
 * Implements SRS FR-6: Failure injection scenarios
 */

import React, { useState } from 'react';
import './FailureInjectionPanel.css';

export interface FailureInjection {
  id: string;
  componentId: string;
  componentName: string;
  type: 'crash' | 'slow' | 'network-partition' | 'high-load' | 'resource-exhaustion';
  severity: number; // 0-1
  duration: number; // seconds
  startTime?: number;
}

interface FailureInjectionPanelProps {
  isVisible: boolean;
  components: Array<{ id: string; name: string; type: string }>;
  activeFailures: FailureInjection[];
  onInjectFailure: (failure: Omit<FailureInjection, 'id'>) => void;
  onRemoveFailure: (failureId: string) => void;
  simulationRunning: boolean;
}

export const FailureInjectionPanel: React.FC<FailureInjectionPanelProps> = ({
  isVisible,
  components,
  activeFailures,
  onInjectFailure,
  onRemoveFailure,
  simulationRunning
}) => {
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [failureType, setFailureType] = useState<FailureInjection['type']>('crash');
  const [severity, setSeverity] = useState<number>(0.5);
  const [duration, setDuration] = useState<number>(30);

  if (!isVisible) return null;

  const handleInjectFailure = () => {
    if (!selectedComponent) {
      alert('Please select a component');
      return;
    }

    const component = components.find(c => c.id === selectedComponent);
    if (!component) return;

    const failure: Omit<FailureInjection, 'id'> = {
      componentId: selectedComponent,
      componentName: component.name,
      type: failureType,
      severity,
      duration,
      startTime: Date.now()
    };

    onInjectFailure(failure);

    // Reset form
    setSelectedComponent('');
    setFailureType('crash');
    setSeverity(0.5);
    setDuration(30);
  };

  const getFailureTypeIcon = (type: FailureInjection['type']): string => {
    const icons = {
      'crash': '💥',
      'slow': '🐌',
      'network-partition': '🔌',
      'high-load': '📈',
      'resource-exhaustion': '⚠️'
    };
    return icons[type] || '❓';
  };

  const getFailureTypeLabel = (type: FailureInjection['type']): string => {
    const labels = {
      'crash': 'System Crash',
      'slow': 'High Latency',
      'network-partition': 'Network Partition',
      'high-load': 'High Load',
      'resource-exhaustion': 'Resource Exhaustion'
    };
    return labels[type] || type;
  };

  const getSeverityColor = (severity: number): string => {
    if (severity <= 0.25) return '#4CAF50';
    if (severity <= 0.5) return '#FF9800';
    if (severity <= 0.75) return '#F44336';
    return '#9C27B0';
  };

  const getSeverityLabel = (severity: number): string => {
    if (severity <= 0.25) return 'Low';
    if (severity <= 0.5) return 'Medium';
    if (severity <= 0.75) return 'High';
    return 'Critical';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="failure-injection-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>💥 Failure Injection</h3>
        {simulationRunning ? (
          <span className="status-badge running">Simulation Running</span>
        ) : (
          <span className="status-badge stopped">Simulation Stopped</span>
        )}
      </div>

      {!simulationRunning && (
        <div className="warning-message">
          ⚠️ Start a simulation to inject failures
        </div>
      )}

      {/* Injection Form */}
      <div className="injection-form">
        <h4>Inject New Failure</h4>

        {/* Component Selection */}
        <div className="form-group">
          <label htmlFor="component-select">Target Component</label>
          <select
            id="component-select"
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            disabled={!simulationRunning || components.length === 0}
          >
            <option value="">Select a component...</option>
            {components.map(comp => (
              <option key={comp.id} value={comp.id}>
                {comp.name} ({comp.type})
              </option>
            ))}
          </select>
        </div>

        {/* Failure Type Selection */}
        <div className="form-group">
          <label htmlFor="failure-type-select">Failure Type</label>
          <select
            id="failure-type-select"
            value={failureType}
            onChange={(e) => setFailureType(e.target.value as FailureInjection['type'])}
            disabled={!simulationRunning}
          >
            <option value="crash">{getFailureTypeIcon('crash')} System Crash</option>
            <option value="slow">{getFailureTypeIcon('slow')} High Latency</option>
            <option value="network-partition">{getFailureTypeIcon('network-partition')} Network Partition</option>
            <option value="high-load">{getFailureTypeIcon('high-load')} High Load</option>
            <option value="resource-exhaustion">{getFailureTypeIcon('resource-exhaustion')} Resource Exhaustion</option>
          </select>
        </div>

        {/* Severity Slider */}
        <div className="form-group">
          <label htmlFor="severity-slider">
            Severity: <span style={{ color: getSeverityColor(severity) }}>{getSeverityLabel(severity)}</span>
          </label>
          <input
            id="severity-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={severity}
            onChange={(e) => setSeverity(parseFloat(e.target.value))}
            disabled={!simulationRunning}
            style={{
              accentColor: getSeverityColor(severity)
            }}
          />
          <div className="severity-scale">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
            <span>Critical</span>
          </div>
        </div>

        {/* Duration Input */}
        <div className="form-group">
          <label htmlFor="duration-input">Duration (seconds)</label>
          <input
            id="duration-input"
            type="number"
            min="5"
            max="300"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
            disabled={!simulationRunning}
          />
        </div>

        {/* Inject Button */}
        <button
          className="inject-button"
          onClick={handleInjectFailure}
          disabled={!simulationRunning || !selectedComponent}
        >
          💥 Inject Failure
        </button>
      </div>

      {/* Active Failures */}
      {activeFailures.length > 0 && (
        <div className="active-failures-section">
          <h4>🔥 Active Failures ({activeFailures.length})</h4>
          <div className="failures-list">
            {activeFailures.map(failure => {
              const elapsed = failure.startTime
                ? Math.floor((Date.now() - failure.startTime) / 1000)
                : 0;
              const remaining = Math.max(0, failure.duration - elapsed);

              return (
                <div
                  key={failure.id}
                  className="failure-card"
                  style={{ borderLeftColor: getSeverityColor(failure.severity) }}
                >
                  <div className="failure-header">
                    <span className="failure-icon">{getFailureTypeIcon(failure.type)}</span>
                    <div className="failure-info">
                      <div className="failure-component">{failure.componentName}</div>
                      <div className="failure-type">{getFailureTypeLabel(failure.type)}</div>
                    </div>
                    <button
                      className="remove-button"
                      onClick={() => onRemoveFailure(failure.id)}
                      title="Remove failure"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="failure-details">
                    <div className="detail">
                      <span className="detail-label">Severity:</span>
                      <span
                        className="detail-value"
                        style={{ color: getSeverityColor(failure.severity) }}
                      >
                        {getSeverityLabel(failure.severity)}
                      </span>
                    </div>
                    <div className="detail">
                      <span className="detail-label">Remaining:</span>
                      <span className="detail-value">{formatDuration(remaining)}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="failure-progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.max(0, (remaining / failure.duration) * 100)}%`,
                        backgroundColor: getSeverityColor(failure.severity)
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Scenarios */}
      <div className="quick-scenarios-section">
        <h4>⚡ Quick Scenarios</h4>
        <div className="quick-scenarios">
          <button
            className="quick-scenario-btn"
            onClick={() => {
              if (components.length > 0) {
                const dbComponent = components.find(c => c.type.includes('database'));
                if (dbComponent) {
                  onInjectFailure({
                    componentId: dbComponent.id,
                    componentName: dbComponent.name,
                    type: 'slow',
                    severity: 0.7,
                    duration: 60,
                    startTime: Date.now()
                  });
                }
              }
            }}
            disabled={!simulationRunning || !components.some(c => c.type.includes('database'))}
          >
            🐌 Slow Database
          </button>
          <button
            className="quick-scenario-btn"
            onClick={() => {
              if (components.length > 0) {
                const serverComponent = components.find(c => c.type.includes('server'));
                if (serverComponent) {
                  onInjectFailure({
                    componentId: serverComponent.id,
                    componentName: serverComponent.name,
                    type: 'crash',
                    severity: 1.0,
                    duration: 30,
                    startTime: Date.now()
                  });
                }
              }
            }}
            disabled={!simulationRunning || !components.some(c => c.type.includes('server'))}
          >
            💥 Server Crash
          </button>
          <button
            className="quick-scenario-btn"
            onClick={() => {
              if (components.length > 0) {
                const networkComponent = components.find(c => c.type.includes('load-balancer'));
                if (networkComponent) {
                  onInjectFailure({
                    componentId: networkComponent.id,
                    componentName: networkComponent.name,
                    type: 'network-partition',
                    severity: 0.9,
                    duration: 45,
                    startTime: Date.now()
                  });
                }
              }
            }}
            disabled={!simulationRunning || !components.some(c => c.type.includes('load-balancer'))}
          >
            🔌 Network Partition
          </button>
        </div>
      </div>

      {/* Learning Tips */}
      <div className="learning-tips">
        <h4>💡 Learning Tips</h4>
        <ul>
          <li>Test your system's resilience by injecting failures</li>
          <li>Observe how failures cascade through your architecture</li>
          <li>Identify single points of failure</li>
          <li>Design redundancy and failover mechanisms</li>
        </ul>
      </div>
    </div>
  );
};
