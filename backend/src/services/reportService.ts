/**
 * Report Service Layer
 * Handles generation of comprehensive performance reports and actionable insights
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import { 
  PerformanceSnapshot, 
  ComponentPerformanceSummary, 
  BottleneckInfo,
  WorkspaceVersion,
  PerformanceComparison
} from '../types';

export interface PerformanceReport {
  id: string;
  workspaceId: string;
  versionId?: string;
  reportType: 'single' | 'comparison' | 'trend';
  title: string;
  summary: string;
  generatedAt: Date;
  sections: ReportSection[];
  recommendations: Recommendation[];
  exportFormats: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'metrics' | 'chart' | 'table' | 'text' | 'bottlenecks';
  content: any;
  insights: string[];
}

export interface Recommendation {
  id: string;
  category: 'performance' | 'scalability' | 'reliability' | 'cost';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actionItems: string[];
}

export interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  confidence: number;
  dataPoints: { timestamp: Date; value: number }[];
}

export interface CreateReportRequest {
  workspaceId: string;
  versionId?: string;
  comparisonVersionId?: string;
  reportType: 'single' | 'comparison' | 'trend';
  title?: string;
  includeRecommendations?: boolean;
  exportFormat?: 'json' | 'pdf' | 'html';
}

export class ReportService {
  private db: Pool | null = null;

  constructor(requireDatabase: boolean = true) {
    if (requireDatabase) {
      this.db = getDatabase();
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(request: CreateReportRequest): Promise<PerformanceReport> {
    const reportId = uuidv4();
    const generatedAt = new Date();

    let report: PerformanceReport;

    switch (request.reportType) {
      case 'single':
        report = await this.generateSingleVersionReport(reportId, request, generatedAt);
        break;
      case 'comparison':
        report = await this.generateComparisonReport(reportId, request, generatedAt);
        break;
      case 'trend':
        report = await this.generateTrendReport(reportId, request, generatedAt);
        break;
      default:
        throw new Error(`Unsupported report type: ${request.reportType}`);
    }

    // Save report to database
    if (this.db) {
      await this.saveReport(report);
    }

    return report;
  }

  /**
   * Generate single version performance report
   */
  private async generateSingleVersionReport(
    reportId: string, 
    request: CreateReportRequest, 
    generatedAt: Date
  ): Promise<PerformanceReport> {
    if (!request.versionId) {
      throw new Error('Version ID is required for single version report');
    }

    // Get version data (this would typically come from the version service)
    const version = await this.getVersionData(request.versionId);
    if (!version || !version.performanceMetrics) {
      throw new Error('Version or performance metrics not found');
    }

    const metrics = version.performanceMetrics;
    const sections: ReportSection[] = [];
    const recommendations: Recommendation[] = [];

    // Executive Summary Section
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      type: 'text',
      content: {
        text: this.generateExecutiveSummary(metrics)
      },
      insights: [
        `System processed ${metrics.totalRequests.toLocaleString()} requests`,
        `Average response time: ${metrics.averageLatency.toFixed(1)}ms`,
        `System reliability: ${((1 - metrics.errorRate) * 100).toFixed(2)}%`
      ]
    });

    // Performance Metrics Section
    sections.push({
      id: 'performance-metrics',
      title: 'Performance Metrics',
      type: 'metrics',
      content: {
        latency: {
          average: metrics.averageLatency,
          p95: metrics.p95Latency,
          p99: metrics.p99Latency
        },
        throughput: metrics.throughput,
        errorRate: metrics.errorRate,
        resourceUtilization: metrics.resourceUtilization
      },
      insights: this.generatePerformanceInsights(metrics)
    });

    // Component Analysis Section
    sections.push({
      id: 'component-analysis',
      title: 'Component Performance Analysis',
      type: 'table',
      content: {
        headers: ['Component', 'Type', 'Avg Latency', 'Throughput', 'Error Rate', 'Utilization'],
        rows: metrics.componentMetrics.map(c => [
          c.componentId.slice(-8),
          c.componentType,
          `${c.averageLatency.toFixed(1)}ms`,
          `${c.throughput.toFixed(0)} req/s`,
          `${(c.errorRate * 100).toFixed(2)}%`,
          `${c.utilization.toFixed(1)}%`
        ])
      },
      insights: this.generateComponentInsights(metrics.componentMetrics)
    });

    // Bottleneck Analysis Section
    if (metrics.bottlenecks.length > 0) {
      sections.push({
        id: 'bottleneck-analysis',
        title: 'Bottleneck Analysis',
        type: 'bottlenecks',
        content: {
          bottlenecks: metrics.bottlenecks
        },
        insights: this.generateBottleneckInsights(metrics.bottlenecks)
      });
    }

    // Generate recommendations
    if (request.includeRecommendations !== false) {
      recommendations.push(...this.generateRecommendations(metrics));
    }

    return {
      id: reportId,
      workspaceId: request.workspaceId,
      versionId: request.versionId,
      reportType: 'single',
      title: request.title || `Performance Report - ${version.name}`,
      summary: this.generateExecutiveSummary(metrics),
      generatedAt,
      sections,
      recommendations,
      exportFormats: ['json', 'html', 'pdf']
    };
  }

  /**
   * Generate comparison report between two versions
   */
  private async generateComparisonReport(
    reportId: string, 
    request: CreateReportRequest, 
    generatedAt: Date
  ): Promise<PerformanceReport> {
    if (!request.versionId || !request.comparisonVersionId) {
      throw new Error('Both version IDs are required for comparison report');
    }

    // This would typically use the version service to get comparison data
    const comparison = await this.getComparisonData(request.versionId, request.comparisonVersionId);
    
    const sections: ReportSection[] = [];
    const recommendations: Recommendation[] = [];

    // Comparison Summary Section
    sections.push({
      id: 'comparison-summary',
      title: 'Comparison Summary',
      type: 'text',
      content: {
        text: comparison.summary
      },
      insights: [
        `Latency change: ${comparison.overallImprovement.latencyChange.toFixed(1)}%`,
        `Throughput change: ${comparison.overallImprovement.throughputChange.toFixed(1)}%`,
        `Error rate change: ${comparison.overallImprovement.errorRateChange.toFixed(1)}%`
      ]
    });

    // Performance Comparison Chart Section
    sections.push({
      id: 'performance-comparison',
      title: 'Performance Comparison',
      type: 'chart',
      content: {
        type: 'bar',
        data: {
          labels: ['Latency', 'Throughput', 'Error Rate', 'Resource Efficiency'],
          datasets: [{
            label: 'Performance Change (%)',
            data: [
              comparison.overallImprovement.latencyChange,
              comparison.overallImprovement.throughputChange,
              comparison.overallImprovement.errorRateChange,
              comparison.overallImprovement.resourceEfficiencyChange
            ]
          }]
        }
      },
      insights: this.generateComparisonInsights(comparison)
    });

    // Component Comparison Section
    sections.push({
      id: 'component-comparison',
      title: 'Component Performance Changes',
      type: 'table',
      content: {
        headers: ['Component', 'Type', 'Latency Change', 'Throughput Change', 'Status'],
        rows: comparison.componentComparisons.map(c => [
          c.componentId.slice(-8),
          c.componentType,
          `${c.changes.latencyChange.toFixed(1)}%`,
          `${c.changes.throughputChange.toFixed(1)}%`,
          c.significance
        ])
      },
      insights: this.generateComponentComparisonInsights(comparison.componentComparisons)
    });

    // Add recommendations from comparison
    recommendations.push(...comparison.recommendations.map(rec => ({
      id: uuidv4(),
      category: 'performance' as const,
      priority: 'medium' as const,
      title: 'Comparison Recommendation',
      description: rec,
      impact: 'Moderate performance improvement expected',
      effort: 'medium' as const,
      actionItems: [rec]
    })));

    return {
      id: reportId,
      workspaceId: request.workspaceId,
      versionId: request.versionId,
      reportType: 'comparison',
      title: request.title || 'Performance Comparison Report',
      summary: comparison.summary,
      generatedAt,
      sections,
      recommendations,
      exportFormats: ['json', 'html', 'pdf']
    };
  }

  /**
   * Generate trend analysis report
   */
  private async generateTrendReport(
    reportId: string, 
    request: CreateReportRequest, 
    generatedAt: Date
  ): Promise<PerformanceReport> {
    // Get historical performance data
    const trendData = await this.getTrendData(request.workspaceId);
    
    const sections: ReportSection[] = [];
    const recommendations: Recommendation[] = [];

    // Trend Analysis Section
    sections.push({
      id: 'trend-analysis',
      title: 'Performance Trends',
      type: 'chart',
      content: {
        type: 'line',
        data: {
          labels: trendData.map(d => d.timestamp.toISOString().split('T')[0]),
          datasets: [
            {
              label: 'Average Latency (ms)',
              data: trendData.map(d => d.averageLatency)
            },
            {
              label: 'Throughput (req/s)',
              data: trendData.map(d => d.throughput)
            }
          ]
        }
      },
      insights: this.generateTrendInsights(trendData)
    });

    return {
      id: reportId,
      workspaceId: request.workspaceId,
      reportType: 'trend',
      title: request.title || 'Performance Trend Analysis',
      summary: 'Analysis of performance trends over time',
      generatedAt,
      sections,
      recommendations,
      exportFormats: ['json', 'html', 'pdf']
    };
  }

  /**
   * Export report in specified format
   */
  async exportReport(reportId: string, format: 'json' | 'html' | 'pdf'): Promise<Buffer | string> {
    const report = await this.getReportById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateHTMLReport(report);
      case 'pdf':
        return this.generatePDFReport(report);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(report: PerformanceReport): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #007bff; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 5px; }
        .recommendation { margin-bottom: 15px; padding: 10px; background: white; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>
        <p><strong>Summary:</strong> ${report.summary}</p>
    </div>
    
    ${report.sections.map(section => this.renderHTMLSection(section)).join('')}
    
    ${report.recommendations.length > 0 ? `
    <div class="section">
        <h2>Recommendations</h2>
        <div class="recommendations">
            ${report.recommendations.map(rec => `
                <div class="recommendation">
                    <h3>${rec.title} <span style="color: ${this.getPriorityColor(rec.priority)}">[${rec.priority.toUpperCase()}]</span></h3>
                    <p>${rec.description}</p>
                    <p><strong>Impact:</strong> ${rec.impact}</p>
                    <p><strong>Effort:</strong> ${rec.effort}</p>
                    <ul>
                        ${rec.actionItems.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
</body>
</html>`;
    
    return html;
  }

  /**
   * Generate PDF report (placeholder - would use a PDF library like puppeteer)
   */
  private async generatePDFReport(report: PerformanceReport): Promise<Buffer> {
    // This would typically use a library like puppeteer to convert HTML to PDF
    const html = this.generateHTMLReport(report);
    // For now, return the HTML as buffer
    return Buffer.from(html, 'utf-8');
  }

  /**
   * Render HTML section based on type
   */
  private renderHTMLSection(section: ReportSection): string {
    switch (section.type) {
      case 'text':
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <p>${section.content.text}</p>
            ${section.insights.length > 0 ? `
              <ul>
                ${section.insights.map(insight => `<li>${insight}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `;
      
      case 'metrics':
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <div class="metrics-grid">
              <div class="metric-card">
                <h4>Average Latency</h4>
                <p>${section.content.latency.average.toFixed(1)}ms</p>
              </div>
              <div class="metric-card">
                <h4>Throughput</h4>
                <p>${section.content.throughput.toFixed(0)} req/s</p>
              </div>
              <div class="metric-card">
                <h4>Error Rate</h4>
                <p>${(section.content.errorRate * 100).toFixed(2)}%</p>
              </div>
            </div>
          </div>
        `;
      
      case 'table':
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <table>
              <thead>
                <tr>
                  ${section.content.headers.map((header: string) => `<th>${header}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${section.content.rows.map((row: string[]) => `
                  <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      
      default:
        return `<div class="section"><h2>${section.title}</h2><p>Content type not supported in HTML export</p></div>`;
    }
  }

  // Helper methods for generating insights and recommendations
  private generateExecutiveSummary(metrics: PerformanceSnapshot): string {
    const reliability = ((1 - metrics.errorRate) * 100).toFixed(1);
    const performance = metrics.averageLatency < 100 ? 'excellent' : 
                       metrics.averageLatency < 500 ? 'good' : 'needs improvement';
    
    return `System performance analysis shows ${performance} response times with ${reliability}% reliability. ` +
           `The system processed ${metrics.totalRequests.toLocaleString()} requests with an average latency of ${metrics.averageLatency.toFixed(1)}ms.`;
  }

  private generatePerformanceInsights(metrics: PerformanceSnapshot): string[] {
    const insights: string[] = [];
    
    if (metrics.averageLatency > 500) {
      insights.push('High average latency detected - consider optimizing slow components');
    }
    
    if (metrics.errorRate > 0.01) {
      insights.push('Error rate above 1% - investigate failing components');
    }
    
    if (metrics.resourceUtilization.avgCpuUsage > 80) {
      insights.push('High CPU utilization - consider scaling or optimization');
    }
    
    return insights;
  }

  private generateComponentInsights(components: ComponentPerformanceSummary[]): string[] {
    const insights: string[] = [];
    const slowComponents = components.filter(c => c.averageLatency > 200);
    const highErrorComponents = components.filter(c => c.errorRate > 0.05);
    
    if (slowComponents.length > 0) {
      insights.push(`${slowComponents.length} components have high latency (>200ms)`);
    }
    
    if (highErrorComponents.length > 0) {
      insights.push(`${highErrorComponents.length} components have high error rates (>5%)`);
    }
    
    return insights;
  }

  private generateBottleneckInsights(bottlenecks: BottleneckInfo[]): string[] {
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
    const highBottlenecks = bottlenecks.filter(b => b.severity === 'high').length;
    
    return [
      `${criticalBottlenecks} critical bottlenecks requiring immediate attention`,
      `${highBottlenecks} high-priority bottlenecks affecting performance`,
      'Focus on resolving critical bottlenecks first for maximum impact'
    ];
  }

  private generateRecommendations(metrics: PerformanceSnapshot): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // High latency recommendation
    if (metrics.averageLatency > 500) {
      recommendations.push({
        id: uuidv4(),
        category: 'performance',
        priority: 'high',
        title: 'Optimize High Latency Components',
        description: 'System latency is above acceptable thresholds',
        impact: 'Significant improvement in user experience and system responsiveness',
        effort: 'medium',
        actionItems: [
          'Identify and optimize slowest components',
          'Consider caching strategies',
          'Review database query performance',
          'Implement connection pooling'
        ]
      });
    }
    
    // High error rate recommendation
    if (metrics.errorRate > 0.01) {
      recommendations.push({
        id: uuidv4(),
        category: 'reliability',
        priority: 'critical',
        title: 'Reduce System Error Rate',
        description: 'Error rate is above 1%, indicating reliability issues',
        impact: 'Improved system reliability and user satisfaction',
        effort: 'high',
        actionItems: [
          'Investigate root causes of errors',
          'Implement better error handling',
          'Add circuit breakers for external dependencies',
          'Improve monitoring and alerting'
        ]
      });
    }
    
    return recommendations;
  }

  private generateComparisonInsights(comparison: PerformanceComparison): string[] {
    const insights: string[] = [];
    const { overallImprovement } = comparison;
    
    if (overallImprovement.latencyChange < -10) {
      insights.push('Significant latency improvement achieved');
    } else if (overallImprovement.latencyChange > 10) {
      insights.push('Latency has increased - review recent changes');
    }
    
    if (overallImprovement.throughputChange > 20) {
      insights.push('Excellent throughput improvement');
    }
    
    return insights;
  }

  private generateComponentComparisonInsights(comparisons: any[]): string[] {
    const improved = comparisons.filter(c => c.significance === 'improved').length;
    const degraded = comparisons.filter(c => c.significance === 'degraded').length;
    
    return [
      `${improved} components showed performance improvements`,
      `${degraded} components showed performance degradation`,
      'Focus on optimizing degraded components'
    ];
  }

  private generateTrendInsights(trendData: any[]): string[] {
    return [
      'Performance trends analysis over time',
      'Monitor for consistent patterns',
      'Plan capacity based on growth trends'
    ];
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  /**
   * Get report by ID (public method)
   */
  async getReportById(reportId: string): Promise<PerformanceReport | null> {
    if (!this.db) return null;
    
    const client = await this.db.connect();
    try {
      const result = await client.query(
        'SELECT * FROM performance_reports WHERE id = $1',
        [reportId]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      const content = row.content;
      
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        versionId: row.version_id,
        reportType: row.report_type,
        title: row.title,
        summary: row.summary,
        generatedAt: row.generated_at,
        sections: content.sections || [],
        recommendations: content.recommendations || [],
        exportFormats: ['json', 'html', 'pdf']
      };
    } finally {
      client.release();
    }
  }

  // Database operations (placeholder implementations)
  private async saveReport(report: PerformanceReport): Promise<void> {
    if (!this.db) return;
    
    const client = await this.db.connect();
    try {
      await client.query(
        `INSERT INTO performance_reports (id, workspace_id, version_id, report_type, title, summary, content, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          report.id,
          report.workspaceId,
          report.versionId,
          report.reportType,
          report.title,
          report.summary,
          JSON.stringify({ sections: report.sections, recommendations: report.recommendations }),
          report.generatedAt
        ]
      );
    } finally {
      client.release();
    }
  }

  // Placeholder methods for data retrieval
  private async getVersionData(versionId: string): Promise<WorkspaceVersion | null> {
    // This would typically call the version service
    return null;
  }

  private async getComparisonData(versionId: string, comparisonVersionId: string): Promise<PerformanceComparison> {
    // This would typically call the version service
    throw new Error('Not implemented');
  }

  private async getTrendData(workspaceId: string): Promise<any[]> {
    // This would retrieve historical performance data
    return [];
  }
}