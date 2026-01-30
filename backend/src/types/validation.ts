/**
 * Zod validation schemas for System Design Simulator Backend
 * These schemas provide runtime validation and type safety
 */

import { z } from 'zod';

// Component type validation
export const ComponentTypeSchema = z.enum([
  'database',
  'load-balancer', 
  'web-server',
  'cache',
  'message-queue',
  'cdn',
  'proxy'
]);

// Position validation
export const PositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0)
});

// Component configuration validation
export const ComponentConfigSchema = z.object({
  capacity: z.number().positive(),
  latency: z.number().min(0),
  failureRate: z.number().min(0).max(1)
}).catchall(z.any()); // Allow additional type-specific properties

// Component metadata validation
export const ComponentMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().min(1)
});

// Component validation
export const ComponentSchema = z.object({
  id: z.string().uuid(),
  type: ComponentTypeSchema,
  position: PositionSchema,
  configuration: ComponentConfigSchema,
  metadata: ComponentMetadataSchema
});

// Connection configuration validation
export const ConnectionConfigSchema = z.object({
  bandwidth: z.number().positive(),
  latency: z.number().min(0),
  protocol: z.enum(['HTTP', 'TCP', 'UDP', 'DATABASE']),
  reliability: z.number().min(0).max(1)
});

// Connection validation
export const ConnectionSchema = z.object({
  id: z.string().uuid(),
  sourceComponentId: z.string().uuid(),
  targetComponentId: z.string().uuid(),
  sourcePort: z.string().min(1),
  targetPort: z.string().min(1),
  configuration: ConnectionConfigSchema
});

// Load pattern validation
export const LoadPatternTypeSchema = z.enum(['constant', 'ramp', 'spike', 'realistic']);

export const LoadPatternSchema = z.object({
  type: LoadPatternTypeSchema,
  baseLoad: z.number().positive(),
  peakLoad: z.number().positive().optional(),
  pattern: z.array(z.number().min(0)).optional()
});

// Failure scenario validation
export const FailureScenarioSchema = z.object({
  componentId: z.string().uuid(),
  failureType: z.string().min(1),
  startTime: z.number().min(0),
  duration: z.number().positive(),
  severity: z.number().min(0).max(1)
});

// Metrics configuration validation
export const MetricsConfigSchema = z.object({
  collectionInterval: z.number().positive(),
  retentionPeriod: z.number().positive(),
  enabledMetrics: z.array(z.string())
});

// Simulation configuration validation
export const SimulationConfigSchema = z.object({
  duration: z.number().positive(),
  loadPattern: LoadPatternSchema,
  failureScenarios: z.array(FailureScenarioSchema),
  metricsCollection: MetricsConfigSchema
});

// Workspace validation
export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().uuid(),
  components: z.array(ComponentSchema),
  connections: z.array(ConnectionSchema),
  configuration: SimulationConfigSchema,
  createdAt: z.date(),
  updatedAt: z.date()
});

// Simulation request validation
export const SimulationRequestSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().positive(),
  sourceComponentId: z.string().uuid(),
  targetComponentId: z.string().uuid(),
  payload: z.any()
});

// Simulation response validation
export const SimulationResponseSchema = z.object({
  requestId: z.string().uuid(),
  timestamp: z.number().positive(),
  success: z.boolean(),
  latency: z.number().min(0),
  payload: z.any().optional(),
  error: z.string().optional()
});

// Component metrics validation
export const ComponentMetricsSchema = z.object({
  componentId: z.string().uuid(),
  timestamp: z.number().positive(),
  requestsPerSecond: z.number().min(0),
  averageLatency: z.number().min(0),
  errorRate: z.number().min(0).max(1),
  cpuUtilization: z.number().min(0).max(1),
  memoryUtilization: z.number().min(0).max(1),
  queueDepth: z.number().min(0)
});

// Scenario validation
export const ScenarioSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  objectives: z.array(z.string()),
  initialWorkspace: WorkspaceSchema.partial(),
  hints: z.array(z.string()),
  evaluationCriteria: z.array(z.string())
});

// User progress validation
export const UserProgressSchema = z.object({
  userId: z.string().uuid(),
  completedScenarios: z.array(z.string().uuid()),
  currentScenario: z.string().uuid().optional(),
  achievements: z.array(z.string()),
  totalScore: z.number().min(0)
});

// API Error response validation
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    timestamp: z.string(),
    requestId: z.string()
  })
});

// Export inferred types for use in TypeScript
export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type ComponentConfig = z.infer<typeof ComponentConfigSchema>;
export type ComponentMetadata = z.infer<typeof ComponentMetadataSchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type LoadPatternType = z.infer<typeof LoadPatternTypeSchema>;
export type LoadPattern = z.infer<typeof LoadPatternSchema>;
export type FailureScenario = z.infer<typeof FailureScenarioSchema>;
export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;
export type SimulationResponse = z.infer<typeof SimulationResponseSchema>;
export type ComponentMetrics = z.infer<typeof ComponentMetricsSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type UserProgress = z.infer<typeof UserProgressSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;