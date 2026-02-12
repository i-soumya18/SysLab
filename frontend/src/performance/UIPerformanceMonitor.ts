/**
 * UI Performance Monitoring Service
 * 
 * Implements SRS NFR-2: Add UI performance monitoring per SRS NFR-2
 * Monitors UI interactions and provides real-time performance feedback
 */

export interface UIPerformanceMetrics {
  frameRate: number;
  renderTime: number;
  interactionLatency: number;
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
  paintTime: number;
  layoutTime: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  category: 'fps' | 'render' | 'interaction' | 'memory' | 'dom';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  suggestions: string[];
}

export interface UIPerformanceConfig {
  targetFPS: number;
  maxRenderTime: number;
  maxInteractionLatency: number;
  maxMemoryUsage: number;
  maxDOMNodes: number;
  enableAlerts: boolean;
  enableProfiling: boolean;
  sampleInterval: number;
}

export class UIPerformanceMonitor {
  private config: UIPerformanceConfig;
  private metrics: UIPerformanceMetrics;
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private frameCount: number = 0;
  private lastFrameTime: number = performance.now();
  private renderTimes: number[] = [];
  private interactionTimes: number[] = [];
  private isMonitoring: boolean = false;
  private callbacks: {
    onMetricsUpdate?: (metrics: UIPerformanceMetrics) => void;
    onAlert?: (alert: PerformanceAlert) => void;
  } = {};

