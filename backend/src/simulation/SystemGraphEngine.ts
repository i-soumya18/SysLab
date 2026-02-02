/**
 * System Graph Engine (SGE) - Core Backend Engine
 * 
 * Models system components as a directed acyclic graph (DAG) with realistic performance characteristics.
 * Implements Requirements 6.1, 6.2, 6.4 from the SRS.
 * 
 * Key Features:
 * - DAG representation with capacity limits, latency curves, and throughput limits per component
 * - Component modeling for 10 specific component types
 * - End-to-end latency calculation by graph traversal
 * - Circular dependency detection and prevention
 * - Realistic degradation modeling when capacity is exceeded (Requirement 6.3)
 * - Dynamic reconfiguration during simulation without restart (Requirement 6.5)
 */

import { EventEmitter } from 'events';
import { Component, Connection, ComponentType } from '../types';
import { DegradationEngine, ComponentConfiguration, ReconfigurationRequest } from './DegradationEngine';

// Enhanced component types for the 10 specific components per SRS
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

// Performance characteristics for each component type
export interface ComponentPerformanceCharacteristics {
  baseLatency: number; // milliseconds
  maxThroughput: number; // requests per second
  capacityLimit: number; // concurrent requests
  latencyCurve: LatencyCurve;
  throughputCurve: ThroughputCurve;
  degradationModel: DegradationModel;
}

// Latency curve modeling - how latency changes with load
export interface LatencyCurve {
  type: 'linear' | 'exponential' | 'logarithmic';
  coefficients: number[]; // curve parameters
  maxLatency: number; // maximum latency under extreme load
}

// Throughput curve modeling - how throughput changes with load
export interface ThroughputCurve {
  type: 'linear' | 'plateau' | 'degrading';
  coefficients: number[]; // curve parameters
  maxThroughput: number; // theoretical maximum throughput
}

// Degradation model for when capacity is exceeded
export interface DegradationModel {
  type: 'graceful' | 'cliff' | 'cascading';
  thresholds: DegradationThreshold[];
}

export interface DegradationThreshold {
  utilizationPercent: number; // 0-100
  latencyMultiplier: number; // multiplier for base latency
  throughputMultiplier: number; // multiplier for throughput
  errorRateIncrease: number; // additional error rate (0-1)
}

// Graph node representing a system component
export interface SystemGraphNode {
  id: string;
  type: SystemComponentType;
  component: Component;
  characteristics: ComponentPerformanceCharacteristics;
  currentLoad: number;
  currentUtilization: number; // 0-1
  incomingEdges: SystemGraphEdge[];
  outgoingEdges: SystemGraphEdge[];
  isHealthy: boolean;
  lastUpdated: number;
}

// Graph edge representing a connection between components
export interface SystemGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  connection: Connection;
  latency: number; // connection latency in milliseconds
  bandwidth: number; // Mbps
  reliability: number; // 0-1
  currentLoad: number; // current traffic through this edge
}

// Path through the system graph
export interface SystemPath {
  nodes: SystemGraphNode[];
  edges: SystemGraphEdge[];
  totalLatency: number;
  bottleneckNode?: SystemGraphNode;
  reliability: number; // overall path reliability
}

// End-to-end latency calculation result
export interface LatencyCalculationResult {
  totalLatency: number;
  componentLatencies: Map<string, number>;
  connectionLatencies: Map<string, number>;
  criticalPath: SystemPath;
  alternativePaths: SystemPath[];
}

// Graph validation result
export interface GraphValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: string[][];
  unreachableNodes: string[];
}

/**
 * System Graph Engine - Core implementation
 */
export class SystemGraphEngine extends EventEmitter {
  private nodes: Map<string, SystemGraphNode> = new Map();
  private edges: Map<string, SystemGraphEdge> = new Map();
  private componentCharacteristics: Map<SystemComponentType, ComponentPerformanceCharacteristics>;
  private lastValidation: GraphValidationResult | null = null;
  private degradationEngine: DegradationEngine;

  constructor() {
    super();
    this.componentCharacteristics = this.initializeComponentCharacteristics();
    this.degradationEngine = new DegradationEngine();
    
    // Connect degradation engine events
    this.degradationEngine.on('degradation_changed', (event) => {
      this.emit('node_degradation_changed', event);
    });
    
    this.degradationEngine.on('cascading_failure_triggered', (event) => {
      this.emit('cascading_failure', event);
    });
    
    this.degradationEngine.on('reconfiguration_applied', (event) => {
      this.emit('dynamic_reconfiguration_applied', event);
    });
  }

