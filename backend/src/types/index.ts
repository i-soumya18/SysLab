/**
 * Core data model interfaces for the System Design Simulator Backend
 * These types define the structure of workspaces, components, connections, and simulation configurations
 */

// Export subscription types (SRS FR-1.4)
export * from './subscription';

// Enhanced Component Types implementing SRS FR-3.1
export type ComponentType = 
  | 'load-balancer'  // Load Balancer component per SRS FR-3.1
  | 'database'       // Database component with ACID properties per SRS FR-3.1
  | 'cache'          // Cache component with eviction policies per SRS FR-3.1
  | 'queue'          // Queue component with messaging patterns per SRS FR-3.1 (renamed from message-queue)
  | 'cdn'            // CDN component with geographic distribution per SRS FR-3.1
  | 'service'        // Service component with scaling options per SRS FR-3.1 (renamed from web-server)
  | 'message-queue'  // Legacy support
  | 'web-server'     // Legacy support
  | 'proxy';         // Legacy support

// Enhanced System Component Types (10 specific components per SRS)
export type SystemComponentType = 
  | 'Client'
  | 'LoadBalancer' 
  | 'APIGateway'
  | 'Service'
  | 'Cache'
  | 'Queue'
  | 'Database'
  | 'CDN'
  | 'SearchIndex'
  | 'ObjectStorage';

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
  // Enhanced properties for System Graph Engine
  retryPolicy?: 'exponential-backoff' | 'circuit-breaker' | 'none';
  maxRetries?: number;
  timeoutMs?: number;
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
export type LoadPatternType = 'constant' | 'ramp' | 'spike' | 'realistic' | 'burst' | 'geographic' | 'seasonal';

export interface LoadPattern {
  type: LoadPatternType;
  baseLoad: number; // requests per second
  peakLoad?: number;
  pattern?: number[]; // Custom load curve
}

// Enhanced traffic pattern interfaces
export interface TrafficBurst {
  startTime: number;
  duration: number;
  multiplier: number;
  pattern?: 'spike' | 'plateau' | 'wave';
}

export interface GradualRampUp {
  startTime: number;
  duration: number;
  startMultiplier: number;
  endMultiplier: number;
  curve?: 'linear' | 'exponential' | 'logarithmic';
}

export interface RealisticUserBehavior {
  dailyPattern: number[]; // 24-hour traffic pattern (0-1 multipliers)
  weeklyPattern: number[]; // 7-day traffic pattern (0-1 multipliers)
  seasonalEvents: SeasonalEvent[];
  userSessionDuration: number; // average session duration in seconds
  concurrentSessionRatio: number; // ratio of concurrent to total users
  retryBehavior: RetryBehavior;
}

export interface SeasonalEvent {
  name: string;
  startDate: Date;
  endDate: Date;
  trafficMultiplier: number;
  pattern: 'gradual' | 'sudden' | 'wave';
}

export interface RetryBehavior {
  maxRetries: number;
  backoffMultiplier: number;
  retryProbability: number; // probability user retries after failure
}

export interface GeographicDistribution {
  regions: GeographicRegion[];
  timeZoneOffsets: number[]; // hours offset from UTC
  latencyMatrix: number[][]; // inter-region latency matrix
  loadBalancing: 'round-robin' | 'geographic' | 'latency-based';
}

export interface GeographicRegion {
  id: string;
  name: string;
  userPercentage: number; // percentage of total users in this region
  peakHours: number[]; // peak traffic hours (0-23)
  baseLatency: number; // base latency for this region in ms
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface TrafficPattern {
  id: string;
  name: string;
  type: 'burst' | 'ramp' | 'realistic' | 'geographic' | 'seasonal';
  configuration: TrafficBurst | GradualRampUp | RealisticUserBehavior | GeographicDistribution;
  isActive: boolean;
  priority: number; // higher priority patterns override lower ones
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

// Scenario interface for learning exercises
export interface Scenario {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  initialWorkspace: Partial<Workspace>;
  hints: string[];
  evaluationCriteria: string[];
}

// User progress tracking interface
export interface UserProgress {
  userId: string;
  completedScenarios: string[];
  currentScenario?: string;
  achievements: string[];
  totalScore: number;
}

// Component model interface for simulation engine
export interface ComponentModel {
  id: string;
  type: ComponentType;
  configuration: ComponentConfig;
  processRequest(request: SimulationRequest): Promise<SimulationResponse>;
  getMetrics(): ComponentMetrics;
  handleFailure(failureType: string): void;
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

// API Error response interface
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}