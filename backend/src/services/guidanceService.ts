import { Workspace, Scenario, Component, Connection } from '../types';

export interface GuidanceHint {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
  priority: number; // 1-5, 5 being highest priority
}

export interface EvaluationResult {
  scenarioId: string;
  workspaceId: string;
  score: number; // 0-100
  passed: boolean;
  completedCriteria: string[];
  failedCriteria: string[];
  feedback: string[];
  recommendations: string[];
  hints: GuidanceHint[];
}

export interface BestPracticeViolation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  component?: string;
  connection?: string;
  description: string;
  recommendation: string;
}

/**
 * Guidance Service
 * Provides hints, guidance, and evaluation for learning scenarios
 */
export class GuidanceService {
  /**
   * Generate contextual hints based on current workspace state and scenario
   */
  generateHints(workspace: Workspace, scenario: Scenario): GuidanceHint[] {
    const hints: GuidanceHint[] = [];

    // Check if scenario objectives are being met
    hints.push(...this.checkObjectiveProgress(workspace, scenario));

    // Check for common architectural issues
    hints.push(...this.checkArchitecturalIssues(workspace));

    // Check for performance optimization opportunities
    hints.push(...this.checkPerformanceOptimizations(workspace));

    // Check for best practice violations
    hints.push(...this.checkBestPractices(workspace));

    // Sort hints by priority (highest first)
    return hints.sort((a, b) => b.priority - a.priority);
  }
  /**
   * Evaluate workspace against scenario criteria
   */
  evaluateWorkspace(workspace: Workspace, scenario: Scenario): EvaluationResult {
    const completedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const feedback: string[] = [];
    const recommendations: string[] = [];

    // Evaluate each criterion
    scenario.evaluationCriteria.forEach(criterion => {
      const passed = this.evaluateCriterion(workspace, criterion);
      if (passed) {
        completedCriteria.push(criterion);
        feedback.push(`✅ ${criterion}`);
      } else {
        failedCriteria.push(criterion);
        feedback.push(`❌ ${criterion}`);
        recommendations.push(this.getRecommendationForCriterion(criterion));
      }
    });

    // Calculate score based on completed criteria
    const score = Math.round((completedCriteria.length / scenario.evaluationCriteria.length) * 100);
    const passed = score >= 70; // 70% threshold for passing

    // Generate additional recommendations
    const bestPracticeViolations = this.findBestPracticeViolations(workspace);
    bestPracticeViolations.forEach(violation => {
      if (violation.severity === 'high') {
        recommendations.push(violation.recommendation);
      }
    });

    // Generate contextual hints
    const hints = this.generateHints(workspace, scenario);

    return {
      scenarioId: scenario.id,
      workspaceId: workspace.id,
      score,
      passed,
      completedCriteria,
      failedCriteria,
      feedback,
      recommendations,
      hints
    };
  }

  /**
   * Check progress towards scenario objectives
   */
  private checkObjectiveProgress(workspace: Workspace, scenario: Scenario): GuidanceHint[] {
    const hints: GuidanceHint[] = [];
    const components = workspace.components;

    // Check if basic components are present
    if (components.length === 0) {
      hints.push({
        id: 'no-components',
        type: 'info',
        title: 'Get Started',
        message: 'Add components from the library to begin building your architecture',
        actionable: true,
        suggestedAction: 'Drag components from the palette to the canvas',
        priority: 5
      });
    }

    // Check for specific component types mentioned in objectives
    scenario.objectives.forEach((objective, index) => {
      if (objective.toLowerCase().includes('web server') && !components.some(c => c.type === 'web-server')) {
        hints.push({
          id: `missing-web-server-${index}`,
          type: 'warning',
          title: 'Missing Web Server',
          message: 'This scenario requires a web server component',
          actionable: true,
          suggestedAction: 'Add a web server from the component library',
          priority: 4
        });
      }

      if (objective.toLowerCase().includes('database') && !components.some(c => c.type === 'database')) {
        hints.push({
          id: `missing-database-${index}`,
          type: 'warning',
          title: 'Missing Database',
          message: 'This scenario requires a database component',
          actionable: true,
          suggestedAction: 'Add a database from the component library',
          priority: 4
        });
      }
    });

    return hints;
  }
  /**
   * Check for common architectural issues
   */
  private checkArchitecturalIssues(workspace: Workspace): GuidanceHint[] {
    const hints: GuidanceHint[] = [];
    const components = workspace.components;
    const connections = workspace.connections;

    // Check for isolated components
    const connectedComponentIds = new Set([
      ...connections.map(c => c.sourceComponentId),
      ...connections.map(c => c.targetComponentId)
    ]);

    const isolatedComponents = components.filter(c => !connectedComponentIds.has(c.id));
    if (isolatedComponents.length > 0) {
      hints.push({
        id: 'isolated-components',
        type: 'warning',
        title: 'Isolated Components',
        message: `${isolatedComponents.length} component(s) are not connected to the system`,
        actionable: true,
        suggestedAction: 'Connect isolated components or remove them if not needed',
        priority: 3
      });
    }

    return hints;
  }

  /**
   * Check for performance optimization opportunities
   */
  private checkPerformanceOptimizations(workspace: Workspace): GuidanceHint[] {
    const hints: GuidanceHint[] = [];
    const components = workspace.components;

    // Check if caching is being used
    const hasCache = components.some(c => c.type === 'cache');
    const hasDatabase = components.some(c => c.type === 'database');
    const hasWebServer = components.some(c => c.type === 'web-server');

    if (hasDatabase && hasWebServer && !hasCache && components.length >= 2) {
      hints.push({
        id: 'missing-cache',
        type: 'info',
        title: 'Performance Optimization',
        message: 'Consider adding a cache to improve response times',
        actionable: true,
        suggestedAction: 'Add a cache component between web server and database',
        priority: 2
      });
    }

    return hints;
  }

  /**
   * Check for best practice violations
   */
  private checkBestPractices(workspace: Workspace): GuidanceHint[] {
    const hints: GuidanceHint[] = [];
    const components = workspace.components;

    // Check component configurations
    components.forEach(component => {
      if (component.configuration.capacity <= 0) {
        hints.push({
          id: `invalid-capacity-${component.id}`,
          type: 'error',
          title: 'Invalid Configuration',
          message: `${component.metadata.name} has invalid capacity configuration`,
          actionable: true,
          suggestedAction: 'Set a positive capacity value',
          priority: 5
        });
      }
    });

    return hints;
  }
  /**
   * Evaluate a specific criterion
   */
  private evaluateCriterion(workspace: Workspace, criterion: string): boolean {
    const components = workspace.components;
    const connections = workspace.connections;

    // Simple pattern matching for common criteria
    if (criterion.toLowerCase().includes('web server component present')) {
      return components.some(c => c.type === 'web-server');
    }

    if (criterion.toLowerCase().includes('database component present')) {
      return components.some(c => c.type === 'database');
    }

    if (criterion.toLowerCase().includes('load balancer component present')) {
      return components.some(c => c.type === 'load-balancer');
    }

    if (criterion.toLowerCase().includes('cache component')) {
      return components.some(c => c.type === 'cache');
    }

    if (criterion.toLowerCase().includes('valid connection')) {
      return connections.length > 0;
    }

    if (criterion.toLowerCase().includes('multiple web server instances')) {
      return components.filter(c => c.type === 'web-server').length > 1;
    }

    if (criterion.toLowerCase().includes('appropriate capacity configuration')) {
      return components.every(c => c.configuration.capacity > 0 && c.configuration.capacity <= 10000);
    }

    // Default to true for unrecognized criteria
    return true;
  }

  /**
   * Get recommendation for a failed criterion
   */
  private getRecommendationForCriterion(criterion: string): string {
    if (criterion.toLowerCase().includes('web server component present')) {
      return 'Add a web server component from the component library';
    }

    if (criterion.toLowerCase().includes('database component present')) {
      return 'Add a database component to store application data';
    }

    if (criterion.toLowerCase().includes('load balancer component present')) {
      return 'Add a load balancer to distribute traffic across multiple servers';
    }

    if (criterion.toLowerCase().includes('cache component')) {
      return 'Add a cache component to improve performance';
    }

    if (criterion.toLowerCase().includes('valid connection')) {
      return 'Connect components using wires to establish data flow';
    }

    if (criterion.toLowerCase().includes('multiple web server instances')) {
      return 'Add additional web server instances for scalability';
    }

    if (criterion.toLowerCase().includes('appropriate capacity configuration')) {
      return 'Review and adjust component capacity settings to realistic values';
    }

    return 'Review the scenario requirements and adjust your design accordingly';
  }
  /**
   * Find best practice violations
   */
  private findBestPracticeViolations(workspace: Workspace): BestPracticeViolation[] {
    const violations: BestPracticeViolation[] = [];
    const components = workspace.components;
    const connections = workspace.connections;

    // Check for direct database connections from multiple sources
    const databaseComponents = components.filter(c => c.type === 'database');
    databaseComponents.forEach(db => {
      const incomingConnections = connections.filter(c => c.targetComponentId === db.id);
      if (incomingConnections.length > 3) {
        violations.push({
          type: 'database-connection-pool',
          severity: 'medium',
          component: db.id,
          description: 'Database has too many direct connections',
          recommendation: 'Consider using connection pooling or a database proxy'
        });
      }
    });

    // Check for missing load balancing with multiple servers
    const webServers = components.filter(c => c.type === 'web-server');
    const loadBalancers = components.filter(c => c.type === 'load-balancer');
    
    if (webServers.length > 1 && loadBalancers.length === 0) {
      violations.push({
        type: 'missing-load-balancer',
        severity: 'high',
        description: 'Multiple web servers without load balancing',
        recommendation: 'Add a load balancer to distribute traffic across web servers'
      });
    }

    return violations;
  }
}

// Singleton instance
export const guidanceService = new GuidanceService();