  /**
   * Initialize the graph with components and connections
   */
  initialize(components: Component[], connections: Connection[]): GraphValidationResult {
    this.clear();
    
    // Add all components as nodes
    for (const component of components) {
      this.addNode(component);
    }

    // Add all connections as edges
    for (const connection of connections) {
      this.addEdge(connection);
    }

    // Validate the graph
    const validation = this.validateGraph();
    this.lastValidation = validation;

    if (validation.isValid) {
      // Initialize degradation engine for all nodes
      for (const node of this.nodes.values()) {
        this.degradationEngine.initializeComponent(node);
      }
      
      // Start degradation engine
      this.degradationEngine.start();
      
      this.emit('graph_initialized', {
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
        validation
      });
    } else {
      this.emit('graph_validation_failed', validation);
    }

    return validation;
  }

  /**
   * Add a component as a graph node
   */
  addNode(component: Component): SystemGraphNode {
    const systemType = this.mapComponentTypeToSystemType(component.type);
    const characteristics = this.getComponentCharacteristics(systemType);
    
    const node: SystemGraphNode = {
      id: component.id,
      type: systemType,
      component,
      characteristics,
      currentLoad: 0,
      currentUtilization: 0,
      incomingEdges: [],
      outgoingEdges: [],
      isHealthy: true,
      lastUpdated: Date.now()
    };

    this.nodes.set(component.id, node);
    
    this.emit('node_added', { nodeId: component.id, type: systemType });
    
    return node;
  }

  /**
   * Add a connection as a graph edge
   */
  addEdge(connection: Connection): SystemGraphEdge {
    const sourceNode = this.nodes.get(connection.sourceComponentId);
    const targetNode = this.nodes.get(connection.targetComponentId);

    if (!sourceNode || !targetNode) {
      throw new Error(`Cannot create edge: source or target node not found`);
    }

    const edge: SystemGraphEdge = {
      id: connection.id,
      sourceNodeId: connection.sourceComponentId,
      targetNodeId: connection.targetComponentId,
      connection,
      latency: connection.configuration.latency,
      bandwidth: connection.configuration.bandwidth,
      reliability: connection.configuration.reliability,
      currentLoad: 0
    };

    this.edges.set(connection.id, edge);
    sourceNode.outgoingEdges.push(edge);
    targetNode.incomingEdges.push(edge);

    this.emit('edge_added', { 
      edgeId: connection.id, 
      source: connection.sourceComponentId, 
      target: connection.targetComponentId 
    });

    return edge;
  }

  /**
   * Remove a node and all connected edges
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove all connected edges
    const edgesToRemove = [...node.incomingEdges, ...node.outgoingEdges];
    for (const edge of edgesToRemove) {
      this.removeEdge(edge.id);
    }

    this.nodes.delete(nodeId);
    this.emit('node_removed', { nodeId });
    
    return true;
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    const sourceNode = this.nodes.get(edge.sourceNodeId);
    const targetNode = this.nodes.get(edge.targetNodeId);

    if (sourceNode) {
      sourceNode.outgoingEdges = sourceNode.outgoingEdges.filter(e => e.id !== edgeId);
    }
    if (targetNode) {
      targetNode.incomingEdges = targetNode.incomingEdges.filter(e => e.id !== edgeId);
    }

    this.edges.delete(edgeId);
    this.emit('edge_removed', { edgeId });
    
    return true;
  }

  /**
   * Calculate end-to-end latency by graph traversal
   * Implements Requirement 6.2
   */
  calculateEndToEndLatency(sourceNodeId: string, targetNodeId?: string): LatencyCalculationResult {
    const sourceNode = this.nodes.get(sourceNodeId);
    if (!sourceNode) {
      throw new Error(`Source node ${sourceNodeId} not found`);
    }

    // If no target specified, calculate to all reachable nodes
    if (!targetNodeId) {
      return this.calculateLatencyToAllNodes(sourceNodeId);
    }

    const targetNode = this.nodes.get(targetNodeId);
    if (!targetNode) {
      throw new Error(`Target node ${targetNodeId} not found`);
    }

    // Find all paths from source to target
    const paths = this.findAllPaths(sourceNodeId, targetNodeId);
    
    if (paths.length === 0) {
      throw new Error(`No path found from ${sourceNodeId} to ${targetNodeId}`);
    }

    // Calculate latency for each path
    const pathLatencies = paths.map(path => this.calculatePathLatency(path));
    
    // Find the critical path (shortest latency)
    const criticalPath = pathLatencies.reduce((min, current) => 
      current.totalLatency < min.totalLatency ? current : min
    );

    // Build component and connection latency maps
    const componentLatencies = new Map<string, number>();
    const connectionLatencies = new Map<string, number>();

    for (const node of criticalPath.nodes) {
      const nodeLatency = this.calculateNodeLatency(node);
      componentLatencies.set(node.id, nodeLatency);
    }

    for (const edge of criticalPath.edges) {
      connectionLatencies.set(edge.id, edge.latency);
    }

    return {
      totalLatency: criticalPath.totalLatency,
      componentLatencies,
      connectionLatencies,
      criticalPath,
      alternativePaths: pathLatencies.filter(p => p !== criticalPath)
    };
  }

