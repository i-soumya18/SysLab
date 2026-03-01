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
import { PerformanceOptimizer } from '../performance/PerformanceOptimizer';
import { PerformanceMonitoringService } from '../performance/PerformanceMonitoringService';

export class SimulationEngine extends EventEmitter {
  private scheduler: PriorityQueueEventScheduler;
  private state: SimulationState;
  private workspace: Workspace | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private failureManager: FailureManager;
  private metricsCollector: MetricsCollector;
  private metricsStorage: MetricsStorage;
  private bottleneckReporter: BottleneckReporter;
  private performanceOptimizer: PerformanceOptimizer;
  private performanceMonitoring: PerformanceMonitoringService;
  
  // Real-time metrics tracking
  private requestTracking: Map<string, {
    arrivals: number[];
    completions: number[];
    failures: number[];
    latencies: number[];
    lastUpdateTime: number;
  }> = new Map();
  
  private realtimeMetricsInterval: NodeJS.Timeout | null = null;
  private bottleneckAnalysisInterval: NodeJS.Timeout | null = null;

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
    
    // Initialize performance optimization (SRS NFR-1)
    this.performanceOptimizer = new PerformanceOptimizer({
      targetUpdateTime: 100, // 100ms per SRS NFR-1
      cacheSize: 1000,
      enableProfiling: true,
      optimizationLevel: 'aggressive',
      batchSize: 50
    });
    
    this.performanceMonitoring = new PerformanceMonitoringService(this.performanceOptimizer);

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
      
      // Initialize request tracking for real-time metrics
      this.requestTracking.set(component.id, {
        arrivals: [],
        completions: [],
        failures: [],
        latencies: [],
        lastUpdateTime: Date.now()
      });
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
    this.state.isPaused = false;
    this.state.startTime = Date.now();
    this.state.endTime = this.state.startTime + (this.workspace.configuration.duration * 1000);

    // Start metrics collection
    this.metricsCollector.start();

    // Start bottleneck monitoring
    this.bottleneckReporter.start();
    
    // Start performance monitoring (SRS NFR-1)
    this.performanceMonitoring.startMonitoring(1000); // Monitor every second

    // Schedule initial events
    this.scheduleInitialEvents();

    // Start simulation loop
    this.runSimulationLoop();
    
    // Start real-time metrics streaming (sub-100ms updates per SRS NFR-1)
    this.startRealtimeMetricsStreaming();
    
    // Start continuous bottleneck analysis
    this.startContinuousBottleneckAnalysis();

