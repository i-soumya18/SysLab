/**
 * Bottleneck analysis and reporting component
 */

import React, { useState, useEffect } from 'react';
import type { Component } from '../types';

export interface BottleneckDetection {
  componentId: string;
  componentName: string;
  componentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bottleneckType: 'cpu' | 'memory' | 'latency' | 'throughput' | 'queue' | 'error_rate';
  currentValue: number;
  threshold: number;
  impact: number;
  description: string;
  recommendations: string[];
  timestamp: number;
}

export interface SystemBottleneckReport {
  timestamp: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  bottlenecks: BottleneckDetection[];
  systemImpact: number;
  primaryBottleneck: BottleneckDetection | null;
  recommendations: string[];
  performanceTrends: {
    throughputTrend: 'improving' | 'stable' | 'degrading';
    latencyTrend: 'improving' | 'stable' | 'degrading';
    errorTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface BottleneckAnalysisProps {
  components: Component[];
  currentReport?: SystemBottleneckReport;
  isSimulationRunning: boolean;
  onRefreshAnalysis?: () => void;
}

export const BottleneckAnalysis: React.FC<BottleneckAnalysisProps> = ({
  components,
  currentReport,
  isSimulationRunning,
  onRefreshAnalysis
}) => {
  const [selectedBottleneck, setSelectedBottleneck] = useState<BottleneckDetection | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'details' | 'recommendations'>('overview');

  // Mock data for demonstration
  const [mockReport, setMockReport] = useState<SystemBottleneckReport | null>(null);

  useEffect(() => {
    if (!isSimulationRunning) return;

    // Generate mock bottleneck data
    const generateMockReport = () => {
      const bottlenecks: BottleneckDetection[] = [];
      
      // Randomly generate some bottlenecks
      components.forEach((component) => {
        if (Math.random() > 0.7) { // 30% chance of bottleneck
          const bottleneckTypes = ['cpu', 'memory', 'latency', 'queue', 'error_rate'] as const;
          const severities = ['low', 'medium', 'high', 'critical'] as const;
          
          const bottleneckType = bottleneckTypes[Math.floor(Math.random() * bottleneckTypes.length)];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          
          let currentValue = 0;
          let threshold = 0;
          let description = '';
          
          switch (bottleneckType) {
            case 'cpu':
              currentValue = 0.6 + Math.random() * 0.4;
              threshold = 0.7;
              description = `High CPU utilization (${(currentValue * 100).toFixed(1)}%)`;
              break;
            case 'memory':
              currentValue = 0.7 + Math.random() * 0.3;
              threshold = 0.8;
              description = `High memory utilization (${(currentValue * 100).toFixed(1)}%)`;
              break;
            case 'latency':
              currentValue = 300 + Math.random() * 700;
              threshold = 500;
              description = `High response latency (${currentValue.toFixed(1)}ms)`;
              break;
            case 'queue':
              currentValue = 30 + Math.random() * 70;
              threshold = 50;
              description = `High queue depth (${Math.floor(currentValue)} requests)`;
              break;
            case 'error_rate':
              currentValue = 0.03 + Math.random() * 0.07;
              threshold = 0.05;
              description = `High error rate (${(currentValue * 100).toFixed(2)}%)`;
              break;
          }

          bottlenecks.push({
            componentId: component.id,
            componentName: component.metadata.name,
            componentType: component.type,
            severity,
            bottleneckType,
            currentValue,
            threshold,
            impact: Math.random() * 0.8 + 0.2,
            description,
            recommendations: [
              'Consider scaling horizontally',
              'Optimize component configuration',
              'Review resource allocation'
            ],
            timestamp: Date.now()
          });
        }
      });

      const overallHealth: 'healthy' | 'degraded' | 'critical' = 
        bottlenecks.some(b => b.severity === 'critical') ? 'critical' :
        bottlenecks.length > 2 ? 'degraded' : 'healthy';

      const report: SystemBottleneckReport = {
        timestamp: Date.now(),
        overallHealth,
        bottlenecks,
        systemImpact: bottlenecks.length > 0 ? Math.random() * 0.6 + 0.2 : 0,
        primaryBottleneck: bottlenecks.length > 0 ? bottlenecks[0] : null,
        recommendations: [
          'Monitor system performance closely',
          'Consider implementing auto-scaling',
          'Review component configurations'
        ],
        performanceTrends: {
          throughputTrend: Math.random() > 0.5 ? 'stable' : 'degrading',
          latencyTrend: Math.random() > 0.5 ? 'stable' : 'degrading',
          errorTrend: 'stable'
        }
      };

      setMockReport(report);
    };

    generateMockReport();
    const interval = setInterval(generateMockReport, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, [components, isSimulationRunning]);

  const report = currentReport || mockReport;

  if (!report) {
    return (
      <div className="bottleneck-analysis">
        <div className="no-data">
          <h3>Bottleneck Analysis</h3>
          <p>No analysis data available. Start a simulation to begin monitoring.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bottleneck-analysis">
      <div className="analysis-header">
        <h2>Bottleneck Analysis</h2>
        
        <div className="analysis-controls">
          <div className="view-mode-selector">
            <button
              className={`mode-btn ${viewMode === 'overview' ? 'active' : ''}`}
              onClick={() => setViewMode('overview')}
            >
              Overview
            </button>
            <button
              className={`mode-btn ${viewMode === 'details' ? 'active' : ''}`}
              onClick={() => setViewMode('details')}
            >
              Details
            </button>
            <button
              className={`mode-btn ${viewMode === 'recommendations' ? 'active' : ''}`}
              onClick={() => setViewMode('recommendations')}
            >
              Recommendations
            </button>
          </div>

          {onRefreshAnalysis && (
            <button onClick={onRefreshAnalysis} className="refresh-btn">
              Refresh Analysis
            </button>
          )}
        </div>
      </div>

      <div className="system-health-indicator">
        <div className={`health-status ${report.overallHealth}`}>
          <span className="health-dot"></span>
          <span className="health-text">
            System Health: {report.overallHealth.charAt(0).toUpperCase() + report.overallHealth.slice(1)}
          </span>
        </div>
        
        <div className="system-impact">
          <span>System Impact: {(report.systemImpact * 100).toFixed(1)}%</span>
          <div className="impact-bar">
            <div 
              className="impact-fill" 
              style={{ width: `${report.systemImpact * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {viewMode === 'overview' && (
        <OverviewView 
          report={report} 
          onBottleneckSelect={setSelectedBottleneck}
        />
      )}

      {viewMode === 'details' && (
        <DetailsView 
          report={report}
          selectedBottleneck={selectedBottleneck}
          onBottleneckSelect={setSelectedBottleneck}
        />
      )}

      {viewMode === 'recommendations' && (
        <RecommendationsView report={report} />
      )}
    </div>
  );
};

interface OverviewViewProps {
  report: SystemBottleneckReport;
  onBottleneckSelect: (bottleneck: BottleneckDetection) => void;
}

const OverviewView: React.FC<OverviewViewProps> = ({ report, onBottleneckSelect }) => {
  const bottlenecksBySeverity = report.bottlenecks.reduce((acc, b) => {
    if (!acc[b.severity]) acc[b.severity] = [];
    acc[b.severity].push(b);
    return acc;
  }, {} as Record<string, BottleneckDetection[]>);

  return (
    <div className="overview-view">
      <div className="bottleneck-summary">
        <div className="summary-cards">
          <div className="summary-card critical">
            <h4>Critical</h4>
            <span className="count">{bottlenecksBySeverity.critical?.length || 0}</span>
          </div>
          <div className="summary-card high">
            <h4>High</h4>
            <span className="count">{bottlenecksBySeverity.high?.length || 0}</span>
          </div>
          <div className="summary-card medium">
            <h4>Medium</h4>
            <span className="count">{bottlenecksBySeverity.medium?.length || 0}</span>
          </div>
          <div className="summary-card low">
            <h4>Low</h4>
            <span className="count">{bottlenecksBySeverity.low?.length || 0}</span>
          </div>
        </div>
      </div>

      {report.primaryBottleneck && (
        <div className="primary-bottleneck">
          <h3>Primary Bottleneck</h3>
          <BottleneckCard 
            bottleneck={report.primaryBottleneck}
            onClick={() => onBottleneckSelect(report.primaryBottleneck!)}
          />
        </div>
      )}

      <div className="performance-trends">
        <h3>Performance Trends</h3>
        <div className="trends-grid">
          <div className={`trend-item ${report.performanceTrends.throughputTrend}`}>
            <span className="trend-label">Throughput</span>
            <span className="trend-value">{report.performanceTrends.throughputTrend}</span>
          </div>
          <div className={`trend-item ${report.performanceTrends.latencyTrend}`}>
            <span className="trend-label">Latency</span>
            <span className="trend-value">{report.performanceTrends.latencyTrend}</span>
          </div>
          <div className={`trend-item ${report.performanceTrends.errorTrend}`}>
            <span className="trend-label">Error Rate</span>
            <span className="trend-value">{report.performanceTrends.errorTrend}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DetailsViewProps {
  report: SystemBottleneckReport;
  selectedBottleneck: BottleneckDetection | null;
  onBottleneckSelect: (bottleneck: BottleneckDetection) => void;
}

const DetailsView: React.FC<DetailsViewProps> = ({ 
  report, 
  selectedBottleneck, 
  onBottleneckSelect 
}) => {
  return (
    <div className="details-view">
      <div className="bottlenecks-list">
        <h3>All Bottlenecks ({report.bottlenecks.length})</h3>
        {report.bottlenecks.length === 0 ? (
          <p className="no-bottlenecks">No bottlenecks detected. System is performing well!</p>
        ) : (
          <div className="bottleneck-cards">
            {report.bottlenecks.map((bottleneck, index) => (
              <BottleneckCard
                key={`${bottleneck.componentId}-${bottleneck.bottleneckType}-${index}`}
                bottleneck={bottleneck}
                isSelected={selectedBottleneck?.componentId === bottleneck.componentId && 
                           selectedBottleneck?.bottleneckType === bottleneck.bottleneckType}
                onClick={() => onBottleneckSelect(bottleneck)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedBottleneck && (
        <div className="bottleneck-details">
          <h3>Bottleneck Details</h3>
          <div className="detail-content">
            <div className="detail-header">
              <h4>{selectedBottleneck.componentName}</h4>
              <span className={`severity-badge ${selectedBottleneck.severity}`}>
                {selectedBottleneck.severity}
              </span>
            </div>
            
            <div className="detail-metrics">
              <div className="metric">
                <span className="metric-label">Type:</span>
                <span className="metric-value">{selectedBottleneck.bottleneckType}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Current Value:</span>
                <span className="metric-value">{selectedBottleneck.currentValue.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Threshold:</span>
                <span className="metric-value">{selectedBottleneck.threshold.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Impact:</span>
                <span className="metric-value">{(selectedBottleneck.impact * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="recommendations">
              <h5>Recommendations:</h5>
              <ul>
                {selectedBottleneck.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface RecommendationsViewProps {
  report: SystemBottleneckReport;
}

const RecommendationsView: React.FC<RecommendationsViewProps> = ({ report }) => {
  return (
    <div className="recommendations-view">
      <div className="system-recommendations">
        <h3>System Recommendations</h3>
        {report.recommendations.length === 0 ? (
          <p>No specific recommendations at this time.</p>
        ) : (
          <ul className="recommendation-list">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="recommendation-item">
                {rec}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="component-recommendations">
        <h3>Component-Specific Recommendations</h3>
        {report.bottlenecks.map((bottleneck, index) => (
          <div key={`${bottleneck.componentId}-${index}`} className="component-rec">
            <h4>{bottleneck.componentName} ({bottleneck.severity})</h4>
            <ul>
              {bottleneck.recommendations.map((rec, recIndex) => (
                <li key={recIndex}>{rec}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

interface BottleneckCardProps {
  bottleneck: BottleneckDetection;
  isSelected?: boolean;
  onClick: () => void;
}

const BottleneckCard: React.FC<BottleneckCardProps> = ({ 
  bottleneck, 
  isSelected = false, 
  onClick 
}) => {
  return (
    <div 
      className={`bottleneck-card ${bottleneck.severity} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <span className="component-name">{bottleneck.componentName}</span>
        <span className={`severity-badge ${bottleneck.severity}`}>
          {bottleneck.severity}
        </span>
      </div>
      
      <div className="card-content">
        <p className="description">{bottleneck.description}</p>
        <div className="impact-indicator">
          <span>Impact: {(bottleneck.impact * 100).toFixed(1)}%</span>
          <div className="impact-bar">
            <div 
              className="impact-fill" 
              style={{ width: `${bottleneck.impact * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};