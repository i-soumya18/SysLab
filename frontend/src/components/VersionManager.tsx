/**
 * Version Manager Component
 * Handles workspace versioning and performance comparison visualization
 */

import React, { useState, useEffect } from 'react';
import { WorkspaceVersion, PerformanceComparison } from '../types';
import './VersionManager.css';

interface VersionManagerProps {
  workspaceId: string;
  onVersionSelect?: (version: WorkspaceVersion) => void;
  onComparisonComplete?: (comparison: PerformanceComparison) => void;
}

interface CreateVersionData {
  name: string;
  description: string;
}

export const VersionManager: React.FC<VersionManagerProps> = ({
  workspaceId,
  onVersionSelect,
  onComparisonComplete
}) => {
  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createVersionData, setCreateVersionData] = useState<CreateVersionData>({
    name: '',
    description: ''
  });
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PerformanceComparison | null>(null);

  useEffect(() => {
    loadVersions();
  }, [workspaceId]);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/versions?includeMetrics=true`);
      if (!response.ok) {
        throw new Error('Failed to load versions');
      }

      const versionsData = await response.json();
      setVersions(versionsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createVersion = async () => {
    if (!createVersionData.name.trim()) {
      setError('Version name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createVersionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create version');
      }

      const newVersion = await response.json();
      setVersions(prev => [newVersion, ...prev]);
      setShowCreateForm(false);
      setCreateVersionData({ name: '', description: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const compareVersions = async () => {
    if (selectedVersions.length !== 2) {
      setError('Please select exactly 2 versions to compare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/versions/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baselineVersionId: selectedVersions[0],
          comparisonVersionId: selectedVersions[1]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to compare versions');
      }

      const comparisonData = await response.json();
      setComparison(comparisonData);
      onComparisonComplete?.(comparisonData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSelection = (versionId: string, checked: boolean) => {
    if (checked) {
      if (selectedVersions.length < 2) {
        setSelectedVersions(prev => [...prev, versionId]);
      }
    } else {
      setSelectedVersions(prev => prev.filter(id => id !== versionId));
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPerformanceIndicator = (version: WorkspaceVersion) => {
    if (!version.performanceMetrics) return null;

    const metrics = version.performanceMetrics;
    const latencyScore = Math.max(0, 100 - metrics.averageLatency);
    const throughputScore = Math.min(100, metrics.throughput / 10);
    const errorScore = Math.max(0, 100 - metrics.errorRate * 100);
    
    const overallScore = (latencyScore + throughputScore + errorScore) / 3;
    
    if (overallScore >= 80) return 'excellent';
    if (overallScore >= 60) return 'good';
    if (overallScore >= 40) return 'fair';
    return 'poor';
  };

  return (
    <div className="version-manager">
      <div className="version-manager-header">
        <h3>Version Management</h3>
        <div className="version-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
            disabled={loading}
          >
            Create Version
          </button>
          <button
            className="btn btn-secondary"
            onClick={compareVersions}
            disabled={loading || selectedVersions.length !== 2}
          >
            Compare Selected ({selectedVersions.length}/2)
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="create-version-form">
          <h4>Create New Version</h4>
          <div className="form-group">
            <label htmlFor="version-name">Version Name</label>
            <input
              id="version-name"
              type="text"
              value={createVersionData.name}
              onChange={(e) => setCreateVersionData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Optimized Load Balancer"
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label htmlFor="version-description">Description (Optional)</label>
            <textarea
              id="version-description"
              value={createVersionData.description}
              onChange={(e) => setCreateVersionData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the changes in this version..."
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={createVersion}
              disabled={loading || !createVersionData.name.trim()}
            >
              {loading ? 'Creating...' : 'Create Version'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowCreateForm(false);
                setCreateVersionData({ name: '', description: '' });
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="versions-list">
        {loading && versions.length === 0 ? (
          <div className="loading">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="empty-state">
            <p>No versions created yet.</p>
            <p>Create your first version to start tracking design iterations.</p>
          </div>
        ) : (
          <div className="versions-grid">
            {versions.map((version) => {
              const performanceIndicator = getPerformanceIndicator(version);
              const isSelected = selectedVersions.includes(version.id);
              
              return (
                <div
                  key={version.id}
                  className={`version-card ${isSelected ? 'selected' : ''} ${performanceIndicator || ''}`}
                  onClick={() => onVersionSelect?.(version)}
                >
                  <div className="version-header">
                    <div className="version-info">
                      <h4>v{version.versionNumber}: {version.name}</h4>
                      <p className="version-date">{formatDate(version.createdAt)}</p>
                      <p className="version-author">by {version.createdBy}</p>
                    </div>
                    <div className="version-controls">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleVersionSelection(version.id, e.target.checked);
                        }}
                        disabled={!isSelected && selectedVersions.length >= 2}
                      />
                      {performanceIndicator && (
                        <div className={`performance-badge ${performanceIndicator}`}>
                          {performanceIndicator}
                        </div>
                      )}
                    </div>
                  </div>

                  {version.description && (
                    <p className="version-description">{version.description}</p>
                  )}

                  <div className="version-stats">
                    <div className="stat">
                      <span className="stat-label">Components:</span>
                      <span className="stat-value">{version.snapshot.components.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Connections:</span>
                      <span className="stat-value">{version.snapshot.connections.length}</span>
                    </div>
                  </div>

                  {version.performanceMetrics && (
                    <div className="performance-summary">
                      <div className="metric">
                        <span className="metric-label">Avg Latency:</span>
                        <span className="metric-value">{version.performanceMetrics.averageLatency.toFixed(1)}ms</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Throughput:</span>
                        <span className="metric-value">{version.performanceMetrics.throughput.toFixed(0)} req/s</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Error Rate:</span>
                        <span className="metric-value">{(version.performanceMetrics.errorRate * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {comparison && (
        <div className="comparison-results">
          <h4>Performance Comparison Results</h4>
          <div className="comparison-summary">
            <p>{comparison.summary}</p>
          </div>
          
          <div className="comparison-metrics">
            <div className="metric-comparison">
              <h5>Overall Performance Changes</h5>
              <div className="metrics-grid">
                <div className={`metric-change ${comparison.overallImprovement.latencyChange < 0 ? 'improved' : 'degraded'}`}>
                  <span className="metric-name">Latency</span>
                  <span className="metric-change-value">
                    {comparison.overallImprovement.latencyChange > 0 ? '+' : ''}
                    {comparison.overallImprovement.latencyChange.toFixed(1)}%
                  </span>
                </div>
                <div className={`metric-change ${comparison.overallImprovement.throughputChange > 0 ? 'improved' : 'degraded'}`}>
                  <span className="metric-name">Throughput</span>
                  <span className="metric-change-value">
                    {comparison.overallImprovement.throughputChange > 0 ? '+' : ''}
                    {comparison.overallImprovement.throughputChange.toFixed(1)}%
                  </span>
                </div>
                <div className={`metric-change ${comparison.overallImprovement.errorRateChange < 0 ? 'improved' : 'degraded'}`}>
                  <span className="metric-name">Error Rate</span>
                  <span className="metric-change-value">
                    {comparison.overallImprovement.errorRateChange > 0 ? '+' : ''}
                    {comparison.overallImprovement.errorRateChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {comparison.recommendations.length > 0 && (
            <div className="recommendations">
              <h5>Recommendations</h5>
              <ul>
                {comparison.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionManager;