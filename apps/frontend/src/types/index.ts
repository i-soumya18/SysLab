/**
 * Core data model interfaces for the System Design Simulator
 * These types define the structure of workspaces, components, connections, and simulation configurations
 */

// Component Types
export type ComponentType = 
  | 'client'
  | 'database' 
  | 'load-balancer' 
  | 'web-server' 
  | 'cache' 
  | 'message-queue' 
  | 'cdn' 
  | 'proxy'
  | 'api-gateway'
  | 'search-engine'
  | 'object-storage'
  | 'service-mesh'
  | 'rate-limiter'
  | 'circuit-breaker'
  | 'auth-service'
  | 'monitoring'
  | 'logging';

// Position interface for canvas positioning
export interface Position {
  x: number;
  y: number;
}

// Component configuration interface - extensible for different component types
export interface ComponentConfig {
  // Common properties for all components
  capacity: number;
  latency: number;
  failureRate: number;
  
  // Type-specific properties stored as key-value pairs
  [key: string]: any;
}

// Component metadata interface
export interface ComponentMetadata {
  name: string;
  description?: string;
  version: string;
}

// Main Component interface
export interface Component {
  id: string;
  type: ComponentType;
  position: Position;
  configuration: ComponentConfig;
  metadata: ComponentMetadata;
}

// Connection configuration interface
export interface ConnectionConfig {
  bandwidth: number;
  latency: number;
  protocol: 'HTTP' | 'TCP' | 'UDP' | 'DATABASE';
  reliability: number;
}

// Connection interface for wiring components
export interface Connection {
  id: string;
  sourceComponentId: string;
  targetComponentId: string;
  sourcePort: string;
  targetPort: string;
  configuration: ConnectionConfig;
}

// Load pattern types and interfaces
export type LoadPatternType = 'constant' | 'ramp' | 'spike' | 'realistic';

export interface LoadPattern {
  type: LoadPatternType;
  baseLoad: number; // requests per second
  peakLoad?: number;
  pattern?: number[]; // Custom load curve
}

// Failure scenario interface
export interface FailureScenario {
  componentId: string;
  failureType: string;
  startTime: number;
  duration: number;
  severity: number;
}

// Metrics configuration interface
export interface MetricsConfig {
  collectionInterval: number; // milliseconds
  retentionPeriod: number; // seconds
  enabledMetrics: string[];
}

// Simulation configuration interface
export interface SimulationConfig {
  duration: number; // seconds
  loadPattern: LoadPattern;
  failureScenarios: FailureScenario[];
  metricsCollection: MetricsConfig;
}

// Main Workspace interface
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  userId: string;
  components: Component[];
  connections: Connection[];
  configuration: SimulationConfig;
  createdAt: Date;
  updatedAt: Date;
}

// Simulation request and response interfaces
export interface SimulationRequest {
  id: string;
  timestamp: number;
  sourceComponentId: string;
  targetComponentId: string;
  payload: any;
}

export interface SimulationResponse {
  requestId: string;
  timestamp: number;
  success: boolean;
  latency: number;
  payload?: any;
  error?: string;
}

// Component metrics interface
export interface ComponentMetrics {
  componentId: string;
  timestamp: number;
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  cpuUtilization: number;
  memoryUtilization: number;
  queueDepth: number;
}

// Scenario interface for learning exercises implementing SRS FR-9.1
export interface Scenario {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  initialWorkspace: Partial<Workspace>;
  hints: string[];
  evaluationCriteria: string[];
  // Enhanced properties for SRS FR-9.1
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  prerequisites: string[]; // IDs of scenarios that should be completed first
  category: string;
  estimatedTimeMinutes: number;
  tags: string[];
  learningOutcomes: string[];
}

// User progress tracking interface
export interface UserProgress {
  userId: string;
  completedScenarios: string[];
  currentScenario?: string;
  achievements: string[];
  totalScore: number;
}

// Aggregated metrics interface
export interface AggregatedMetrics {
  componentId: string;
  timeWindow: number;
  startTime: number;
  endTime: number;
  requestsPerSecond: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  latency: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: {
    min: number;
    max: number;
    avg: number;
  };
  resourceUtilization: {
    cpu: {
      min: number;
      max: number;
      avg: number;
    };
    memory: {
      min: number;
      max: number;
      avg: number;
    };
  };
  queueDepth: {
    min: number;
    max: number;
    avg: number;
  };
  totalRequests: number;
  totalErrors: number;
}

// Workspace version interface for design iteration comparison
export interface WorkspaceVersion {
  id: string;
  workspaceId: string;
  versionNumber: number;
  name: string;
  description?: string;
  snapshot: {
    components: Component[];
    connections: Connection[];
    configuration: SimulationConfig;
  };
  performanceMetrics?: PerformanceSnapshot;
  createdAt: Date;
  createdBy: string;
}

// Performance snapshot for version comparison
export interface PerformanceSnapshot {
  simulationId: string;
  duration: number;
  totalRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  bottlenecks: BottleneckInfo[];
  resourceUtilization: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;
  };
  componentMetrics: ComponentPerformanceSummary[];
}

// Component performance summary for comparison
export interface ComponentPerformanceSummary {
  componentId: string;
  componentType: ComponentType;
  averageLatency: number;
  throughput: number;
  errorRate: number;
  utilization: number;
  queueDepth: number;
}

// Bottleneck information
export interface BottleneckInfo {
  componentId: string;
  componentType: ComponentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'latency' | 'throughput' | 'resource' | 'queue';
  description: string;
  impact: number; // 0-100 percentage impact on overall performance
  recommendations: string[];
}

// Performance comparison result
export interface PerformanceComparison {
  baselineVersion: WorkspaceVersion;
  comparisonVersion: WorkspaceVersion;
  overallImprovement: {
    latencyChange: number; // percentage change
    throughputChange: number;
    errorRateChange: number;
    resourceEfficiencyChange: number;
  };
  componentComparisons: ComponentComparison[];
  bottleneckAnalysis: {
    resolved: BottleneckInfo[];
    introduced: BottleneckInfo[];
    persisting: BottleneckInfo[];
  };
  recommendations: string[];
  summary: string;
}

// Component-level comparison
export interface ComponentComparison {
  componentId: string;
  componentType: ComponentType;
  baseline: ComponentPerformanceSummary;
  comparison: ComponentPerformanceSummary;
  changes: {
    latencyChange: number;
    throughputChange: number;
    errorRateChange: number;
    utilizationChange: number;
  };
  significance: 'improved' | 'degraded' | 'unchanged';
}

// A/B testing configuration
export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
  variants: ABTestVariant[];
  trafficSplit: number[]; // percentage allocation for each variant
  duration: number; // test duration in seconds
  metrics: string[]; // metrics to track
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// A/B test variant
export interface ABTestVariant {
  id: string;
  name: string;
  versionId: string;
  trafficPercentage: number;
}

// A/B test results
export interface ABTestResults {
  testId: string;
  variants: ABTestVariantResults[];
  winner?: string; // variant ID
  confidence: number; // statistical confidence level
  summary: string;
  recommendations: string[];
}

// A/B test variant results
export interface ABTestVariantResults {
  variantId: string;
  name: string;
  metrics: {
    [metricName: string]: {
      value: number;
      confidence: number;
      sampleSize: number;
    };
  };
  performanceSnapshot: PerformanceSnapshot;
}

// System metrics interface
export interface SystemMetrics {
  timestamp: number;
  totalThroughput: number;
  averageLatency: number;
  systemErrorRate: number;
  activeComponents: number;
  healthyComponents: number;
  totalQueueDepth: number;
  componentMetrics: Map<string, AggregatedMetrics>;
}

// Progressive Constraint System interfaces implementing SRS FR-9.2
export interface ConstraintEvent {
  id: string;
  type: 'load-increase' | 'failure-injection' | 'latency-spike' | 'resource-limit' | 'network-partition';
  triggerTime: number; // seconds from scenario start
  duration: number; // seconds
  severity: number; // 0.0 to 1.0
  description: string;
  learningObjective: string;
  adaptiveParameters?: AdaptiveParameters;
}

export interface AdaptiveParameters {
  userPerformanceThreshold: number; // 0.0 to 1.0
  difficultyAdjustment: number; // -0.5 to +0.5
  skipIfPoorPerformance: boolean;
  prerequisiteEvents: string[]; // IDs of events that must complete first
}

export interface ConstraintSequence {
  scenarioId: string;
  events: ConstraintEvent[];
  adaptiveDifficulty: boolean;
  baselineMetrics: {
    expectedLatency: number;
    expectedThroughput: number;
    expectedErrorRate: number;
  };
}

export interface UserPerformanceMetrics {
  userId: string;
  scenarioId: string;
  currentLatency: number;
  currentThroughput: number;
  currentErrorRate: number;
  timeToResolveIssues: number;
  correctDecisionsMade: number;
  totalDecisionOpportunities: number;
  timestamp: number;
}

// Hint and Explanation System interfaces implementing SRS FR-9.3
export interface Hint {
  id: string;
  scenarioId: string;
  type: 'contextual' | 'progressive' | 'remedial' | 'advanced';
  trigger: HintTrigger;
  content: string;
  explanation?: string;
  relatedConcepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  priority: number; // 1-10, higher is more important
  prerequisites?: string[]; // Other hint IDs that should be shown first
  followUpHints?: string[]; // Hints to show after this one
}

export interface HintTrigger {
  type: 'time-based' | 'performance-based' | 'action-based' | 'error-based' | 'request-based';
  condition: HintCondition;
}

export interface HintCondition {
  // Time-based triggers
  timeThreshold?: number; // seconds
  
  // Performance-based triggers
  latencyThreshold?: number; // ms
  errorRateThreshold?: number; // 0.0 to 1.0
  throughputThreshold?: number; // requests per second
  
  // Action-based triggers
  requiredAction?: string; // e.g., 'add-component', 'connect-components'
  componentType?: string;
  
  // Error-based triggers
  errorType?: string;
  errorCount?: number;
  
  // Context
  userStuckDuration?: number; // seconds without progress
  attemptCount?: number; // number of failed attempts
}

export interface ExplanationContent {
  id: string;
  title: string;
  concept: string;
  level: 'basic' | 'intermediate' | 'advanced' | 'expert';
  content: {
    summary: string;
    detailedExplanation: string;
    examples: string[];
    commonMistakes: string[];
    bestPractices: string[];
    relatedTopics: string[];
  };
  visualAids?: {
    diagrams: string[];
    animations: string[];
    interactiveElements: string[];
  };
}

export interface HintContext {
  userId: string;
  scenarioId: string;
  currentTime: number;
  userPerformance: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  recentActions: string[];
  componentsAdded: string[];
  connectionsCreated: number;
  errorsEncountered: string[];
  timeStuckOnCurrentStep: number;
}

// Performance report interface
export interface PerformanceReport {
  id: string;
  workspaceId: string;
  versionId: string;
  title: string;
  reportType: 'baseline' | 'comparison' | 'optimization' | 'regression';
  summary: string;
  timestamp: Date;
  generatedAt: Date;
  metrics: PerformanceSnapshot;
  sections: ReportSection[];
  analysis: string;
  recommendations: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  charts?: any[];
  tables?: any[];
}