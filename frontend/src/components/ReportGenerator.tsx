/**
 * Report Generator Component
 * Handles creation and management of performance reports
 */

import React, { useState, useEffect } from 'react';
import { PerformanceReport, WorkspaceVersion } from '../types';
import './ReportGenerator.css';

interface ReportGeneratorProps {
  workspaceId: string;
  versions: WorkspaceVersion[];
  onReportGenerated?: (report: PerformanceReport) => void;
}

interface ReportRequest {
  reportType: 'single' | 'comparison' | 'trend';
  title: string;
  versionId?: string;
  comparisonVersionId?: string;
  includeRecommendations: boolean;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  workspaceId,
  versions,
  onReportGenerated
}) => {
  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reportRequest, setReportRequest] = useState<ReportRequest>({
    reportType: 'single',
    title: '',
    includeRecommendations: true
  });
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    loadReports();
    loadInsights();
  }, [workspaceId]);

  const loadReports = async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/reports`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  const loadInsights = async () => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/insights`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
    }
  };

  const generateReport = async () => {
    if (!reportRequest.title.trim()) {
      setError('Report title is required');
      return;
    }

    if (reportRequest.reportType === 'single' && !reportRequest.versionId) {
      setError('Please select a version for single version report');
      return;
    }

    if (reportRequest.reportType === 'comparison' && (!reportRequest.versionId || !reportRequest.comparisonVersionId)) {
      setError('Please select both versions for comparison report');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          ...reportRequest
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate report');
      }

      const report = await response.json();
      setReports(prev => [report, ...prev]);
      setShowCreateForm(false);
      resetForm();
      onReportGenerated?.(report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (reportId: string, format: 'json' | 'html' | 'pdf') => {
    try {
      const response = await fetch(`/api/v1/reports/${reportId}/export/${format}`);
      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(`Failed to export report: ${err.message}`);
    }
  };

  const shareReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/v1/reports/${reportId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expiresIn: 7 * 24 * 60 * 60 // 7 days
        })
      });

      if (!response.ok) {
        throw new Error('Failed to share report');
      }

      const shareData = await response.json();
      
      // Copy share URL to clipboard
      await navigator.clipboard.writeText(shareData.shareUrl);
      alert('Share link copied to clipboard!');
    } catch (err: any) {
      setError(`Failed to share report: ${err.message}`);
    }
  };

  const resetForm = () => {
    setReportRequest({
      reportType: 'single',
      title: '',
      includeRecommendations: true
    });
    setError(null);
  };

  const getReportTypeDescription = (type: string) => {
    switch (type) {
      case 'single':
        return 'Analyze performance of a single workspace version';
      case 'comparison':
        return 'Compare performance between two workspace versions';
      case 'trend':
        return 'Analyze performance trends over time';
      default:
        return '';
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

  return (
    <div className="report-generator">
      <div className="report-header">
        <h3>Performance Reports</h3>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={loading}
        >
          Generate Report
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Quick Insights Panel */}
      {insights && (
        <div className="insights-panel">
          <h4>Quick Insights</h4>
          <div className="insights-grid">
            <div className="insight-card">
              <h5>Average Latency</h5>
              <span className="metric-value">{insights.keyMetrics.averageLatency}ms</span>
            </div>
            <div className="insight-card">
              <h5>Throughput</h5>
              <span className="metric-value">{insights.keyMetrics.throughput} req/s</span>
            </div>
            <div className="insight-card">
              <h5>Reliability</h5>
              <span className="metric-value">{insights.keyMetrics.reliability}%</span>
            </div>
            <div className="insight-card">
              <h5>Error Rate</h5>
              <span className="metric-value">{(insights.keyMetrics.errorRate * 100).toFixed(2)}%</span>
            </div>
          </div>
          
          {insights.topBottlenecks.length > 0 && (
            <div className="bottlenecks-summary">
              <h5>Top Bottlenecks</h5>
              <ul>
                {insights.topBottlenecks.map((bottleneck: any, index: number) => (
                  <li key={index} className={`bottleneck-item ${bottleneck.severity}`}>
                    <strong>{bottleneck.component}</strong> - {bottleneck.impact}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showCreateForm && (
        <div className="create-report-form">
          <h4>Generate New Report</h4>
          
          <div className="form-group">
            <label htmlFor="report-type">Report Type</label>
            <select
              id="report-type"
              value={reportRequest.reportType}
              onChange={(e) => setReportRequest(prev => ({ 
                ...prev, 
                reportType: e.target.value as 'single' | 'comparison' | 'trend'
              }))}
            >
              <option value="single">Single Version Analysis</option>
              <option value="comparison">Version Comparison</option>
              <option value="trend">Trend Analysis</option>
            </select>
            <small>{getReportTypeDescription(reportRequest.reportType)}</small>
          </div>

          <div className="form-group">
            <label htmlFor="report-title">Report Title</label>
            <input
              id="report-title"
              type="text"
              value={reportRequest.title}
              onChange={(e) => setReportRequest(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Performance Analysis - Load Balancer Optimization"
              maxLength={100}
            />
          </div>

          {(reportRequest.reportType === 'single' || reportRequest.reportType === 'comparison') && (
            <div className="form-group">
              <label htmlFor="version-select">
                {reportRequest.reportType === 'comparison' ? 'Baseline Version' : 'Version'}
              </label>
              <select
                id="version-select"
                value={reportRequest.versionId || ''}
                onChange={(e) => setReportRequest(prev => ({ ...prev, versionId: e.target.value }))}
              >
                <option value="">Select version...</option>
                {versions.map(version => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber}: {version.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportRequest.reportType === 'comparison' && (
            <div className="form-group">
              <label htmlFor="comparison-version-select">Comparison Version</label>
              <select
                id="comparison-version-select"
                value={reportRequest.comparisonVersionId || ''}
                onChange={(e) => setReportRequest(prev => ({ ...prev, comparisonVersionId: e.target.value }))}
              >
                <option value="">Select version...</option>
                {versions.filter(v => v.id !== reportRequest.versionId).map(version => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber}: {version.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reportRequest.includeRecommendations}
                onChange={(e) => setReportRequest(prev => ({ 
                  ...prev, 
                  includeRecommendations: e.target.checked 
                }))}
              />
              Include performance recommendations
            </label>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={generateReport}
              disabled={loading || !reportRequest.title.trim()}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowCreateForm(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="reports-list">
        {reports.length === 0 ? (
          <div className="empty-state">
            <p>No reports generated yet.</p>
            <p>Create your first performance report to get detailed insights.</p>
          </div>
        ) : (
          <div className="reports-grid">
            {reports.map((report) => (
              <div key={report.id} className="report-card">
                <div className="report-header">
                  <h4>{report.title}</h4>
                  <span className={`report-type-badge ${report.reportType}`}>
                    {report.reportType}
                  </span>
                </div>

                <p className="report-summary">{report.summary}</p>

                <div className="report-meta">
                  <span className="report-date">
                    Generated: {formatDate(report.generatedAt)}
                  </span>
                  <span className="report-sections">
                    {report.sections.length} sections
                  </span>
                </div>

                {report.recommendations.length > 0 && (
                  <div className="recommendations-preview">
                    <strong>{report.recommendations.length} recommendations</strong>
                    <ul>
                      {report.recommendations.slice(0, 2).map((rec, index) => (
                        <li key={index} className={`priority-${rec.priority}`}>
                          {rec.title}
                        </li>
                      ))}
                      {report.recommendations.length > 2 && (
                        <li className="more-recommendations">
                          +{report.recommendations.length - 2} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="report-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => exportReport(report.id, 'html')}
                  >
                    Export HTML
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => exportReport(report.id, 'pdf')}
                  >
                    Export PDF
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => shareReport(report.id)}
                  >
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;