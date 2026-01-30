/**
 * Core discrete-event simulation engine
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { PriorityQueueEventScheduler } from './EventScheduler';
import { SimulationEvent, SimulationState, SimulationEventType } from './types';
import { Workspace, ComponentMetrics, LoadPattern } from '../types';
import { LoadGeneratorFactory, LoadPoint } from './LoadGenerator';
import { FailureManager, FailureManagerFactory } from './FailureManager';
import { MetricsCollector, AggregatedMetrics, SystemMetrics } from './MetricsCollector';
import { MetricsStorage } from './MetricsStorage';
import { BottleneckReporter, BottleneckAlert } from './BottleneckReporter';

export class SimulationEngine extends EventEmitter {
  private scheduler: PriorityQueueEventScheduler;
  private state: SimulationState;
  private workspace: Workspace | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private failureManager: FailureManager;
  private metricsCollector: MetricsCollector;
  private metricsStorage: MetricsStorage;
  private bottleneckReporter: BottleneckReporter;

  constructor() {
    super();
    this.scheduler = new PriorityQueueEventScheduler();
    this.state = this.createInitialState();
    this.failureManager = FailureManagerFactory.createManager({
      enableRandomFailures: true,
      failureRate: 0.01,
      recoveryRate: 0.1
    });
    this.metricsCollector = new MetricsCollector();
    this.metricsStorage = new MetricsStorage();
    this.bottleneckReporter = new BottleneckReporter();

    // Connect metrics collector to storage
    this.metricsCollector.on('metrics_added', (metrics: ComponentMetrics) => {
      this.metricsStorage.storeRawMetrics(metrics);
    });

    this.metricsCollector.on('metrics_aggregated', (data: any) => {
      if (data.systemMetrics) {
        this.metricsStorage.storeSystemMetrics(data.systemMetrics);
      }
    });

    // Connect bottleneck reporter to metrics
    this.bottleneckReporter.on('analysis_requested', () => {
      this.performBottleneckAnalysis();
    });

    this.bottleneckReporter.on('bottleneck_alert', (alert: BottleneckAlert) => {
      this.emit('bottleneck_alert', alert);
    });
  }

  /**
   * Initialize simulation with workspace configuration
   */
  initialize(workspace: Workspace): void {
    this.workspace = workspace;
    this.state = this.createInitialState();
    this.scheduler.clear();
    
    // Initialize component states
    workspace.components.forEach(component => {
      this.state.components.set(component.id, {
        ...component,
        currentLoad: 0,
        queueDepth: 0,
        isHealthy: true,
        lastMetricsTime: 0
      });

      // Initialize failure management for each component
      this.failureManager.initializeComponent(component.id, component.type);
    });

    this.emit('initialized', { workspace: workspace.id });
  }

  /**
   * Start the simulation
   */
  async start(): Promise<void> {
    if (!this.workspace) {
      throw new Error('Simulation not initialized with workspace');
    }

    if (this.state.isRunning) {
      throw new Error('Simulation is already running');
    }

    this.state.isRunning = true;
    this.state.startTime = Date.now();
    this.state.endTime = this.state.startTime + (this.workspace.configuration.duration * 1000);

    // Start metrics collection
    this.metricsCollector.start();

    // Start bottleneck monitoring
    this.bottleneckReporter.start();

    // Schedule initial events
    this.scheduleInitialEvents();

    // Start simulation loop
    this.runSimulationLoop();

    this.emit('started', { 
      workspaceId: this.workspace.id,
      duration: this.workspace.configuration.duration 
    });
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.state.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop metrics collection
    this.metricsCollector.stop();

    // Stop bottleneck monitoring
    this.bottleneckReporter.stop();

    this.emit('stopped', { 
      workspaceId: this.workspace?.id,
      eventCount: this.state.eventCount,
      duration: this.scheduler.getCurrentTime()
    });
  }

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    return { ...this.state };
  }

  /**
   * Get metrics for a specific component
   */
  getComponentMetrics(componentId: string): ComponentMetrics[] {
    return this.state.metrics.get(componentId) || [];
  }

  /**
   * Get failure information for a specific component
   */
  getComponentFailureInfo(componentId: string) {
    const failureState = this.failureManager.getComponentState(componentId);
    const failureImpact = this.failureManager.getFailureImpact(componentId);
    const failureStats = this.failureManager.getFailureStatistics(componentId);
    
    return {
      state: failureState,
      impact: failureImpact,
      statistics: failureStats
    };
  }

  /**
   * Get all active failures across all components
   */
  getAllActiveFailures() {
    return this.failureManager.getActiveFailures();
  }

  /**
   * Get metrics collector instance
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get metrics storage instance
   */
  getMetricsStorage(): MetricsStorage {
    return this.metricsStorage;
  }

  /**
   * Get real-time aggregated metrics for a component
   */
  getRealtimeMetrics(componentId: string): AggregatedMetrics | null {
    return this.metricsStorage.getLatestAggregatedMetrics(componentId);
  }

  /**
   * Get real-time system metrics
   */
  getRealtimeSystemMetrics(): SystemMetrics | null {
    return this.metricsStorage.getLatestSystemMetrics();
  }

  /**
   * Get bottleneck reporter instance
   */
  getBottleneckReporter(): BottleneckReporter {
    return this.bottleneckReporter;
  }

  /**
   * Get current bottleneck report
   */
  getCurrentBottleneckReport() {
    return this.bottleneckReporter.getLatestReport();
  }

  /**
   * Get bottleneck trends
   */
  getBottleneckTrends(componentId?: string) {
    return this.bottleneckReporter.getBottleneckTrends(componentId);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    return this.bottleneckReporter.generateOptimizationRecommendations();
  }

  /**
   * Perform bottleneck analysis
   */
  private performBottleneckAnalysis(): void {
    if (!this.workspace || !this.state.isRunning) return;

    // Get current metrics for all components
    const currentMetrics = new Map<string, ComponentMetrics>();
    
    for (const component of this.workspace.components) {
      const latestMetrics = this.metricsStorage.getLatestRawMetrics(component.id);
      if (latestMetrics) {
        currentMetrics.set(component.id, latestMetrics);
      }
    }

    // Get latest system metrics
    const systemMetrics = this.metricsStorage.getLatestSystemMetrics();

    // Perform analysis
    const report = this.bottleneckReporter.analyzeSystem(
      this.workspace.components,
      currentMetrics,
      this.workspace.connections,
      systemMetrics || undefined
    );

    this.emit('bottleneck_report', report);
  }

  /**
   * Schedule a custom event
   */
  scheduleEvent(type: SimulationEventType, componentId: string, timestamp: number, data: any = {}): void {
    const event: SimulationEvent = {
      id: uuidv4(),
      timestamp,
      type,
      componentId,
      data
    };

    this.scheduler.scheduleEvent(event);
  }

  /**
   * Create initial simulation state
   */
  private createInitialState(): SimulationState {
    return {
      currentTime: 0,
      isRunning: false,
      startTime: 0,
      endTime: 0,
      eventCount: 0,
      components: new Map(),
      metrics: new Map()
    };
  }

  /**
   * Schedule initial simulation events
   */
  private scheduleInitialEvents(): void {
    if (!this.workspace) return;

    const config = this.workspace.configuration;
    
    // Schedule load generation events based on load pattern
    this.scheduleLoadEvents(config.loadPattern);
    
    // Schedule failure scenarios
    config.failureScenarios.forEach(scenario => {
      this.scheduleEvent('failure_injection', scenario.componentId, scenario.startTime, scenario);
    });

    // Schedule periodic metrics collection
    const metricsInterval = config.metricsCollection.collectionInterval;
    for (let time = metricsInterval; time < config.duration * 1000; time += metricsInterval) {
      this.workspace.components.forEach(component => {
        this.scheduleEvent('metrics_collection', component.id, time);
      });
    }

    // Schedule periodic random failure checks (every 30 seconds)
    for (let time = 30000; time < config.duration * 1000; time += 30000) {
      this.workspace.components.forEach(component => {
        this.scheduleEvent('random_failure_check', component.id, time);
      });
    }

    // Schedule periodic recovery checks (every 5 seconds)
    for (let time = 5000; time < config.duration * 1000; time += 5000) {
      this.workspace.components.forEach(component => {
        this.scheduleEvent('recovery_check', component.id, time);
      });
    }
  }

  /**
   * Schedule load generation events based on pattern
   */
  private scheduleLoadEvents(loadPattern: LoadPattern): void {
    if (!this.workspace) return;

    const duration = this.workspace.configuration.duration * 1000; // Convert to milliseconds
    const loadGenerator = LoadGeneratorFactory.createGenerator('realistic');
    
    // Generate load points using the advanced load generator
    const loadPoints = loadGenerator.generateLoadPoints(loadPattern, this.workspace.configuration.duration);
    
    // Schedule request arrivals based on generated load points
    loadPoints.forEach((point, index) => {
      const requestsInThisSecond = Math.round(point.requestsPerSecond);
      
      // Distribute requests evenly within the second
      for (let i = 0; i < requestsInThisSecond; i++) {
        const requestTime = point.timestamp + (i / requestsInThisSecond) * 1000;
        
        // Find entry point components (components with no incoming connections)
        const entryComponents = this.findEntryComponents();
        if (entryComponents.length > 0) {
          // Use weighted random selection for entry components
          const targetComponent = this.selectEntryComponent(entryComponents);
          this.scheduleEvent('request_arrival', targetComponent.id, requestTime, {
            loadPoint: point,
            requestIndex: i
          });
        }
      }
    });

    // Emit load pattern information for monitoring
    this.emit('load_pattern_scheduled', {
      pattern: loadPattern,
      totalRequests: loadPoints.reduce((sum, point) => sum + point.requestsPerSecond, 0),
      duration: this.workspace.configuration.duration
    });
  }

  /**
   * Select entry component using weighted random selection
   * Components with higher capacity are more likely to be selected
   */
  private selectEntryComponent(entryComponents: any[]): any {
    if (entryComponents.length === 1) {
      return entryComponents[0];
    }

    // Calculate weights based on component capacity
    const weights = entryComponents.map(component => component.configuration.capacity || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Random selection based on weights
    let random = Math.random() * totalWeight;
    for (let i = 0; i < entryComponents.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return entryComponents[i];
      }
    }
    
    // Fallback to first component
    return entryComponents[0];
  }

  /**
   * Find entry point components (no incoming connections)
   */
  private findEntryComponents(): any[] {
    if (!this.workspace) return [];

    const componentsWithIncoming = new Set(
      this.workspace.connections.map(conn => conn.targetComponentId)
    );

    return this.workspace.components.filter(
      component => !componentsWithIncoming.has(component.id)
    );
  }

  /**
   * Main simulation loop - processes events chronologically
   */
  private runSimulationLoop(): void {
    const processEvents = () => {
      if (!this.state.isRunning) return;

      const startTime = Date.now();
      const maxProcessingTime = 50; // Process events for max 50ms per cycle

      while (this.scheduler.hasEvents() && (Date.now() - startTime) < maxProcessingTime) {
        const event = this.scheduler.getNextEvent();
        if (!event) break;

        // Check if simulation should end
        if (event.timestamp > this.workspace!.configuration.duration * 1000) {
          this.stop();
          return;
        }

        this.processEvent(event);
        this.state.eventCount++;
        this.state.currentTime = event.timestamp;
      }

      // Continue processing if simulation is still running
      if (this.state.isRunning) {
        this.intervalId = setTimeout(processEvents, 10); // 10ms delay between cycles
      }
    };

    processEvents();
  }

  /**
   * Process a single simulation event
   */
  private processEvent(event: SimulationEvent): void {
    try {
      switch (event.type) {
        case 'request_arrival':
          this.handleRequestArrival(event);
          break;
        case 'request_completion':
          this.handleRequestCompletion(event);
          break;
        case 'component_failure':
          this.handleComponentFailure(event);
          break;
        case 'component_recovery':
          this.handleComponentRecovery(event);
          break;
        case 'metrics_collection':
          this.handleMetricsCollection(event);
          break;
        case 'load_change':
          this.handleLoadChange(event);
          break;
        case 'failure_injection':
          this.handleFailureInjection(event);
          break;
        case 'recovery_check':
          this.handleRecoveryCheck(event);
          break;
        case 'random_failure_check':
          this.handleRandomFailureCheck(event);
          break;
      }

      this.emit('event_processed', event);
    } catch (error) {
      this.emit('error', { event, error });
    }
  }

  /**
   * Handle request arrival at a component
   */
  private handleRequestArrival(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    component.currentLoad++;
    component.queueDepth++;

    // Schedule request completion based on component processing time
    const processingTime = this.calculateProcessingTime(component);
    this.scheduleEvent('request_completion', event.componentId, 
      event.timestamp + processingTime, { requestId: event.id });

    this.emit('request_arrived', { componentId: event.componentId, timestamp: event.timestamp });
  }

  /**
   * Handle request completion at a component
   */
  private handleRequestCompletion(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    component.currentLoad = Math.max(0, component.currentLoad - 1);
    component.queueDepth = Math.max(0, component.queueDepth - 1);

    // Route request to connected components
    this.routeRequestToNextComponents(event.componentId, event.timestamp);

    this.emit('request_completed', { componentId: event.componentId, timestamp: event.timestamp });
  }

  /**
   * Handle component failure
   */
  private handleComponentFailure(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    component.isHealthy = false;
    this.emit('component_failed', { componentId: event.componentId, timestamp: event.timestamp });
  }

  /**
   * Handle component recovery
   */
  private handleComponentRecovery(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    component.isHealthy = true;
    this.emit('component_recovered', { componentId: event.componentId, timestamp: event.timestamp });
  }

  /**
   * Handle failure injection from scenario
   */
  private handleFailureInjection(event: SimulationEvent): void {
    const scenario = event.data;
    const activeFailure = this.failureManager.injectFailure(scenario, event.timestamp);
    
    if (activeFailure) {
      const component = this.state.components.get(event.componentId);
      if (component) {
        component.isHealthy = false;
      }
      
      this.emit('failure_injected', {
        componentId: event.componentId,
        failureType: activeFailure.type,
        severity: activeFailure.severity,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Handle recovery check for components
   */
  private handleRecoveryCheck(event: SimulationEvent): void {
    const hasRecovered = this.failureManager.processRecovery(event.componentId, event.timestamp);
    
    if (hasRecovered) {
      const component = this.state.components.get(event.componentId);
      const componentState = this.failureManager.getComponentState(event.componentId);
      
      if (component && componentState) {
        component.isHealthy = componentState.isHealthy;
        
        if (componentState.isHealthy) {
          this.emit('component_recovered', {
            componentId: event.componentId,
            timestamp: event.timestamp
          });
        }
      }
    }
  }

  /**
   * Handle random failure check
   */
  private handleRandomFailureCheck(event: SimulationEvent): void {
    const newFailures = this.failureManager.generateRandomFailures(event.componentId, event.timestamp);
    
    newFailures.forEach(failure => {
      const component = this.state.components.get(event.componentId);
      if (component) {
        component.isHealthy = false;
      }
      
      this.emit('random_failure_occurred', {
        componentId: event.componentId,
        failureType: failure.type,
        severity: failure.severity,
        timestamp: event.timestamp
      });
    });
  }

  /**
   * Handle metrics collection
   */
  private handleMetricsCollection(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    // Get failure impact on performance
    const failureImpact = this.failureManager.getFailureImpact(event.componentId);
    const failureStats = this.failureManager.getFailureStatistics(event.componentId);

    const baseLatency = component.configuration.latency;
    const adjustedLatency = baseLatency / failureImpact.performanceMultiplier;
    const adjustedErrorRate = (component.isHealthy ? 0 : 0.1) * failureImpact.errorRateMultiplier;

    const metrics: ComponentMetrics = {
      componentId: event.componentId,
      timestamp: event.timestamp,
      requestsPerSecond: component.currentLoad * failureImpact.availabilityMultiplier,
      averageLatency: adjustedLatency,
      errorRate: Math.min(1.0, adjustedErrorRate),
      cpuUtilization: Math.min(0.9, (component.currentLoad / component.configuration.capacity) / failureImpact.performanceMultiplier),
      memoryUtilization: Math.min(0.8, (component.queueDepth / (component.configuration.capacity * 2)) / failureImpact.performanceMultiplier),
      queueDepth: component.queueDepth
    };

    // Store in legacy state for backward compatibility
    if (!this.state.metrics.has(event.componentId)) {
      this.state.metrics.set(event.componentId, []);
    }
    this.state.metrics.get(event.componentId)!.push(metrics);

    // Add to new metrics collector
    this.metricsCollector.addMetrics(metrics);

    this.emit('metrics_collected', {
      ...metrics,
      failureImpact,
      failureStats
    });
  }

  /**
   * Handle load pattern changes
   */
  private handleLoadChange(event: SimulationEvent): void {
    // Implementation for dynamic load changes during simulation
    this.emit('load_changed', { timestamp: event.timestamp, data: event.data });
  }

  /**
   * Calculate processing time for a component based on its configuration and current load
   */
  private calculateProcessingTime(component: any): number {
    const baseLatency = component.configuration.latency;
    const loadFactor = Math.max(1, component.currentLoad / component.configuration.capacity);
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% variation
    
    // Apply failure impact
    const failureImpact = this.failureManager.getFailureImpact(component.id);
    const failureMultiplier = 1.0 / failureImpact.performanceMultiplier;
    
    return baseLatency * loadFactor * randomFactor * failureMultiplier;
  }

  /**
   * Route completed request to connected components
   */
  private routeRequestToNextComponents(componentId: string, timestamp: number): void {
    if (!this.workspace) return;

    const outgoingConnections = this.workspace.connections.filter(
      conn => conn.sourceComponentId === componentId
    );

    outgoingConnections.forEach(connection => {
      // Add connection latency
      const arrivalTime = timestamp + connection.configuration.latency;
      this.scheduleEvent('request_arrival', connection.targetComponentId, arrivalTime);
    });
  }
}