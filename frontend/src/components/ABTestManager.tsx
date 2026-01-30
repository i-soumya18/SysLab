/**
 * A/B Test Manager Component
 * Handles creation and management of A/B tests for design iterations
 */

import React, { useState, useEffect } from 'react';
import { ABTestConfig, WorkspaceVersion, ABTestResults } from '../types';
import './ABTestManager.css';

interface ABTestManagerProps {
  workspaceId: string;
  versions: WorkspaceVersion[];
  onTestCreated?: (test: ABTestConfig) => void;
  onTestStarted?: (testId: string) => void;
}

interface CreateABTestData {
  name: string;
  description: string;
  variants: {
    name: string;
    versionId: string;
    trafficPercentage: number;
  }[];
  duration: number;
  metrics: string[];
}

export const ABTestManager: React.FC<ABTestManagerProps> = ({
  workspaceId,
  versions,
  onTestCreated,
  onTestStarted
}) => {
  const [tests, setTests] = useState<ABTestConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTestData, setCreateTestData] = useState<CreateABTestData>({
    name: '',
    description: '',
    variants: [
      { name: 'Control', versionId: '', trafficPercentage: 50 },
      { name: 'Treatment', versionId: '', trafficPercentage: 50 }
    ],
    duration: 3600, // 1 hour default
    metrics: ['latency', 'throughput', 'errorRate']
  });

  const availableMetrics = [
    { id: 'latency', label: 'Average Latency', description: 'Response time performance' },
    { id: 'throughput', label: 'Throughput', description: 'Requests per second' },
    { id: 'errorRate', label: 'Error Rate', description: 'Percentage of failed requests' },
    { id: 'resourceUtilization', label: 'Resource Utilization', description: 'CPU and memory usage' },
    { id: 'queueDepth', label: 'Queue Depth', description: 'Average queue length' }
  ];

  useEffect(() => {
    loadABTests();
  }, [workspaceId]);

  const loadABTests = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/ab-tests`);
      if (!response.ok) {
        throw new Error('Failed to load A/B tests');
      }

      const testsData = await response.json();
      setTests(testsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createABTest = async () => {
    if (!createTestData.name.trim()) {
      setError('Test name is required');
      return;
    }

    // Validate variants
    if (createTestData.variants.length < 2) {
      setError('At least 2 variants are required');
      return;
    }

    const totalTraffic = createTestData.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      setError('Traffic percentages must add up to 100%');
      return;
    }

    for (const variant of createTestData.variants) {
      if (!variant.name.trim() || !variant.versionId) {
        setError('All variants must have a name and selected version');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/ab-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createTestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create A/B test');
      }

      const newTest = await response.json();
      setTests(prev => [newTest, ...prev]);
      setShowCreateForm(false);
      resetCreateForm();
      onTestCreated?.(newTest);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setCreateTestData({
      name: '',
      description: '',
      variants: [
        { name: 'Control', versionId: '', trafficPercentage: 50 },
        { name: 'Treatment', versionId: '', trafficPercentage: 50 }
      ],
      duration: 3600,
      metrics: ['latency', 'throughput', 'errorRate']
    });
    setError(null);
  };

  const addVariant = () => {
    const currentVariants = createTestData.variants.length;
    const newTrafficPercentage = Math.floor(100 / (currentVariants + 1));
    
    // Redistribute traffic evenly
    const updatedVariants = createTestData.variants.map(v => ({
      ...v,
      trafficPercentage: newTrafficPercentage
    }));

    setCreateTestData(prev => ({
      ...prev,
      variants: [
        ...updatedVariants,
        {
          name: `Variant ${currentVariants + 1}`,
          versionId: '',
          trafficPercentage: newTrafficPercentage
        }
      ]
    }));
  };

  const removeVariant = (index: number) => {
    if (createTestData.variants.length <= 2) return;

    const updatedVariants = createTestData.variants.filter((_, i) => i !== index);
    const newTrafficPercentage = Math.floor(100 / updatedVariants.length);
    
    // Redistribute traffic evenly
    const redistributedVariants = updatedVariants.map(v => ({
      ...v,
      trafficPercentage: newTrafficPercentage
    }));

    setCreateTestData(prev => ({
      ...prev,
      variants: redistributedVariants
    }));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setCreateTestData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) => 
        i === index ? { ...variant, [field]: value } : variant
      )
    }));
  };

  const toggleMetric = (metricId: string) => {
    setCreateTestData(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter(m => m !== metricId)
        : [...prev.metrics, metricId]
    }));
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#6c757d';
      case 'running': return '#007bff';
      case 'completed': return '#28a745';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div className="ab-test-manager">
      <div className="ab-test-header">
        <h3>A/B Testing</h3>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={loading || versions.length < 2}
        >
          Create A/B Test
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {versions.length < 2 && (
        <div className="warning-message">
          You need at least 2 workspace versions to create an A/B test.
        </div>
      )}

      {showCreateForm && (
        <div className="create-test-form">
          <h4>Create New A/B Test</h4>
          
          <div className="form-group">
            <label htmlFor="test-name">Test Name</label>
            <input
              id="test-name"
              type="text"
              value={createTestData.name}
              onChange={(e) => setCreateTestData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Load Balancer Optimization Test"
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="test-description">Description</label>
            <textarea
              id="test-description"
              value={createTestData.description}
              onChange={(e) => setCreateTestData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what you're testing..."
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Test Variants</label>
            <div className="variants-list">
              {createTestData.variants.map((variant, index) => (
                <div key={index} className="variant-config">
                  <div className="variant-header">
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariant(index, 'name', e.target.value)}
                      placeholder="Variant name"
                      className="variant-name"
                    />
                    {createTestData.variants.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeVariant(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="variant-controls">
                    <div className="form-field">
                      <label>Version</label>
                      <select
                        value={variant.versionId}
                        onChange={(e) => updateVariant(index, 'versionId', e.target.value)}
                      >
                        <option value="">Select version...</option>
                        {versions.map(version => (
                          <option key={version.id} value={version.id}>
                            v{version.versionNumber}: {version.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-field">
                      <label>Traffic %</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={variant.trafficPercentage}
                        onChange={(e) => updateVariant(index, 'trafficPercentage', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addVariant}
              disabled={createTestData.variants.length >= 5}
            >
              Add Variant
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="test-duration">Duration (seconds)</label>
            <input
              id="test-duration"
              type="number"
              min="60"
              max="86400"
              value={createTestData.duration}
              onChange={(e) => setCreateTestData(prev => ({ ...prev, duration: parseInt(e.target.value) || 3600 }))}
            />
            <small>Current: {formatDuration(createTestData.duration)}</small>
          </div>

          <div className="form-group">
            <label>Metrics to Track</label>
            <div className="metrics-selection">
              {availableMetrics.map(metric => (
                <div key={metric.id} className="metric-option">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={createTestData.metrics.includes(metric.id)}
                      onChange={() => toggleMetric(metric.id)}
                    />
                    <span className="metric-name">{metric.label}</span>
                    <small className="metric-description">{metric.description}</small>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={createABTest}
              disabled={loading || !createTestData.name.trim()}
            >
              {loading ? 'Creating...' : 'Create A/B Test'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowCreateForm(false);
                resetCreateForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="tests-list">
        {loading && tests.length === 0 ? (
          <div className="loading">Loading A/B tests...</div>
        ) : tests.length === 0 ? (
          <div className="empty-state">
            <p>No A/B tests created yet.</p>
            <p>Create your first test to compare design performance.</p>
          </div>
        ) : (
          <div className="tests-grid">
            {tests.map((test) => (
              <div key={test.id} className="test-card">
                <div className="test-header">
                  <h4>{test.name}</h4>
                  <div 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(test.status) }}
                  >
                    {test.status}
                  </div>
                </div>

                {test.description && (
                  <p className="test-description">{test.description}</p>
                )}

                <div className="test-info">
                  <div className="info-item">
                    <span className="info-label">Variants:</span>
                    <span className="info-value">{test.variants.length}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Duration:</span>
                    <span className="info-value">{formatDuration(test.duration)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Metrics:</span>
                    <span className="info-value">{test.metrics.length}</span>
                  </div>
                </div>

                <div className="variants-summary">
                  {test.variants.map((variant, index) => (
                    <div key={variant.id} className="variant-summary">
                      <span className="variant-name">{variant.name}</span>
                      <span className="variant-traffic">{variant.trafficPercentage}%</span>
                    </div>
                  ))}
                </div>

                <div className="test-actions">
                  {test.status === 'draft' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onTestStarted?.(test.id)}
                    >
                      Start Test
                    </button>
                  )}
                  {test.status === 'completed' && (
                    <button className="btn btn-secondary btn-sm">
                      View Results
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ABTestManager;