  constructor(config: Partial<UIPerformanceConfig> = {}) {
    this.config = {
      targetFPS: 60,
      maxRenderTime: 16, // 16ms for 60fps
      maxInteractionLatency: 100, // 100ms per SRS NFR-2
      maxMemoryUsage: 100, // 100MB
      maxDOMNodes: 1000,
      enableAlerts: true,
      enableProfiling: true,
      sampleInterval: 1000,
      ...config
    };

    this.metrics = {
      frameRate: 60,
      renderTime: 0,
      interactionLatency: 0,
      memoryUsage: 0,
      domNodes: 0,
      eventListeners: 0,
      paintTime: 0,
      layoutTime: 0
    };

    this.setupPerformanceObservers();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startFrameRateMonitoring();
    this.startMemoryMonitoring();
    this.startDOMMonitoring();
    this.startInteractionMonitoring();

    console.log('UI Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    console.log('UI Performance monitoring stopped');
  }

  /**
   * Set performance callbacks
   */
  setCallbacks(callbacks: {
    onMetricsUpdate?: (metrics: UIPerformanceMetrics) => void;
    onAlert?: (alert: PerformanceAlert) => void;
  }): void {
    this.callbacks = callbacks;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): UIPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear performance alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Record render time
   */
  recordRenderTime(startTime: number, endTime?: number): void {
    const renderTime = (endTime || performance.now()) - startTime;
    this.renderTimes.push(renderTime);
    
    // Keep only recent samples
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    // Update metrics
    this.metrics.renderTime = this.calculateAverage(this.renderTimes);

    // Check for performance issues
    if (renderTime > this.config.maxRenderTime) {
      this.createAlert(
        'warning',
        'render',
        `Render time exceeded ${this.config.maxRenderTime}ms`,
        renderTime,
        this.config.maxRenderTime,
        ['Reduce component complexity', 'Enable virtualization', 'Optimize re-renders']
      );
    }

    this.updateMetrics();
  }

  /**
   * Record interaction latency
   */
  recordInteractionLatency(startTime: number, endTime?: number): void {
    const latency = (endTime || performance.now()) - startTime;
    this.interactionTimes.push(latency);
    
    // Keep only recent samples
    if (this.interactionTimes.length > 50) {
      this.interactionTimes.shift();
    }

    // Update metrics
    this.metrics.interactionLatency = this.calculateAverage(this.interactionTimes);

    // Check for performance issues
    if (latency > this.config.maxInteractionLatency) {
      this.createAlert(
        'warning',
        'interaction',
        `Interaction latency exceeded ${this.config.maxInteractionLatency}ms`,
        latency,
        this.config.maxInteractionLatency,
        ['Debounce user inputs', 'Use optimistic updates', 'Reduce computation in event handlers']
      );
    }

    this.updateMetrics();
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(): void {
    if (!this.config.enableProfiling || !window.PerformanceObserver) return;

    // Paint timing observer
    try {
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.paintTime = entry.startTime;
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);
    } catch (error) {
      console.warn('Paint observer not supported:', error);
    }

    // Layout shift observer
    try {
      const layoutObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'layout-shift') {
            this.metrics.layoutTime = entry.startTime;
          }
        });
      });
      layoutObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(layoutObserver);
    } catch (error) {
      console.warn('Layout observer not supported:', error);
    }

    // Long task observer
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.createAlert(
              'warning',
              'render',
              `Long task detected: ${entry.duration.toFixed(1)}ms`,
              entry.duration,
              50,
              ['Break up long tasks', 'Use requestIdleCallback', 'Implement time slicing']
            );
          }
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (error) {
      console.warn('Long task observer not supported:', error);
    }
  }

  /**
   * Start frame rate monitoring
   */
  private startFrameRateMonitoring(): void {
    const measureFrameRate = () => {
      if (!this.isMonitoring) return;

      this.frameCount++;
      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;

      if (deltaTime >= 1000) { // Update every second
        const fps = Math.round((this.frameCount * 1000) / deltaTime);
        this.metrics.frameRate = fps;
        
        // Check for low FPS
        if (fps < this.config.targetFPS * 0.8) { // 80% of target FPS
          this.createAlert(
            fps < this.config.targetFPS * 0.5 ? 'critical' : 'warning',
            'fps',
            `Frame rate dropped to ${fps} FPS`,
            fps,
            this.config.targetFPS,
            ['Reduce visual complexity', 'Enable hardware acceleration', 'Optimize animations']
          );
        }

        this.frameCount = 0;
        this.lastFrameTime = now;
        this.updateMetrics();
      }

      requestAnimationFrame(measureFrameRate);
    };

    requestAnimationFrame(measureFrameRate);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    const measureMemory = () => {
      if (!this.isMonitoring) return;

      // Use performance.memory if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        this.metrics.memoryUsage = usedMB;

        // Check for high memory usage
        if (usedMB > this.config.maxMemoryUsage) {
          this.createAlert(
            usedMB > this.config.maxMemoryUsage * 1.5 ? 'critical' : 'warning',
            'memory',
            `Memory usage: ${usedMB.toFixed(1)}MB`,
            usedMB,
            this.config.maxMemoryUsage,
            ['Clear unused data', 'Implement data virtualization', 'Check for memory leaks']
          );
        }
      }

      setTimeout(measureMemory, this.config.sampleInterval);
    };

    measureMemory();
  }

  /**
   * Start DOM monitoring
   */
  private startDOMMonitoring(): void {
    const measureDOM = () => {
      if (!this.isMonitoring) return;

      // Count DOM nodes
      const nodeCount = document.querySelectorAll('*').length;
      this.metrics.domNodes = nodeCount;

      // Estimate event listeners (rough approximation)
      const elementsWithListeners = document.querySelectorAll('[onclick], [onchange], [onsubmit]').length;
      this.metrics.eventListeners = elementsWithListeners;

      // Check for excessive DOM nodes
      if (nodeCount > this.config.maxDOMNodes) {
        this.createAlert(
          nodeCount > this.config.maxDOMNodes * 2 ? 'critical' : 'warning',
          'dom',
          `DOM node count: ${nodeCount}`,
          nodeCount,
          this.config.maxDOMNodes,
          ['Implement virtual scrolling', 'Remove unused elements', 'Optimize component structure']
        );
      }

      setTimeout(measureDOM, this.config.sampleInterval);
    };

    measureDOM();
  }

  /**
   * Start interaction monitoring
   */
  private startInteractionMonitoring(): void {
    const interactionTypes = ['click', 'keydown', 'scroll', 'touchstart'];

    interactionTypes.forEach(eventType => {
      document.addEventListener(eventType, () => {
        const startTime = performance.now();

        // Measure time to next frame
        requestAnimationFrame(() => {
          this.recordInteractionLatency(startTime);
        });
      }, { passive: true });
    });
  }

  /**
   * Create performance alert
   */
  private createAlert(
    type: 'warning' | 'critical',
    category: 'fps' | 'render' | 'interaction' | 'memory' | 'dom',
    message: string,
    value: number,
    threshold: number,
    suggestions: string[]
  ): void {
    if (!this.config.enableAlerts) return;

    const alert: PerformanceAlert = {
      type,
      category,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      suggestions
    };

    // Avoid duplicate alerts
    const isDuplicate = this.alerts.some(existing => 
      existing.category === category && 
      existing.type === type &&
      Date.now() - existing.timestamp < 5000 // Within 5 seconds
    );

    if (!isDuplicate) {
      this.alerts.push(alert);
      
      // Keep only recent alerts
      if (this.alerts.length > 50) {
        this.alerts.shift();
      }

      // Notify callback
      if (this.callbacks.onAlert) {
        this.callbacks.onAlert(alert);
      }

      console.warn(`UI Performance Alert [${type.toUpperCase()}]:`, message);
    }
  }

  /**
   * Update metrics and notify callbacks
   */
  private updateMetrics(): void {
    if (this.callbacks.onMetricsUpdate) {
      this.callbacks.onMetricsUpdate(this.metrics);
    }
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.frameRate < this.config.targetFPS * 0.8) {
      recommendations.push('Optimize rendering performance to improve frame rate');
    }

    if (this.metrics.renderTime > this.config.maxRenderTime) {
      recommendations.push('Reduce component complexity to improve render times');
    }

    if (this.metrics.interactionLatency > this.config.maxInteractionLatency) {
      recommendations.push('Implement optimistic updates for better interaction responsiveness');
    }

    if (this.metrics.memoryUsage > this.config.maxMemoryUsage) {
      recommendations.push('Implement data virtualization to reduce memory usage');
    }

    if (this.metrics.domNodes > this.config.maxDOMNodes) {
      recommendations.push('Use virtual scrolling for large lists');
    }

    return recommendations;
  }

  /**
   * Export performance data
   */
  exportData(): {
    metrics: UIPerformanceMetrics;
    alerts: PerformanceAlert[];
    config: UIPerformanceConfig;
    recommendations: string[];
    timestamp: number;
  } {
    return {
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      config: this.config,
      recommendations: this.getRecommendations(),
      timestamp: Date.now()
    };
  }
}