  /**
   * Update node load and recalculate performance characteristics
   * Implements Requirements 6.3, 6.5 - degradation modeling and dynamic reconfiguration
   */
  updateNodeLoad(nodeId: string, load: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const previousLoad = node.currentLoad;
    node.currentLoad = load;
    node.currentUtilization = load / node.characteristics.capacityLimit;
    node.lastUpdated = Date.now();

    // Update degradation engine with new utilization
    this.degradationEngine.updateComponentUtilization(nodeId, node.currentUtilization, node);

    // Check for degradation
    const degradation = this.calculateDegradation(node);
    
    this.emit('node_load_updated', {
      nodeId,
      load,
      utilization: node.currentUtilization,
      degradation,
      previousLoad
    });
  }

  /**
   * Update edge load
   */
  updateEdgeLoad(edgeId: string, load: number): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    edge.currentLoad = load;
    
    this.emit('edge_load_updated', {
      edgeId,
      load,
      utilization: load / edge.bandwidth
    });
  }

  /**
   * Validate the graph for circular dependencies and other issues
   * Implements Requirement 6.4
   */
  validateGraph(): GraphValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const circularDependencies: string[][] = [];
    const unreachableNodes: string[] = [];

    // Check for circular dependencies using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        const cycle = this.detectCycleDFS(nodeId, visited, recursionStack, []);
        if (cycle.length > 0) {
          circularDependencies.push(cycle);
        }
      }
    }

    // Check for unreachable nodes
    const entryNodes = this.findEntryNodes();
    if (entryNodes.length === 0) {
      warnings.push('No entry nodes found (nodes with no incoming connections)');
    } else {
      const reachableNodes = new Set<string>();
      for (const entryNode of entryNodes) {
        this.markReachableNodes(entryNode.id, reachableNodes);
      }
      
      for (const nodeId of this.nodes.keys()) {
        if (!reachableNodes.has(nodeId)) {
          unreachableNodes.push(nodeId);
        }
      }
    }

    // Check for isolated components
    for (const [nodeId, node] of this.nodes) {
      if (node.incomingEdges.length === 0 && node.outgoingEdges.length === 0) {
        warnings.push(`Node ${nodeId} is isolated (no connections)`);
      }
    }

    // Validate edge configurations
    for (const [edgeId, edge] of this.edges) {
      if (edge.latency < 0) {
        errors.push(`Edge ${edgeId} has negative latency`);
      }
      if (edge.bandwidth <= 0) {
        errors.push(`Edge ${edgeId} has invalid bandwidth`);
      }
      if (edge.reliability < 0 || edge.reliability > 1) {
        errors.push(`Edge ${edgeId} has invalid reliability (must be 0-1)`);
      }
    }

    const isValid = errors.length === 0 && circularDependencies.length === 0;

    return {
      isValid,
      errors,
      warnings,
      circularDependencies,
      unreachableNodes
    };
  }

  /**
   * Get all nodes in the graph
   */
  getNodes(): SystemGraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges in the graph
   */
  getEdges(): SystemGraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get a specific node by ID
   */
  getNode(nodeId: string): SystemGraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get a specific edge by ID
   */
  getEdge(edgeId: string): SystemGraphEdge | undefined {
    return this.edges.get(edgeId);
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.degradationEngine.clear();
    this.nodes.clear();
    this.edges.clear();
    this.lastValidation = null;
    this.emit('graph_cleared');
  }

  /**
   * Get the last validation result
   */
  getLastValidation(): GraphValidationResult | null {
    return this.lastValidation;
  }

  /**
   * Request dynamic reconfiguration of a component
   * Implements Requirement 6.5 - dynamic reconfiguration during simulation without restart
   */
  requestDynamicReconfiguration(componentId: string, newConfig: Partial<ComponentConfiguration>, reason: string): boolean {
    const request: ReconfigurationRequest = {
      componentId,
      newConfiguration: newConfig,
      reason,
      timestamp: Date.now()
    };

    const accepted = this.degradationEngine.requestReconfiguration(request);
    
    if (accepted) {
      // Apply the reconfiguration to the node
      const node = this.nodes.get(componentId);
      if (node) {
        const success = this.degradationEngine.applyReconfiguration(componentId, newConfig, node);
        if (success) {
          this.emit('dynamic_reconfiguration_completed', {
            componentId,
            newConfig,
            reason,
            timestamp: Date.now()
          });
        }
        return success;
      }
    }
    
    return false;
  }

  /**
   * Get degradation state for a component
   * Implements Requirement 6.3 - realistic degradation modeling
   */
  getComponentDegradationState(componentId: string) {
    return this.degradationEngine.getComponentDegradationState(componentId);
  }

  /**
   * Get performance multipliers for a component due to degradation
   */
  getPerformanceMultipliers(componentId: string) {
    return this.degradationEngine.getPerformanceMultipliers(componentId);
  }

  /**
   * Get performance curve for a component
   */
  getPerformanceCurve(componentId: string) {
    return this.degradationEngine.getPerformanceCurve(componentId);
  }

  /**
   * Get all active cascading failures
   */
  getActiveCascadingFailures() {
    return this.degradationEngine.getActiveCascadingFailures();
  }

  /**
   * Start the system graph engine (enables degradation tracking)
   */
  start(): void {
    this.degradationEngine.start();
    this.emit('system_graph_engine_started');
  }

  /**
   * Stop the system graph engine
   */
  stop(): void {
    this.degradationEngine.stop();
    this.emit('system_graph_engine_stopped');
  }

  // Private helper methods

  /**
   * Initialize performance characteristics for each component type
   */
  private initializeComponentCharacteristics(): Map<SystemComponentType, ComponentPerformanceCharacteristics> {
    const characteristics = new Map<SystemComponentType, ComponentPerformanceCharacteristics>();

    // Client component characteristics
    characteristics.set('Client', {
      baseLatency: 10, // 10ms base latency
      maxThroughput: 1000, // 1000 RPS
      capacityLimit: 100, // 100 concurrent requests
      latencyCurve: {
        type: 'linear',
        coefficients: [1, 0.1], // latency = base * (1 + 0.1 * utilization)
        maxLatency: 100
      },
      throughputCurve: {
        type: 'linear',
        coefficients: [1, -0.2], // throughput decreases with load
        maxThroughput: 1000
      },
      degradationModel: {
        type: 'graceful',
        thresholds: [
          { utilizationPercent: 80, latencyMultiplier: 1.5, throughputMultiplier: 0.9, errorRateIncrease: 0.01 },
          { utilizationPercent: 95, latencyMultiplier: 2.0, throughputMultiplier: 0.7, errorRateIncrease: 0.05 }
        ]
      }
    });

    // Load Balancer characteristics
    characteristics.set('LoadBalancer', {
      baseLatency: 2, // 2ms base latency
      maxThroughput: 10000, // 10K RPS
      capacityLimit: 1000, // 1000 concurrent connections
      latencyCurve: {
        type: 'linear',
        coefficients: [1, 0.05],
        maxLatency: 20
      },
      throughputCurve: {
        type: 'plateau',
        coefficients: [1, 0.95], // plateaus at 95% of max
        maxThroughput: 10000
      },
      degradationModel: {
        type: 'graceful',
        thresholds: [
          { utilizationPercent: 85, latencyMultiplier: 1.2, throughputMultiplier: 0.95, errorRateIncrease: 0.001 },
          { utilizationPercent: 98, latencyMultiplier: 1.8, throughputMultiplier: 0.8, errorRateIncrease: 0.02 }
        ]
      }
    });

    // API Gateway characteristics
    characteristics.set('APIGateway', {
      baseLatency: 5, // 5ms base latency
      maxThroughput: 5000, // 5K RPS
      capacityLimit: 500, // 500 concurrent requests
      latencyCurve: {
        type: 'exponential',
        coefficients: [1, 0.02, 0.001], // exponential growth under load
        maxLatency: 200
      },
      throughputCurve: {
        type: 'degrading',
        coefficients: [1, -0.1, -0.01],
        maxThroughput: 5000
      },
      degradationModel: {
        type: 'cliff',
        thresholds: [
          { utilizationPercent: 70, latencyMultiplier: 1.3, throughputMultiplier: 0.9, errorRateIncrease: 0.005 },
          { utilizationPercent: 90, latencyMultiplier: 3.0, throughputMultiplier: 0.5, errorRateIncrease: 0.1 }
        ]
      }
    });

    // Service characteristics
    characteristics.set('Service', {
      baseLatency: 50, // 50ms base latency
      maxThroughput: 2000, // 2K RPS
      capacityLimit: 200, // 200 concurrent requests
      latencyCurve: {
        type: 'exponential',
        coefficients: [1, 0.1, 0.01],
        maxLatency: 5000
      },
      throughputCurve: {
        type: 'degrading',
        coefficients: [1, -0.2, -0.05],
        maxThroughput: 2000
      },
      degradationModel: {
        type: 'cascading',
        thresholds: [
          { utilizationPercent: 60, latencyMultiplier: 1.5, throughputMultiplier: 0.8, errorRateIncrease: 0.01 },
          { utilizationPercent: 85, latencyMultiplier: 4.0, throughputMultiplier: 0.4, errorRateIncrease: 0.2 }
        ]
      }
    });

    // Cache characteristics
    characteristics.set('Cache', {
      baseLatency: 1, // 1ms base latency
      maxThroughput: 50000, // 50K RPS
      capacityLimit: 10000, // 10K concurrent requests
      latencyCurve: {
        type: 'logarithmic',
        coefficients: [1, 0.1],
        maxLatency: 10
      },
      throughputCurve: {
        type: 'plateau',
        coefficients: [1, 0.98],
        maxThroughput: 50000
      },
      degradationModel: {
        type: 'graceful',
        thresholds: [
          { utilizationPercent: 90, latencyMultiplier: 1.1, throughputMultiplier: 0.95, errorRateIncrease: 0.001 },
          { utilizationPercent: 99, latencyMultiplier: 1.5, throughputMultiplier: 0.8, errorRateIncrease: 0.01 }
        ]
      }
    });

    // Queue characteristics
    characteristics.set('Queue', {
      baseLatency: 3, // 3ms base latency
      maxThroughput: 20000, // 20K messages/sec
      capacityLimit: 100000, // 100K queued messages
      latencyCurve: {
        type: 'linear',
        coefficients: [1, 0.001], // very low latency increase
        maxLatency: 50
      },
      throughputCurve: {
        type: 'plateau',
        coefficients: [1, 0.99],
        maxThroughput: 20000
      },
      degradationModel: {
        type: 'cliff',
        thresholds: [
          { utilizationPercent: 80, latencyMultiplier: 1.2, throughputMultiplier: 0.9, errorRateIncrease: 0.001 },
          { utilizationPercent: 95, latencyMultiplier: 10.0, throughputMultiplier: 0.1, errorRateIncrease: 0.5 }
        ]
      }
    });

    // Database characteristics
    characteristics.set('Database', {
      baseLatency: 20, // 20ms base latency
      maxThroughput: 1000, // 1K queries/sec
      capacityLimit: 100, // 100 concurrent connections
      latencyCurve: {
        type: 'exponential',
        coefficients: [1, 0.2, 0.05],
        maxLatency: 10000
      },
      throughputCurve: {
        type: 'degrading',
        coefficients: [1, -0.3, -0.1],
        maxThroughput: 1000
      },
      degradationModel: {
        type: 'cascading',
        thresholds: [
          { utilizationPercent: 70, latencyMultiplier: 2.0, throughputMultiplier: 0.7, errorRateIncrease: 0.02 },
          { utilizationPercent: 90, latencyMultiplier: 10.0, throughputMultiplier: 0.2, errorRateIncrease: 0.3 }
        ]
      }
    });

    // CDN characteristics
    characteristics.set('CDN', {
      baseLatency: 15, // 15ms base latency (geographic)
      maxThroughput: 100000, // 100K RPS
      capacityLimit: 50000, // 50K concurrent requests
      latencyCurve: {
        type: 'logarithmic',
        coefficients: [1, 0.05],
        maxLatency: 100
      },
      throughputCurve: {
        type: 'plateau',
        coefficients: [1, 0.95],
        maxThroughput: 100000
      },
      degradationModel: {
        type: 'graceful',
        thresholds: [
          { utilizationPercent: 85, latencyMultiplier: 1.3, throughputMultiplier: 0.9, errorRateIncrease: 0.005 },
          { utilizationPercent: 95, latencyMultiplier: 2.0, throughputMultiplier: 0.7, errorRateIncrease: 0.02 }
        ]
      }
    });

    // Search Index characteristics
    characteristics.set('SearchIndex', {
      baseLatency: 30, // 30ms base latency
      maxThroughput: 500, // 500 queries/sec
      capacityLimit: 50, // 50 concurrent queries
      latencyCurve: {
        type: 'exponential',
        coefficients: [1, 0.3, 0.1],
        maxLatency: 2000
      },
      throughputCurve: {
        type: 'degrading',
        coefficients: [1, -0.4, -0.2],
        maxThroughput: 500
      },
      degradationModel: {
        type: 'cliff',
        thresholds: [
          { utilizationPercent: 60, latencyMultiplier: 2.5, throughputMultiplier: 0.6, errorRateIncrease: 0.05 },
          { utilizationPercent: 80, latencyMultiplier: 8.0, throughputMultiplier: 0.2, errorRateIncrease: 0.3 }
        ]
      }
    });

    // Object Storage characteristics
    characteristics.set('ObjectStorage', {
      baseLatency: 100, // 100ms base latency
      maxThroughput: 10000, // 10K operations/sec
      capacityLimit: 5000, // 5K concurrent operations
      latencyCurve: {
        type: 'linear',
        coefficients: [1, 0.02],
        maxLatency: 1000
      },
      throughputCurve: {
        type: 'plateau',
        coefficients: [1, 0.9],
        maxThroughput: 10000
      },
      degradationModel: {
        type: 'graceful',
        thresholds: [
          { utilizationPercent: 80, latencyMultiplier: 1.4, throughputMultiplier: 0.85, errorRateIncrease: 0.01 },
          { utilizationPercent: 95, latencyMultiplier: 2.5, throughputMultiplier: 0.6, errorRateIncrease: 0.05 }
        ]
      }
    });

    return characteristics;
  }

  /**
   * Map legacy component types to system component types
   */
  private mapComponentTypeToSystemType(componentType: ComponentType): SystemComponentType {
    const mapping: Record<ComponentType, SystemComponentType> = {
      'database': 'Database',
      'load-balancer': 'LoadBalancer',
      'web-server': 'Service',
      'cache': 'Cache',
      'message-queue': 'Queue',
      'queue': 'Queue',
      'service': 'Service',
      'cdn': 'CDN',
      'proxy': 'APIGateway'
    };

    return mapping[componentType] || 'Service';
  }

  /**
   * Get performance characteristics for a component type
   */
  private getComponentCharacteristics(type: SystemComponentType): ComponentPerformanceCharacteristics {
    const characteristics = this.componentCharacteristics.get(type);
    if (!characteristics) {
      throw new Error(`No performance characteristics defined for component type: ${type}`);
    }
    return { ...characteristics }; // Return a copy
  }

  /**
   * Calculate latency for all reachable nodes from a source
   */
  private calculateLatencyToAllNodes(sourceNodeId: string): LatencyCalculationResult {
    const componentLatencies = new Map<string, number>();
    const connectionLatencies = new Map<string, number>();
    
    // Use BFS to find shortest paths to all nodes
    const queue = [{ nodeId: sourceNodeId, latency: 0, path: [sourceNodeId] }];
    const visited = new Set<string>();
    const shortestPaths = new Map<string, { latency: number, path: string[] }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);
      
      shortestPaths.set(current.nodeId, { latency: current.latency, path: current.path });
      
      const node = this.nodes.get(current.nodeId);
      if (!node) continue;

      // Add current node's processing latency
      const nodeLatency = this.calculateNodeLatency(node);
      componentLatencies.set(current.nodeId, nodeLatency);

      // Explore outgoing edges
      for (const edge of node.outgoingEdges) {
        if (!visited.has(edge.targetNodeId)) {
          const totalLatency = current.latency + nodeLatency + edge.latency;
          connectionLatencies.set(edge.id, edge.latency);
          
          queue.push({
            nodeId: edge.targetNodeId,
            latency: totalLatency,
            path: [...current.path, edge.targetNodeId]
          });
        }
      }
    }

    // Find the longest path as the critical path
    let maxLatency = 0;
    let criticalPathInfo = { latency: 0, path: [sourceNodeId] };
    
    for (const [nodeId, pathInfo] of shortestPaths) {
      if (pathInfo.latency > maxLatency) {
        maxLatency = pathInfo.latency;
        criticalPathInfo = pathInfo;
      }
    }

    // Build critical path object
    const criticalPath = this.buildPathFromNodeIds(criticalPathInfo.path);

    return {
      totalLatency: maxLatency,
      componentLatencies,
      connectionLatencies,
      criticalPath,
      alternativePaths: []
    };
  }

  /**
   * Find all paths between two nodes
   */
  private findAllPaths(sourceId: string, targetId: string, maxPaths: number = 10): SystemPath[] {
    const paths: SystemPath[] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[], edges: SystemGraphEdge[]) => {
      if (paths.length >= maxPaths) return;
      
      if (currentId === targetId) {
        paths.push(this.buildPathFromNodeIds(path, edges));
        return;
      }

      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return;

      for (const edge of node.outgoingEdges) {
        dfs(edge.targetNodeId, [...path, edge.targetNodeId], [...edges, edge]);
      }

      visited.delete(currentId);
    };

    dfs(sourceId, [sourceId], []);
    return paths;
  }

  /**
   * Build a SystemPath object from node IDs and edges
   */
  private buildPathFromNodeIds(nodeIds: string[], edges: SystemGraphEdge[] = []): SystemPath {
    const nodes: SystemGraphNode[] = [];
    const pathEdges: SystemGraphEdge[] = [];
    let totalLatency = 0;
    let reliability = 1.0;
    let bottleneckNode: SystemGraphNode | undefined;
    let minThroughput = Infinity;

    // Collect nodes
    for (const nodeId of nodeIds) {
      const node = this.nodes.get(nodeId);
      if (node) {
        nodes.push(node);
        totalLatency += this.calculateNodeLatency(node);
        
        // Track bottleneck (lowest throughput)
        if (node.characteristics.maxThroughput < minThroughput) {
          minThroughput = node.characteristics.maxThroughput;
          bottleneckNode = node;
        }
      }
    }

    // Collect edges (either provided or inferred from consecutive nodes)
    if (edges.length > 0) {
      pathEdges.push(...edges);
    } else {
      for (let i = 0; i < nodeIds.length - 1; i++) {
        const sourceNode = this.nodes.get(nodeIds[i]);
        const targetNodeId = nodeIds[i + 1];
        
        if (sourceNode) {
          const edge = sourceNode.outgoingEdges.find(e => e.targetNodeId === targetNodeId);
          if (edge) {
            pathEdges.push(edge);
          }
        }
      }
    }

    // Add edge latencies and calculate reliability
    for (const edge of pathEdges) {
      totalLatency += edge.latency;
      reliability *= edge.reliability;
    }

    return {
      nodes,
      edges: pathEdges,
      totalLatency,
      bottleneckNode,
      reliability
    };
  }

  /**
   * Calculate latency for a specific path
   */
  private calculatePathLatency(path: SystemPath): SystemPath {
    let totalLatency = 0;

    // Add node processing latencies
    for (const node of path.nodes) {
      totalLatency += this.calculateNodeLatency(node);
    }

    // Add edge latencies
    for (const edge of path.edges) {
      totalLatency += edge.latency;
    }

    return {
      ...path,
      totalLatency
    };
  }

  /**
   * Calculate current latency for a node based on its load, characteristics, and degradation
   * Implements Requirement 6.3 - realistic degradation modeling
   */
  private calculateNodeLatency(node: SystemGraphNode): number {
    const { baseLatency, latencyCurve } = node.characteristics;
    const utilization = node.currentUtilization;

    let latencyMultiplier = 1.0;

    switch (latencyCurve.type) {
      case 'linear':
        latencyMultiplier = latencyCurve.coefficients[0] + (latencyCurve.coefficients[1] * utilization);
        break;
      case 'exponential':
        latencyMultiplier = latencyCurve.coefficients[0] * Math.exp(latencyCurve.coefficients[1] * utilization);
        break;
      case 'logarithmic':
        latencyMultiplier = latencyCurve.coefficients[0] + (latencyCurve.coefficients[1] * Math.log(1 + utilization));
        break;
    }

    let calculatedLatency = baseLatency * latencyMultiplier;
    calculatedLatency = Math.min(calculatedLatency, latencyCurve.maxLatency);

    // Apply degradation multipliers
    const performanceMultipliers = this.degradationEngine.getPerformanceMultipliers(node.id);
    calculatedLatency *= performanceMultipliers.latency;

    return calculatedLatency;
  }

  /**
   * Calculate degradation effects for a node
   */
  private calculateDegradation(node: SystemGraphNode): DegradationThreshold | null {
    const utilizationPercent = node.currentUtilization * 100;
    const thresholds = node.characteristics.degradationModel.thresholds;

    // Find the applicable threshold
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (utilizationPercent >= thresholds[i].utilizationPercent) {
        return thresholds[i];
      }
    }

    return null;
  }

  /**
   * Detect cycles using DFS
   */
  private detectCycleDFS(nodeId: string, visited: Set<string>, recursionStack: Set<string>, path: string[]): string[] {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return [];

    for (const edge of node.outgoingEdges) {
      const targetId = edge.targetNodeId;
      
      if (!visited.has(targetId)) {
        const cycle = this.detectCycleDFS(targetId, visited, recursionStack, [...path]);
        if (cycle.length > 0) return cycle;
      } else if (recursionStack.has(targetId)) {
        // Found a cycle
        const cycleStart = path.indexOf(targetId);
        return path.slice(cycleStart).concat([targetId]);
      }
    }

    recursionStack.delete(nodeId);
    return [];
  }

  /**
   * Find entry nodes (nodes with no incoming edges)
   */
  private findEntryNodes(): SystemGraphNode[] {
    return Array.from(this.nodes.values()).filter(node => node.incomingEdges.length === 0);
  }

  /**
   * Mark all nodes reachable from a given node
   */
  private markReachableNodes(nodeId: string, reachable: Set<string>): void {
    if (reachable.has(nodeId)) return;
    
    reachable.add(nodeId);
    const node = this.nodes.get(nodeId);
    if (!node) return;

    for (const edge of node.outgoingEdges) {
      this.markReachableNodes(edge.targetNodeId, reachable);
    }
  }

  /**
   * Get components by type (needed by LoadSimulationEngine)
   */
  getComponentsByType(type: SystemComponentType): SystemGraphNode[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  /**
   * Get all components (alias for getNodes, needed by LoadSimulationEngine)
   */
  getAllComponents(): SystemGraphNode[] {
    return this.getNodes();
  }

  /**
   * Get upstream components (components that send data to this component)
   */
  getUpstreamComponents(componentId: string): SystemGraphNode[] {
    const node = this.nodes.get(componentId);
    if (!node) return [];

    const upstreamNodes: SystemGraphNode[] = [];
    for (const edge of node.incomingEdges) {
      const upstreamNode = this.nodes.get(edge.sourceNodeId);
      if (upstreamNode) {
        upstreamNodes.push(upstreamNode);
      }
    }
    return upstreamNodes;
  }

  /**
   * Get downstream components (components that receive data from this component)
   */
  getDownstreamComponents(componentId: string): SystemGraphNode[] {
    const node = this.nodes.get(componentId);
    if (!node) return [];

    const downstreamNodes: SystemGraphNode[] = [];
    for (const edge of node.outgoingEdges) {
      const downstreamNode = this.nodes.get(edge.targetNodeId);
      if (downstreamNode) {
        downstreamNodes.push(downstreamNode);
      }
    }
    return downstreamNodes;
  }
}