/**
 * Version Service Layer
 * Handles workspace versioning and performance comparison functionality
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import { 
  WorkspaceVersion, 
  PerformanceSnapshot, 
  PerformanceComparison,
  ComponentComparison,
  ComponentPerformanceSummary,
  BottleneckInfo,
  ABTestConfig,
  ABTestResults,
  ABTestVariant,
  ABTestVariantResults,
  Workspace
} from '../types';

export interface CreateVersionRequest {
  workspaceId: string;
  name: string;
  description?: string;
  createdBy: string;
  performanceMetrics?: PerformanceSnapshot;
}

export interface VersionListOptions {
  workspaceId: string;
  limit?: number;
  offset?: number;
  includeMetrics?: boolean;
}

export interface CreateABTestRequest {
  name: string;
  description: string;
  workspaceId: string;
  variants: {
    name: string;
    versionId: string;
    trafficPercentage: number;
  }[];
  duration: number;
  metrics: string[];
}

export class VersionService {
  private db: Pool | null = null;

  constructor(requireDatabase: boolean = true) {
    if (requireDatabase) {
      this.db = getDatabase();
    }
  }

  /**
   * Create a new workspace version
   */
  async createVersion(request: CreateVersionRequest): Promise<WorkspaceVersion> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get current workspace data
      const workspaceResult = await client.query(
        'SELECT * FROM workspaces WHERE id = $1',
        [request.workspaceId]
      );

      if (workspaceResult.rows.length === 0) {
        throw new Error('Workspace not found');
      }

      const workspace = workspaceResult.rows[0];

      // Get components
      const componentsResult = await client.query(
        'SELECT * FROM components WHERE workspace_id = $1',
        [request.workspaceId]
      );

      // Get connections
      const connectionsResult = await client.query(
        'SELECT * FROM connections WHERE workspace_id = $1',
        [request.workspaceId]
      );

      // Get next version number
      const versionCountResult = await client.query(
        'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM workspace_versions WHERE workspace_id = $1',
        [request.workspaceId]
      );

      const versionNumber = versionCountResult.rows[0].next_version;
      const versionId = uuidv4();
      const now = new Date();

      // Create snapshot
      const snapshot = {
        components: componentsResult.rows.map(row => ({
          id: row.id,
          type: row.type,
          position: row.position,
          configuration: row.configuration,
          metadata: row.metadata
        })),
        connections: connectionsResult.rows.map(row => ({
          id: row.id,
          sourceComponentId: row.source_component_id,
          targetComponentId: row.target_component_id,
          sourcePort: row.source_port,
          targetPort: row.target_port,
          configuration: row.configuration
        })),
        configuration: workspace.configuration
      };

      // Insert version
      await client.query(
        `INSERT INTO workspace_versions 
         (id, workspace_id, version_number, name, description, snapshot, performance_metrics, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          versionId,
          request.workspaceId,
          versionNumber,
          request.name,
          request.description || null,
          JSON.stringify(snapshot),
          request.performanceMetrics ? JSON.stringify(request.performanceMetrics) : null,
          now,
          request.createdBy
        ]
      );

      await client.query('COMMIT');

      return {
        id: versionId,
        workspaceId: request.workspaceId,
        versionNumber,
        name: request.name,
        description: request.description,
        snapshot,
        performanceMetrics: request.performanceMetrics,
        createdAt: now,
        createdBy: request.createdBy
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get workspace versions
   */
  async getVersions(options: VersionListOptions): Promise<WorkspaceVersion[]> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      const { workspaceId, limit = 50, offset = 0, includeMetrics = false } = options;

      let query = `
        SELECT id, workspace_id, version_number, name, description, snapshot, created_at, created_by
        ${includeMetrics ? ', performance_metrics' : ''}
        FROM workspace_versions 
        WHERE workspace_id = $1 
        ORDER BY version_number DESC 
        LIMIT $2 OFFSET $3
      `;

      const result = await client.query(query, [workspaceId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        versionNumber: row.version_number,
        name: row.name,
        description: row.description,
        snapshot: row.snapshot,
        performanceMetrics: includeMetrics && row.performance_metrics ? row.performance_metrics : undefined,
        createdAt: row.created_at,
        createdBy: row.created_by
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get specific version by ID
   */
  async getVersionById(versionId: string): Promise<WorkspaceVersion | null> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      const result = await client.query(
        'SELECT * FROM workspace_versions WHERE id = $1',
        [versionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        versionNumber: row.version_number,
        name: row.name,
        description: row.description,
        snapshot: row.snapshot,
        performanceMetrics: row.performance_metrics,
        createdAt: row.created_at,
        createdBy: row.created_by
      };
    } finally {
      client.release();
    }
  }

  /**
   * Compare performance between two versions
   */
  async compareVersions(baselineVersionId: string, comparisonVersionId: string): Promise<PerformanceComparison> {
    const baselineVersion = await this.getVersionById(baselineVersionId);
    const comparisonVersion = await this.getVersionById(comparisonVersionId);

    if (!baselineVersion || !comparisonVersion) {
      throw new Error('One or both versions not found');
    }

    if (!baselineVersion.performanceMetrics || !comparisonVersion.performanceMetrics) {
      throw new Error('Performance metrics not available for comparison');
    }

    const baseline = baselineVersion.performanceMetrics;
    const comparison = comparisonVersion.performanceMetrics;

    // Calculate overall improvements
    const overallImprovement = {
      latencyChange: this.calculatePercentageChange(baseline.averageLatency, comparison.averageLatency, true),
      throughputChange: this.calculatePercentageChange(baseline.throughput, comparison.throughput),
      errorRateChange: this.calculatePercentageChange(baseline.errorRate, comparison.errorRate, true),
      resourceEfficiencyChange: this.calculateResourceEfficiencyChange(baseline, comparison)
    };

    // Compare components
    const componentComparisons = this.compareComponents(baseline.componentMetrics, comparison.componentMetrics);

    // Analyze bottlenecks
    const bottleneckAnalysis = this.analyzeBottleneckChanges(baseline.bottlenecks, comparison.bottlenecks);

    // Generate recommendations
    const recommendations = this.generateRecommendations(overallImprovement, componentComparisons, bottleneckAnalysis);

    // Generate summary
    const summary = this.generateComparisonSummary(overallImprovement, componentComparisons);

    return {
      baselineVersion,
      comparisonVersion,
      overallImprovement,
      componentComparisons,
      bottleneckAnalysis,
      recommendations,
      summary
    };
  }

  /**
   * Create A/B test configuration
   */
  async createABTest(request: CreateABTestRequest): Promise<ABTestConfig> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Validate traffic split adds up to 100%
      const totalTraffic = request.variants.reduce((sum, variant) => sum + variant.trafficPercentage, 0);
      if (Math.abs(totalTraffic - 100) > 0.01) {
        throw new Error('Traffic percentages must add up to 100%');
      }

      // Validate versions exist
      for (const variant of request.variants) {
        const versionExists = await client.query(
          'SELECT id FROM workspace_versions WHERE id = $1',
          [variant.versionId]
        );
        if (versionExists.rows.length === 0) {
          throw new Error(`Version ${variant.versionId} not found`);
        }
      }

      const testId = uuidv4();
      const now = new Date();

      const variants: ABTestVariant[] = request.variants.map(v => ({
        id: uuidv4(),
        name: v.name,
        versionId: v.versionId,
        trafficPercentage: v.trafficPercentage
      }));

      // Insert A/B test
      await client.query(
        `INSERT INTO ab_tests 
         (id, name, description, workspace_id, variants, traffic_split, duration, metrics, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          testId,
          request.name,
          request.description,
          request.workspaceId,
          JSON.stringify(variants),
          JSON.stringify(request.variants.map(v => v.trafficPercentage)),
          request.duration,
          JSON.stringify(request.metrics),
          'draft',
          now
        ]
      );

      await client.query('COMMIT');

      return {
        id: testId,
        name: request.name,
        description: request.description,
        workspaceId: request.workspaceId,
        variants,
        trafficSplit: request.variants.map(v => v.trafficPercentage),
        duration: request.duration,
        metrics: request.metrics,
        status: 'draft',
        createdAt: now
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate percentage change between two values
   */
  private calculatePercentageChange(baseline: number, comparison: number, lowerIsBetter: boolean = false): number {
    if (baseline === 0) return comparison === 0 ? 0 : (lowerIsBetter ? -100 : 100);
    
    const change = ((comparison - baseline) / baseline) * 100;
    return lowerIsBetter ? -change : change;
  }

  /**
   * Calculate resource efficiency change
   */
  private calculateResourceEfficiencyChange(baseline: PerformanceSnapshot, comparison: PerformanceSnapshot): number {
    const baselineEfficiency = baseline.throughput / (baseline.resourceUtilization.avgCpuUsage + baseline.resourceUtilization.avgMemoryUsage);
    const comparisonEfficiency = comparison.throughput / (comparison.resourceUtilization.avgCpuUsage + comparison.resourceUtilization.avgMemoryUsage);
    
    return this.calculatePercentageChange(baselineEfficiency, comparisonEfficiency);
  }

  /**
   * Compare component performance between versions
   */
  private compareComponents(baselineComponents: ComponentPerformanceSummary[], comparisonComponents: ComponentPerformanceSummary[]): ComponentComparison[] {
    const comparisons: ComponentComparison[] = [];
    const comparisonMap = new Map(comparisonComponents.map(c => [c.componentId, c]));

    for (const baseline of baselineComponents) {
      const comparison = comparisonMap.get(baseline.componentId);
      if (!comparison) continue;

      const changes = {
        latencyChange: this.calculatePercentageChange(baseline.averageLatency, comparison.averageLatency, true),
        throughputChange: this.calculatePercentageChange(baseline.throughput, comparison.throughput),
        errorRateChange: this.calculatePercentageChange(baseline.errorRate, comparison.errorRate, true),
        utilizationChange: this.calculatePercentageChange(baseline.utilization, comparison.utilization, true)
      };

      // Determine significance
      let significance: 'improved' | 'degraded' | 'unchanged' = 'unchanged';
      const significantThreshold = 5; // 5% change threshold

      const improvementScore = changes.throughputChange - changes.latencyChange - changes.errorRateChange - changes.utilizationChange;
      if (Math.abs(improvementScore) > significantThreshold) {
        significance = improvementScore > 0 ? 'improved' : 'degraded';
      }

      comparisons.push({
        componentId: baseline.componentId,
        componentType: baseline.componentType,
        baseline,
        comparison,
        changes,
        significance
      });
    }

    return comparisons;
  }

  /**
   * Analyze bottleneck changes between versions
   */
  private analyzeBottleneckChanges(baselineBottlenecks: BottleneckInfo[], comparisonBottlenecks: BottleneckInfo[]) {
    const baselineMap = new Map(baselineBottlenecks.map(b => [`${b.componentId}-${b.type}`, b]));
    const comparisonMap = new Map(comparisonBottlenecks.map(b => [`${b.componentId}-${b.type}`, b]));

    const resolved: BottleneckInfo[] = [];
    const introduced: BottleneckInfo[] = [];
    const persisting: BottleneckInfo[] = [];

    // Find resolved bottlenecks
    for (const [key, bottleneck] of baselineMap) {
      if (!comparisonMap.has(key)) {
        resolved.push(bottleneck);
      } else {
        persisting.push(bottleneck);
      }
    }

    // Find introduced bottlenecks
    for (const [key, bottleneck] of comparisonMap) {
      if (!baselineMap.has(key)) {
        introduced.push(bottleneck);
      }
    }

    return { resolved, introduced, persisting };
  }

  /**
   * Generate recommendations based on comparison results
   */
  private generateRecommendations(
    overallImprovement: any,
    componentComparisons: ComponentComparison[],
    bottleneckAnalysis: any
  ): string[] {
    const recommendations: string[] = [];

    // Overall performance recommendations
    if (overallImprovement.latencyChange < -10) {
      recommendations.push('Significant latency improvement detected. Consider this design for production.');
    } else if (overallImprovement.latencyChange > 10) {
      recommendations.push('Latency has increased significantly. Review component configurations and connection patterns.');
    }

    if (overallImprovement.throughputChange > 20) {
      recommendations.push('Excellent throughput improvement. This design scales better under load.');
    }

    // Component-specific recommendations
    const degradedComponents = componentComparisons.filter(c => c.significance === 'degraded');
    if (degradedComponents.length > 0) {
      recommendations.push(`Review configuration for components: ${degradedComponents.map(c => c.componentId).join(', ')}`);
    }

    // Bottleneck recommendations
    if (bottleneckAnalysis.introduced.length > 0) {
      recommendations.push('New bottlenecks introduced. Consider scaling or optimizing affected components.');
    }

    if (bottleneckAnalysis.resolved.length > 0) {
      recommendations.push('Successfully resolved previous bottlenecks. Good architectural improvements.');
    }

    return recommendations;
  }

  /**
   * Generate comparison summary
   */
  private generateComparisonSummary(overallImprovement: any, componentComparisons: ComponentComparison[]): string {
    const improvedComponents = componentComparisons.filter(c => c.significance === 'improved').length;
    const degradedComponents = componentComparisons.filter(c => c.significance === 'degraded').length;

    let summary = `Performance comparison shows `;

    if (overallImprovement.latencyChange < -5 && overallImprovement.throughputChange > 5) {
      summary += 'significant improvements in both latency and throughput. ';
    } else if (overallImprovement.latencyChange < -5) {
      summary += 'notable latency improvements. ';
    } else if (overallImprovement.throughputChange > 5) {
      summary += 'good throughput gains. ';
    } else {
      summary += 'mixed results with some trade-offs. ';
    }

    summary += `${improvedComponents} components improved, ${degradedComponents} components degraded.`;

    return summary;
  }
}