    this.emit('started', { 
      workspaceId: this.workspace.id,
      duration: this.workspace.configuration.duration 
    });
  }

  /**
   * Pause the simulation without clearing scheduled events
   */
  pause(): void {
    if (!this.state.isRunning || this.state.isPaused) {
      return;
    }

    this.state.isRunning = false;
    this.state.isPaused = true;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    // Stop real-time metrics streaming
    this.stopRealtimeMetricsStreaming();
    
    // Stop continuous bottleneck analysis
    this.stopContinuousBottleneckAnalysis();

    // Stop background services while paused
    this.metricsCollector.stop();
    this.bottleneckReporter.stop();
    this.performanceMonitoring.stopMonitoring();

    this.emit('paused', {
      workspaceId: this.workspace?.id,
      eventCount: this.state.eventCount,
      currentTime: this.state.currentTime
    });
  }

  /**
   * Resume a previously paused simulation
   */
  resume(): void {
    if (!this.workspace || !this.state.isPaused) {
      return;
    }

    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;
    this.state.isPaused = false;

    // Restart background services
    this.metricsCollector.start();
    this.bottleneckReporter.start();
    this.performanceMonitoring.startMonitoring(1000);
    
    // Restart real-time metrics streaming
    this.startRealtimeMetricsStreaming();
    
    // Restart continuous bottleneck analysis
    this.startContinuousBottleneckAnalysis();

    // Continue processing remaining scheduled events
    this.runSimulationLoop();

    this.emit('resumed', {
      workspaceId: this.workspace.id,
      currentTime: this.state.currentTime
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
    
    // Stop real-time metrics streaming
    this.stopRealtimeMetricsStreaming();
    
    // Stop continuous bottleneck analysis
    this.stopContinuousBottleneckAnalysis();

    // Stop metrics collection
    this.metricsCollector.stop();

    // Stop bottleneck monitoring
    this.bottleneckReporter.stop();
    
    // Stop performance monitoring
    this.performanceMonitoring.stopMonitoring();

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
   * Get performance dashboard (SRS NFR-1)
   */
  getPerformanceDashboard() {
    return this.performanceMonitoring.getPerformanceDashboard();
  }
  
  /**
   * Get optimized metrics with sub-100ms performance (SRS NFR-1)
   */
  async getOptimizedMetrics() {
    const rawMetrics = new Map<string, ComponentMetrics[]>();
    
    // Collect raw metrics for all components
    this.state.components.forEach((_, componentId) => {
      const metrics = this.state.metrics.get(componentId) || [];
      rawMetrics.set(componentId, metrics);
    });
    
    // Use performance optimizer for sub-100ms updates
    return await this.performanceOptimizer.optimizeSimulationUpdate(
      this.workspace!,
      rawMetrics
    );
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
      isPaused: false,
      startTime: 0,
      endTime: 0,
      eventCount: 0,
      components: new Map(),
      metrics: new Map(),
      isCollapsed: false
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

    // Check if component is at capacity - reject requests if so
    const isAtCapacity = component.currentLoad >= component.configuration.capacity;
    const queueFull = component.queueDepth >= (component.configuration.capacity * 2);
    
    if (queueFull) {
      // Request dropped due to queue overflow
      const tracking = this.requestTracking.get(event.componentId);
      if (tracking) {
        tracking.failures.push(event.timestamp);
      }
      this.emit('request_dropped', { 
        componentId: event.componentId, 
        reason: 'queue_full',
        timestamp: event.timestamp 
      });
      return;
    }

    component.currentLoad++;
    component.queueDepth++;

    // Track arrival
    const tracking = this.requestTracking.get(event.componentId);
    if (tracking) {
      tracking.arrivals.push(event.timestamp);
    }

    // Calculate processing time based on current load and capacity
    const processingTime = this.calculateProcessingTime(component);
    
    // Check for errors based on capacity and health
    const errorProbability = this.calculateErrorProbability(component);
    const willFail = Math.random() < errorProbability;
    
    if (willFail || !component.isHealthy) {
      // Schedule immediate failure
      this.scheduleEvent('request_completion', event.componentId, 
        event.timestamp + processingTime * 0.1, { 
          requestId: event.id,
          failed: true,
          errorReason: !component.isHealthy ? 'component_unhealthy' : 'capacity_exceeded'
        });
      
      if (tracking) {
        tracking.failures.push(event.timestamp);
      }
    } else {
      // Schedule successful completion
      this.scheduleEvent('request_completion', event.componentId, 
        event.timestamp + processingTime, { 
          requestId: event.id,
          failed: false,
          arrivalTime: event.timestamp
        });
    }

    this.emit('request_arrived', { componentId: event.componentId, timestamp: event.timestamp });
  }

  /**
   * Handle request completion at a component
   */
  private handleRequestCompletion(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    const wasFailure = event.data?.failed === true;
    const arrivalTime = event.data?.arrivalTime || event.timestamp;
    const processingLatency = event.timestamp - arrivalTime;

    component.currentLoad = Math.max(0, component.currentLoad - 1);
    component.queueDepth = Math.max(0, component.queueDepth - 1);

    // Track completion and latency
    const tracking = this.requestTracking.get(event.componentId);
    if (tracking) {
      if (wasFailure) {
        tracking.failures.push(event.timestamp);
      } else {
        tracking.completions.push(event.timestamp);
        tracking.latencies.push(processingLatency);
      }
    }

    // Only route to next components if request succeeded
    if (!wasFailure) {
      this.routeRequestToNextComponents(event.componentId, event.timestamp);
    }

    this.emit('request_completed', { 
      componentId: event.componentId, 
      timestamp: event.timestamp,
      success: !wasFailure,
      latency: processingLatency
    });
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
   * Enhanced to compute metrics based on actual request processing (SRS FR-4, FR-5, FR-7)
   */
  private handleMetricsCollection(event: SimulationEvent): void {
    const component = this.state.components.get(event.componentId);
    if (!component) return;

    const tracking = this.requestTracking.get(event.componentId);
    if (!tracking) return;

    const now = event.timestamp;
    const windowMs = 1000; // 1 second window for RPS calculation
    const windowStart = now - windowMs;

    // Calculate actual throughput based on completed requests
    const recentCompletions = tracking.completions.filter(t => t >= windowStart);
    const recentFailures = tracking.failures.filter(t => t >= windowStart);
    const recentArrivals = tracking.arrivals.filter(t => t >= windowStart);
    
    const totalRequests = recentCompletions.length + recentFailures.length;
    const requestsPerSecond = totalRequests; // Already filtered to 1-second window
    
    // Calculate actual error rate
    const errorRate = totalRequests > 0 ? recentFailures.length / totalRequests : 0;
    
    // Calculate actual latency from tracked latencies
    const recentLatencies = tracking.latencies.filter((_, idx) => {
      const completionTime = tracking.completions[idx];
      return completionTime >= windowStart;
    });
    const averageLatency = recentLatencies.length > 0
      ? recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length
      : component.configuration.latency;
    
    // Calculate percentiles for latency
    const sortedLatencies = [...recentLatencies].sort((a, b) => a - b);
    const p50Latency = sortedLatencies.length > 0 
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] 
      : averageLatency;
    const p95Latency = sortedLatencies.length > 0 
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] 
      : averageLatency;
    const p99Latency = sortedLatencies.length > 0 
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] 
      : averageLatency;

    // Get failure impact on performance
    const failureImpact = this.failureManager.getFailureImpact(event.componentId);
    const failureStats = this.failureManager.getFailureStatistics(event.componentId);

    // Calculate resource utilization based on actual load
    const capacity = component.configuration.capacity;
    const utilization = Math.min(1.0, component.currentLoad / capacity);
    const cpuUtilization = utilization * (1.0 / failureImpact.performanceMultiplier);
    const memoryUtilization = Math.min(1.0, component.queueDepth / (capacity * 2));

    // Adjust metrics based on failure impact
    const adjustedLatency = averageLatency * (1.0 / failureImpact.performanceMultiplier);
    const adjustedErrorRate = Math.min(1.0, errorRate * failureImpact.errorRateMultiplier);
    const adjustedThroughput = requestsPerSecond * failureImpact.availabilityMultiplier;

    const metrics: ComponentMetrics = {
      componentId: event.componentId,
      timestamp: event.timestamp,
      requestsPerSecond: adjustedThroughput,
      averageLatency: adjustedLatency,
      errorRate: adjustedErrorRate,
      cpuUtilization: Math.min(0.99, cpuUtilization),
      memoryUtilization: Math.min(0.99, memoryUtilization),
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
      p50Latency,
      p95Latency,
      p99Latency,
      failureImpact,
      failureStats
    });
    
    // Cleanup old tracking data (keep last 10 seconds)
    const cleanupThreshold = now - 10000;
    tracking.arrivals = tracking.arrivals.filter(t => t >= cleanupThreshold);
    tracking.completions = tracking.completions.filter(t => t >= cleanupThreshold);
    tracking.failures = tracking.failures.filter(t => t >= cleanupThreshold);
    tracking.latencies = tracking.latencies.slice(-1000); // Keep last 1000 latencies
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
   * Implements realistic latency degradation under load (SRS FR-4, FR-5)
   */
  private calculateProcessingTime(component: any): number {
    const baseLatency = component.configuration.latency;
    const capacity = component.configuration.capacity;
    const currentLoad = component.currentLoad;
    
    // Calculate utilization ratio
    const utilization = Math.min(1.0, currentLoad / capacity);
    
    // Latency increases exponentially as utilization approaches capacity
    // This models realistic queueing behavior
    let loadFactor = 1.0;
    if (utilization < 0.5) {
      // Low load: minimal impact
      loadFactor = 1.0 + (utilization * 0.2);
    } else if (utilization < 0.8) {
      // Medium load: moderate degradation
      loadFactor = 1.1 + ((utilization - 0.5) * 0.3) * 2;
    } else if (utilization < 0.95) {
      // High load: significant degradation
      loadFactor = 1.3 + ((utilization - 0.8) * 0.15) * 5;
    } else {
      // Critical load: severe degradation
      loadFactor = 2.0 + ((utilization - 0.95) * 0.05) * 20;
    }
    
    // Add queue depth impact
    const queueImpact = Math.min(0.5, component.queueDepth / (capacity * 2));
    loadFactor += queueImpact;
    
    const randomFactor = 0.9 + Math.random() * 0.2; // ±10% variation
    
    // Apply failure impact
    const failureImpact = this.failureManager.getFailureImpact(component.id);
    const failureMultiplier = 1.0 / failureImpact.performanceMultiplier;
    
    return baseLatency * loadFactor * randomFactor * failureMultiplier;
  }
  
  /**
   * Calculate error probability based on component state and load
   * Implements realistic error rates when capacity is exceeded (SRS FR-4, FR-5)
   */
  private calculateErrorProbability(component: any): number {
    const baseErrorRate = component.configuration.failureRate || 0.001;
    const capacity = component.configuration.capacity;
    const currentLoad = component.currentLoad;
    const utilization = Math.min(1.0, currentLoad / capacity);
    
    // Error rate increases significantly when capacity is exceeded
    let errorMultiplier = 1.0;
    if (utilization >= 1.0) {
      // Over capacity: high error rate
      errorMultiplier = 10.0 + (utilization - 1.0) * 50;
    } else if (utilization >= 0.95) {
      // Near capacity: moderate error rate
      errorMultiplier = 2.0 + ((utilization - 0.95) / 0.05) * 8;
    } else if (utilization >= 0.8) {
      // High load: slight increase
      errorMultiplier = 1.2 + ((utilization - 0.8) / 0.15) * 0.8;
    }
    
    // Component health impact
    if (!component.isHealthy) {
      errorMultiplier *= 10;
    }
    
    // Apply failure impact
    const failureImpact = this.failureManager.getFailureImpact(component.id);
    errorMultiplier *= failureImpact.errorRateMultiplier;
    
    return Math.min(0.95, baseErrorRate * errorMultiplier);
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
  
  /**
   * Start real-time metrics streaming (sub-100ms updates per SRS NFR-1)
   */
  private startRealtimeMetricsStreaming(): void {
    if (this.realtimeMetricsInterval) return;
    
    // Stream metrics every 100ms for real-time updates
    this.realtimeMetricsInterval = setInterval(() => {
      if (!this.workspace || !this.state.isRunning) return;
      
      // Compute and emit metrics for all components
      this.workspace.components.forEach(component => {
        const tracking = this.requestTracking.get(component.id);
        if (!tracking) return;
        
        const now = Date.now();
        const windowMs = 1000;
        const windowStart = now - windowMs;
        
        // Calculate real-time metrics
        const recentCompletions = tracking.completions.filter(t => t >= windowStart);
        const recentFailures = tracking.failures.filter(t => t >= windowStart);
        const recentLatencies = tracking.latencies.filter((_, idx) => {
          const completionTime = tracking.completions[idx];
          return completionTime >= windowStart;
        });
        
        const totalRequests = recentCompletions.length + recentFailures.length;
        const requestsPerSecond = totalRequests;
        const errorRate = totalRequests > 0 ? recentFailures.length / totalRequests : 0;
        const avgLatency = recentLatencies.length > 0
          ? recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length
          : component.configuration.latency;
        
        const compState = this.state.components.get(component.id);
        if (!compState) return;
        
        const capacity = component.configuration.capacity;
        const cpuUtilization = Math.min(1.0, compState.currentLoad / capacity);
        const memoryUtilization = Math.min(1.0, compState.queueDepth / (capacity * 2));
        
        const metrics: ComponentMetrics = {
          componentId: component.id,
          timestamp: now,
          requestsPerSecond,
          averageLatency: avgLatency,
          errorRate,
          cpuUtilization,
          memoryUtilization,
          queueDepth: compState.queueDepth
        };
        
        // Emit real-time component metrics
        this.emit('metrics_collected', metrics);
      });
      
      // Compute and emit system-wide metrics
      const systemMetrics = this.computeSystemMetrics();
      if (systemMetrics) {
        this.metricsCollector.emit('metrics_aggregated', {
          timestamp: Date.now(),
          componentCount: this.workspace.components.length,
          systemMetrics
        });
      }
      
      // Check for system collapse
      this.detectSystemCollapse();
      
    }, 100); // 100ms interval for sub-100ms updates
  }
  
  /**
   * Stop real-time metrics streaming
   */
  private stopRealtimeMetricsStreaming(): void {
    if (this.realtimeMetricsInterval) {
      clearInterval(this.realtimeMetricsInterval);
      this.realtimeMetricsInterval = null;
    }
  }
  
  /**
   * Start continuous bottleneck analysis
   */
  private startContinuousBottleneckAnalysis(): void {
    if (this.bottleneckAnalysisInterval) return;
    
    // Run bottleneck analysis every 2 seconds
    this.bottleneckAnalysisInterval = setInterval(() => {
      if (!this.workspace || !this.state.isRunning) return;
      this.performBottleneckAnalysis();
    }, 2000);
  }
  
  /**
   * Stop continuous bottleneck analysis
   */
  private stopContinuousBottleneckAnalysis(): void {
    if (this.bottleneckAnalysisInterval) {
      clearInterval(this.bottleneckAnalysisInterval);
      this.bottleneckAnalysisInterval = null;
    }
  }
  
  /**
   * Compute system-wide metrics from component metrics
   */
  private computeSystemMetrics(): SystemMetrics | null {
    if (!this.workspace) return null;
    
    const componentMetricsMap = new Map<string, ComponentMetrics>();
    let totalThroughput = 0;
    let totalLatency = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    let totalQueueDepth = 0;
    let healthyComponents = 0;
    
    this.workspace.components.forEach(component => {
      const compState = this.state.components.get(component.id);
      if (!compState) return;
      
      const tracking = this.requestTracking.get(component.id);
      if (!tracking) return;
      
      const now = Date.now();
      const windowMs = 1000;
      const windowStart = now - windowMs;
      
      const recentCompletions = tracking.completions.filter(t => t >= windowStart);
      const recentFailures = tracking.failures.filter(t => t >= windowStart);
      const recentLatencies = tracking.latencies.filter((_, idx) => {
        const completionTime = tracking.completions[idx];
        return completionTime >= windowStart;
      });
      
      const componentRequests = recentCompletions.length + recentFailures.length;
      const componentThroughput = componentRequests;
      const componentLatency = recentLatencies.length > 0
        ? recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length
        : component.configuration.latency;
      
      totalThroughput += componentThroughput;
      totalLatency += componentLatency;
      totalErrors += recentFailures.length;
      totalRequests += componentRequests;
      totalQueueDepth += compState.queueDepth;
      
      if (compState.isHealthy) {
        healthyComponents++;
      }
      
      const metrics: ComponentMetrics = {
        componentId: component.id,
        timestamp: now,
        requestsPerSecond: componentThroughput,
        averageLatency: componentLatency,
        errorRate: componentRequests > 0 ? recentFailures.length / componentRequests : 0,
        cpuUtilization: Math.min(1.0, compState.currentLoad / component.configuration.capacity),
        memoryUtilization: Math.min(1.0, compState.queueDepth / (component.configuration.capacity * 2)),
        queueDepth: compState.queueDepth
      };
      
      componentMetricsMap.set(component.id, metrics);
    });
    
    const componentCount = this.workspace.components.length;
    const averageLatency = componentCount > 0 ? totalLatency / componentCount : 0;
    const systemErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    // Convert ComponentMetrics to AggregatedMetrics format
    const aggregatedMetricsMap = new Map<string, AggregatedMetrics>();
    componentMetricsMap.forEach((metrics, componentId) => {
      const aggregated: AggregatedMetrics = {
        componentId,
        timeWindow: 1000,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        requestsPerSecond: {
          min: metrics.requestsPerSecond,
          max: metrics.requestsPerSecond,
          avg: metrics.requestsPerSecond,
          p50: metrics.requestsPerSecond,
          p95: metrics.requestsPerSecond,
          p99: metrics.requestsPerSecond
        },
        latency: {
          min: metrics.averageLatency,
          max: metrics.averageLatency,
          avg: metrics.averageLatency,
          p50: metrics.averageLatency,
          p95: metrics.averageLatency,
          p99: metrics.averageLatency
        },
        errorRate: {
          min: metrics.errorRate,
          max: metrics.errorRate,
          avg: metrics.errorRate
        },
        resourceUtilization: {
          cpu: {
            min: metrics.cpuUtilization,
            max: metrics.cpuUtilization,
            avg: metrics.cpuUtilization
          },
          memory: {
            min: metrics.memoryUtilization,
            max: metrics.memoryUtilization,
            avg: metrics.memoryUtilization
          }
        },
        queueDepth: {
          min: metrics.queueDepth,
          max: metrics.queueDepth,
          avg: metrics.queueDepth
        },
        totalRequests: Math.round(metrics.requestsPerSecond),
        totalErrors: Math.round(metrics.requestsPerSecond * metrics.errorRate)
      };
      aggregatedMetricsMap.set(componentId, aggregated);
    });
    
    return {
      timestamp: Date.now(),
      totalThroughput,
      averageLatency,
      systemErrorRate,
      activeComponents: componentCount,
      healthyComponents,
      totalQueueDepth,
      componentMetrics: aggregatedMetricsMap
    };
  }
  
  /**
   * Detect system collapse based on error rates and component failures (SRS FR-5.4)
   */
  private detectSystemCollapse(): void {
    if (!this.workspace) return;
    
    const systemMetrics = this.computeSystemMetrics();
    if (!systemMetrics) return;
    
    // System collapse criteria:
    // 1. System error rate > 50%
    // 2. More than 50% of components unhealthy
    // 3. Total queue depth exceeds critical threshold
    const errorRateThreshold = 0.5;
    const unhealthyComponentThreshold = 0.5;
    const criticalQueueDepth = this.workspace.components.reduce((sum, comp) => {
      const capacity = comp.configuration.capacity;
      return sum + (capacity * 3); // 3x capacity is critical
    }, 0);
    
    const unhealthyRatio = 1 - (systemMetrics.healthyComponents / systemMetrics.activeComponents);
    const isCollapsed = 
      systemMetrics.systemErrorRate > errorRateThreshold ||
      unhealthyRatio > unhealthyComponentThreshold ||
      systemMetrics.totalQueueDepth > criticalQueueDepth;
    
    if (isCollapsed && !this.state.isCollapsed) {
      this.state.isCollapsed = true;
      this.emit('system_collapse', {
        timestamp: Date.now(),
        reason: systemMetrics.systemErrorRate > errorRateThreshold 
          ? 'high_error_rate' 
          : unhealthyRatio > unhealthyComponentThreshold
          ? 'component_failures'
          : 'queue_overflow',
        systemMetrics,
        unhealthyComponents: systemMetrics.activeComponents - systemMetrics.healthyComponents,
        errorRate: systemMetrics.systemErrorRate
      });
    } else if (!isCollapsed && this.state.isCollapsed) {
      this.state.isCollapsed = false;
      this.emit('system_recovery', {
        timestamp: Date.now(),
        systemMetrics
      });
    }
  }
}