/**
 * React hook for UI performance monitoring
 */
export const useUIPerformanceMonitor = (config?: Partial<UIPerformanceConfig>) => {
  const [monitor] = React.useState(() => new UIPerformanceMonitor(config));
  const [metrics, setMetrics] = React.useState<UIPerformanceMetrics>(monitor.getMetrics());
  const [alerts, setAlerts] = React.useState<PerformanceAlert[]>([]);

  React.useEffect(() => {
    monitor.setCallbacks({
      onMetricsUpdate: setMetrics,
      onAlert: (alert) => setAlerts(prev => [...prev, alert])
    });

    monitor.startMonitoring();

    return () => {
      monitor.stopMonitoring();
    };
  }, [monitor]);

  const recordRenderTime = React.useCallback((startTime: number, endTime?: number) => {
    monitor.recordRenderTime(startTime, endTime);
  }, [monitor]);

  const recordInteractionLatency = React.useCallback((startTime: number, endTime?: number) => {
    monitor.recordInteractionLatency(startTime, endTime);
  }, [monitor]);

  const clearAlerts = React.useCallback(() => {
    monitor.clearAlerts();
    setAlerts([]);
  }, [monitor]);

  return {
    metrics,
    alerts,
    recordRenderTime,
    recordInteractionLatency,
    clearAlerts,
    getRecommendations: () => monitor.getRecommendations(),
    exportData: () => monitor.exportData()
  };
};

// Import React for the hook
import React from 'react';