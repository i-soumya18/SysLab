/**
 * Performance Optimization Utilities
 * Utilities for optimizing canvas performance and handling large diagrams
 */

import { Component, Connection } from '../types';

export interface PerformanceConfig {
  maxVisibleComponents: number;
  renderBatchSize: number;
  debounceDelay: number;
  virtualScrollThreshold: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxVisibleComponents: 100,
  renderBatchSize: 20,
  debounceDelay: 300,
  virtualScrollThreshold: 50
};

/**
 * Debounce function to limit the rate of function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function to limit function execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Calculate visible components based on viewport
 */
export function getVisibleComponents(
  components: Component[],
  viewport: { x: number; y: number; width: number; height: number },
  margin: number = 100
): Component[] {
  return components.filter(component => {
    const { x, y } = component.position;
    return (
      x >= viewport.x - margin &&
      x <= viewport.x + viewport.width + margin &&
      y >= viewport.y - margin &&
      y <= viewport.y + viewport.height + margin
    );
  });
}

/**
 * Calculate visible connections based on visible components
 */
export function getVisibleConnections(
  connections: Connection[],
  visibleComponents: Component[]
): Connection[] {
  const visibleComponentIds = new Set(visibleComponents.map(c => c.id));
  
  return connections.filter(connection => 
    visibleComponentIds.has(connection.sourceComponentId) &&
    visibleComponentIds.has(connection.targetComponentId)
  );
}

/**
 * Batch process large arrays to avoid blocking the UI
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => R,
  batchSize: number = DEFAULT_PERFORMANCE_CONFIG.renderBatchSize
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = batch.map(processor);
    results.push(...batchResults);
    
    // Yield control to the browser
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return results;
}

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
  private renderTimes: number[] = [];
  private maxSamples = 50;

  recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > this.maxSamples) {
      this.renderTimes.shift();
    }
  }

  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
  }

  isPerformanceDegraded(): boolean {
    const avgRender = this.getAverageRenderTime();
    return avgRender > 16; // 60fps threshold
  }

  getMetrics() {
    return {
      averageRenderTime: this.getAverageRenderTime(),
      sampleCount: this.renderTimes.length,
      isPerformanceDegraded: this.isPerformanceDegraded()
    };
  }
}