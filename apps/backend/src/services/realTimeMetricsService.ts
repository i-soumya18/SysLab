/**
 * Real-Time Metrics Service
 * 
 * Implements SRS FR-5.2 and NFR-1: Sub-100ms metric update system with real-time 
 * performance monitoring and live metric streaming via WebSocket
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { MetricsCollector, AggregatedMetrics, SystemMetrics } from '../simulation/MetricsCollector';
import { MetricsStorage } from '../simulation/MetricsStorage';
import { ComponentMetrics } from '../types';

export interface RealTimeMetricsConfig {
  updateInterval: number; // milliseconds (target: <100ms per SRS NFR-1)
  bufferSize: number;
  enableCompression: boolean;
  maxClientsPerWorkspace: number;
}

export interface MetricsUpdate {
  timestamp: number;
  workspaceId: string;
  type: 'component' | 'system' | 'aggregated';
  data: ComponentMetrics | SystemMetrics | AggregatedMetrics;
}

export interface MetricsSubscription {
  workspaceId: string;
  componentIds?: string[];
  updateTypes: ('component' | 'system' | 'aggregated')[];
  clientId: string;
}

export class RealTimeMetricsService extends EventEmitter {
  private config: RealTimeMetricsConfig;
  private metricsCollector: MetricsCollector;
  private metricsStorage: MetricsStorage;
  private clients: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, MetricsSubscription> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private metricsBuffer: Map<string, MetricsUpdate[]> = new Map();
  private performanceTracker: PerformanceTracker;

  constructor(config: RealTimeMetricsConfig) {
    super();
    this.config = config;
    this.metricsCollector = new MetricsCollector();
    this.metricsStorage = new MetricsStorage();
    this.performanceTracker = new PerformanceTracker();
    
    this.setupMetricsCollectorEvents();
  }

  /**
   * Subscribe client to real-time metrics updates
   */
  subscribe(ws: WebSocket, subscription: MetricsSubscription): void {
    const clientId = subscription.clientId;
    
    // Store client connection
    this.clients.set(clientId, ws);
    this.subscriptions.set(clientId, subscription);
    
    // Initialize metrics buffer for this client
    this.metricsBuffer.set(clientId, []);
    
    // Start real-time updates for this workspace if not already started
    this.startRealTimeUpdates(subscription.workspaceId);
    
    // Handle client disconnect
    ws.on('close', () => {
      this.unsubscribe(clientId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.unsubscribe(clientId);
    });
    
    this.emit('client_subscribed', { clientId, workspaceId: subscription.workspaceId });
  }

  /**
   * Unsubscribe client from real-time metrics updates
   */
  unsubscribe(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    
    this.clients.delete(clientId);
    this.subscriptions.delete(clientId);
    this.metricsBuffer.delete(clientId);
    
    // Stop updates for workspace if no more clients
    if (subscription) {
      const workspaceClients = Array.from(this.subscriptions.values())
        .filter(sub => sub.workspaceId === subscription.workspaceId);
      
      if (workspaceClients.length === 0) {
        this.stopRealTimeUpdates(subscription.workspaceId);
      }
    }
    
    this.emit('client_unsubscribed', { clientId });
  }

  /**
   * Start real-time metrics collection and streaming for a workspace
   */
  private startRealTimeUpdates(workspaceId: string): void {
    if (this.updateIntervals.has(workspaceId)) {
      return; // Already started
    }

    const interval = setInterval(() => {
      this.collectAndBroadcastMetrics(workspaceId);
    }, this.config.updateInterval);

    this.updateIntervals.set(workspaceId, interval);
    this.emit('real_time_updates_started', { workspaceId });
  }

  /**
   * Stop real-time updates for a workspace
   */
  private stopRealTimeUpdates(workspaceId: string): void {
    const interval = this.updateIntervals.get(workspaceId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(workspaceId);
      this.emit('real_time_updates_stopped', { workspaceId });
    }
  }

  /**
   * Collect and broadcast metrics to subscribed clients
   * Target: <100ms execution time per SRS NFR-1
   */
  private async collectAndBroadcastMetrics(workspaceId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Get workspace clients
      const workspaceClients = Array.from(this.subscriptions.entries())
        .filter(([_, sub]) => sub.workspaceId === workspaceId);

      if (workspaceClients.length === 0) return;

      // Collect latest metrics
      const componentMetrics = this.metricsStorage.getLatestRawMetricsForWorkspace(workspaceId);
      const systemMetrics = this.metricsStorage.getLatestSystemMetrics();
      const aggregatedMetrics = this.metricsStorage.getLatestAggregatedMetricsForWorkspace(workspaceId);

      const timestamp = Date.now();

      // Prepare updates for each client based on their subscription
      const updates: Map<string, MetricsUpdate[]> = new Map();

      for (const [clientId, subscription] of workspaceClients) {
        const clientUpdates: MetricsUpdate[] = [];

        // Component metrics
        if (subscription.updateTypes.includes('component')) {
          for (const [componentId, metrics] of componentMetrics) {
            if (!subscription.componentIds || subscription.componentIds.includes(componentId)) {
              clientUpdates.push({
                timestamp,
                workspaceId,
                type: 'component',
                data: metrics
              });
            }
          }
        }

        // System metrics
        if (subscription.updateTypes.includes('system') && systemMetrics) {
          clientUpdates.push({
            timestamp,
            workspaceId,
            type: 'system',
            data: systemMetrics
          });
        }

        // Aggregated metrics
        if (subscription.updateTypes.includes('aggregated')) {
          for (const [componentId, metrics] of aggregatedMetrics) {
            if (!subscription.componentIds || subscription.componentIds.includes(componentId)) {
              clientUpdates.push({
                timestamp,
                workspaceId,
                type: 'aggregated',
                data: metrics
              });
            }
          }
        }

        updates.set(clientId, clientUpdates);
      }

      // Broadcast updates to clients
      await this.broadcastUpdates(updates);

      // Track performance
      const executionTime = performance.now() - startTime;
      this.performanceTracker.recordUpdateTime(executionTime);

      // Emit performance warning if exceeding target
      if (executionTime > 100) {
        this.emit('performance_warning', {
          workspaceId,
          executionTime,
          target: 100,
          clientCount: workspaceClients.length
        });
      }

    } catch (error) {
      this.emit('metrics_collection_error', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: performance.now() - startTime
      });
    }
  }

  /**
   * Broadcast metrics updates to clients
   */
  private async broadcastUpdates(updates: Map<string, MetricsUpdate[]>): Promise<void> {
    const broadcastPromises: Promise<void>[] = [];

    for (const [clientId, clientUpdates] of updates) {
      const ws = this.clients.get(clientId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Buffer updates if enabled
      if (this.config.bufferSize > 1) {
        const buffer = this.metricsBuffer.get(clientId) || [];
        buffer.push(...clientUpdates);
        
        if (buffer.length >= this.config.bufferSize) {
          broadcastPromises.push(this.sendBufferedUpdates(clientId, buffer));
          this.metricsBuffer.set(clientId, []);
        } else {
          this.metricsBuffer.set(clientId, buffer);
        }
      } else {
        // Send updates immediately
        broadcastPromises.push(this.sendUpdates(clientId, clientUpdates));
      }
    }

    await Promise.all(broadcastPromises);
  }

  /**
   * Send buffered updates to client
   */
  private async sendBufferedUpdates(clientId: string, updates: MetricsUpdate[]): Promise<void> {
    const ws = this.clients.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      const message = {
        type: 'metrics_batch',
        updates,
        timestamp: Date.now()
      };

      const payload = this.config.enableCompression 
        ? this.compressMessage(message)
        : JSON.stringify(message);

      ws.send(payload);
      
      this.emit('metrics_sent', {
        clientId,
        updateCount: updates.length,
        compressed: this.config.enableCompression
      });
    } catch (error) {
      this.emit('send_error', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send individual updates to client
   */
  private async sendUpdates(clientId: string, updates: MetricsUpdate[]): Promise<void> {
    const ws = this.clients.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      for (const update of updates) {
        const message = {
          type: 'metrics_update',
          update,
          timestamp: Date.now()
        };

        const payload = this.config.enableCompression 
          ? this.compressMessage(message)
          : JSON.stringify(message);

        ws.send(payload);
      }
      
      this.emit('metrics_sent', {
        clientId,
        updateCount: updates.length,
        compressed: this.config.enableCompression
      });
    } catch (error) {
      this.emit('send_error', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Compress message for transmission
   */
  private compressMessage(message: any): string {
    // Simple compression - in production, use proper compression library
    const json = JSON.stringify(message);
    
    // Remove unnecessary whitespace and optimize field names
    return json
      .replace(/\s+/g, '')
      .replace(/"timestamp"/g, '"t"')
      .replace(/"workspaceId"/g, '"w"')
      .replace(/"componentId"/g, '"c"')
      .replace(/"type"/g, '"ty"')
      .replace(/"data"/g, '"d"');
  }

  /**
   * Setup metrics collector event handlers
   */
  private setupMetricsCollectorEvents(): void {
    this.metricsCollector.on('metrics_added', (metrics: ComponentMetrics) => {
      // Store metrics for real-time access
      this.metricsStorage.storeRawMetrics(metrics);
    });

    this.metricsCollector.on('metrics_aggregated', (data: any) => {
      if (data.systemMetrics) {
        this.metricsStorage.storeSystemMetrics(data.systemMetrics);
      }
      if (data.aggregatedMetrics) {
        this.metricsStorage.storeAggregatedMetrics(data.aggregatedMetrics);
      }
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    return this.performanceTracker.getStats();
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get workspace client count
   */
  getWorkspaceClientCount(workspaceId: string): number {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.workspaceId === workspaceId).length;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();

    // Close all client connections
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.clients.clear();
    this.subscriptions.clear();
    this.metricsBuffer.clear();
  }
}

/**
 * Performance tracker for monitoring update times
 */
class PerformanceTracker {
  private updateTimes: number[] = [];
  private maxSamples: number = 1000;

  recordUpdateTime(timeMs: number): void {
    this.updateTimes.push(timeMs);
    
    // Keep only recent samples
    if (this.updateTimes.length > this.maxSamples) {
      this.updateTimes = this.updateTimes.slice(-this.maxSamples);
    }
  }

  getStats(): PerformanceStats {
    if (this.updateTimes.length === 0) {
      return {
        averageUpdateTime: 0,
        minUpdateTime: 0,
        maxUpdateTime: 0,
        p95UpdateTime: 0,
        p99UpdateTime: 0,
        sampleCount: 0,
        targetCompliance: 100
      };
    }

    const sorted = [...this.updateTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    const underTarget = sorted.filter(time => time <= 100).length;
    const targetCompliance = (underTarget / sorted.length) * 100;

    return {
      averageUpdateTime: sum / sorted.length,
      minUpdateTime: sorted[0],
      maxUpdateTime: sorted[sorted.length - 1],
      p95UpdateTime: sorted[p95Index],
      p99UpdateTime: sorted[p99Index],
      sampleCount: sorted.length,
      targetCompliance
    };
  }
}

export interface PerformanceStats {
  averageUpdateTime: number;
  minUpdateTime: number;
  maxUpdateTime: number;
  p95UpdateTime: number;
  p99UpdateTime: number;
  sampleCount: number;
  targetCompliance: number; // percentage of updates under 100ms
}