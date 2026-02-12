/**
 * Optimized Metrics Dashboard for Real-Time UI Responsiveness
 * 
 * Implements SRS NFR-2: Real-time UI with optimistic updates and performance monitoring
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRealTimeMetrics } from '../hooks/useRealTimeMetrics';
import type { Component, ComponentMetrics, SystemMetrics } from '../types';

// Virtual scrolling configuration
interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
}

// Performance optimization settings
interface DashboardOptimizationConfig {
  enableVirtualScrolling: boolean;
  enableMemoization: boolean;
  enableThrottling: boolean;
  updateThrottleMs: number;
  renderThrottleMs: number;
  maxDataPoints: number;
}

interface OptimizedMetricsDashboardProps {
  workspaceId: string;
  components: Component[];
  isSimulationRunning: boolean;
  optimizationConfig?: Partial<DashboardOptimizationConfig>;
  onPerformanceAlert?: (alert: { type: string; message: string; value: number }) => void;
}

// Memoized metric card component
const MetricCard = React.memo<{
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: string;
  onClick?: () => void;
}>(({ title, value, unit, trend, color = '#007bff', onClick }) => {
  return (
    <div 
      className="metric-card"
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
        minWidth: '120px'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '24px', 
        fontWeight: 'bold', 
        color: color,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span style={{ fontSize: '14px', color: '#666' }}>{unit}</span>}
        {trend && (
          <span style={{ fontSize: '12px' }}>
            {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'}
          </span>
        )}
      </div>
    </div>
  );
});

// Virtual scrolling component for large datasets
const VirtualizedMetricsList = React.memo<{
  items: ComponentMetrics[];
  config: VirtualScrollConfig;
  renderItem: (item: ComponentMetrics, index: number) => React.ReactNode;
}>(({ items, config, renderItem }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / config.itemHeight);
    const visibleCount = Math.ceil(config.containerHeight / config.itemHeight);
    const end = Math.min(start + visibleCount + config.overscan, items.length);
    
    return {
      start: Math.max(0, start - config.overscan),
      end
    };
  }, [scrollTop, config, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);

  const totalHeight = items.length * config.itemHeight;
  const offsetY = visibleRange.start * config.itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: config.containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={visibleRange.start + index}>
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export const OptimizedMetricsDashboard: React.FC<OptimizedMetricsDashboardProps> = ({
  workspaceId,
  components,
  optimizationConfig = {},
  onPerformanceAlert
}) => {
  const config: DashboardOptimizationConfig = {
    enableVirtualScrolling: true,
    enableMemoization: true,
    enableThrottling: true,
    updateThrottleMs: 100,
    renderThrottleMs: 16,
    maxDataPoints: 100,
    ...optimizationConfig
  };

  // Real-time metrics hook
  const {
    isConnected,
    componentMetrics,
    systemMetrics,
    performanceStats,
    connect,
    disconnect,
    subscribe
  } = useRealTimeMetrics();

  // Local state for optimized rendering
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [systemMetricsHistory, setSystemMetricsHistory] = useState<SystemMetrics[]>([]);
  const [renderPerformance, setRenderPerformance] = useState({
    renderTime: 0,
    updateCount: 0,
    droppedUpdates: 0
  });

  // Performance tracking refs
  const renderStartRef = useRef<number>(0);
  const updateCountRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // Connect to real-time metrics on mount
  useEffect(() => {
    connect();
    subscribe({
      workspaceId,
      componentIds: components.map(c => c.id),
      updateTypes: ['component', 'system', 'aggregated'],
      autoReconnect: true
    });

    return () => {
      disconnect();
    };
  }, [workspaceId, components, connect, disconnect, subscribe]);

  // Track render performance
  useEffect(() => {
    renderStartRef.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      setRenderPerformance(prev => ({
        ...prev,
        renderTime
      }));

      // Alert on poor performance
      if (renderTime > 16 && onPerformanceAlert) {
        onPerformanceAlert({
          type: 'render_performance',
          message: `Dashboard render time exceeded 16ms: ${renderTime.toFixed(1)}ms`,
          value: renderTime
        });
      }
    };
  });

  // Update metrics history with throttling
  useEffect(() => {
    const now = performance.now();
    if (now - lastUpdateRef.current < config.updateThrottleMs) {
      return;
    }
    lastUpdateRef.current = now;

    // Update system metrics history
    if (systemMetrics) {
      setSystemMetricsHistory(prev => 
        [...prev, systemMetrics].slice(-config.maxDataPoints)
      );
    }

    updateCountRef.current++;
    setRenderPerformance(prev => ({
      ...prev,
      updateCount: updateCountRef.current
    }));
  }, [componentMetrics, systemMetrics, config.updateThrottleMs, config.maxDataPoints]);

  // Memoized system overview cards
  const systemOverviewCards = useMemo(() => {
    if (!systemMetrics) return [];

    const getTrend = (): 'up' | 'down' | 'stable' => {
      if (systemMetricsHistory.length < 2) return 'stable';
      const current = systemMetricsHistory[systemMetricsHistory.length - 1];
      const previous = systemMetricsHistory[systemMetricsHistory.length - 2];
      const diff = current.totalThroughput - previous.totalThroughput;
      return Math.abs(diff) < 0.1 ? 'stable' : diff > 0 ? 'up' : 'down';
    };

    return [
      {
        title: 'Total Throughput',
        value: systemMetrics.totalThroughput,
        unit: 'req/s',
        trend: getTrend(),
        color: systemMetrics.totalThroughput > 100 ? '#28a745' : '#ffc107'
      },
      {
        title: 'Avg Latency',
        value: systemMetrics.averageLatency,
        unit: 'ms',
        trend: getTrend(),
        color: systemMetrics.averageLatency < 100 ? '#28a745' : systemMetrics.averageLatency < 500 ? '#ffc107' : '#dc3545'
      },
      {
        title: 'Error Rate',
        value: (systemMetrics.systemErrorRate * 100),
        unit: '%',
        trend: getTrend(),
        color: systemMetrics.systemErrorRate < 0.01 ? '#28a745' : systemMetrics.systemErrorRate < 0.05 ? '#ffc107' : '#dc3545'
      },
      {
        title: 'Healthy Components',
        value: `${systemMetrics.healthyComponents}/${systemMetrics.activeComponents}`,
        trend: 'stable' as const,
        color: systemMetrics.healthyComponents === systemMetrics.activeComponents ? '#28a745' : '#ffc107'
      }
    ];
  }, [systemMetrics, systemMetricsHistory]);

  // Memoized component metrics list
  const componentMetricsList = useMemo(() => {
    return Array.from(componentMetrics.entries()).map(([componentId, metrics]) => {
      const component = components.find(c => c.id === componentId);
      return {
        ...metrics,
        componentName: component?.metadata?.name || componentId,
        componentType: component?.type || 'Unknown'
      };
    });
  }, [componentMetrics, components]);

  // Throttled event handlers
  const throttledHandlers = useMemo(() => {
    const throttle = <T extends (...args: any[]) => void>(fn: T, delay: number): T => {
      let timeoutId: NodeJS.Timeout | null = null;
      return ((...args: Parameters<T>) => {
        if (timeoutId) return;
        timeoutId = setTimeout(() => {
          fn(...args);
          timeoutId = null;
        }, delay);
      }) as T;
    };

    return {
      onComponentSelect: throttle((componentId: string | null) => {
        setSelectedComponentId(componentId);
      }, config.renderThrottleMs)
    };
  }, [config.renderThrottleMs]);

  // Virtual scrolling configuration
  const virtualScrollConfig: VirtualScrollConfig = {
    itemHeight: 60,
    containerHeight: 400,
    overscan: 5
  };

  // Render component metric item
  const renderComponentMetricItem = useCallback((item: any, _index?: number) => (
    <div
      key={item.componentId}
      style={{
        height: virtualScrollConfig.itemHeight,
        padding: '8px 16px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: selectedComponentId === item.componentId ? '#f0f8ff' : 'white',
        cursor: 'pointer'
      }}
      onClick={() => throttledHandlers.onComponentSelect(item.componentId)}
    >
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {item.componentName}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {item.componentType}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>RPS</div>
          <div style={{ fontWeight: 'bold' }}>{item.requestsPerSecond.toFixed(1)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Latency</div>
          <div style={{ fontWeight: 'bold' }}>{item.averageLatency.toFixed(0)}ms</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Error %</div>
          <div style={{ 
            fontWeight: 'bold',
            color: item.errorRate < 0.01 ? '#28a745' : item.errorRate < 0.05 ? '#ffc107' : '#dc3545'
          }}>
            {(item.errorRate * 100).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  ), [selectedComponentId, throttledHandlers, virtualScrollConfig.itemHeight]);

  return (
    <div className="optimized-metrics-dashboard" style={{ padding: '16px' }}>
      {/* Connection Status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px',
        padding: '8px 16px',
        backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
        border: `1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#28a745' : '#dc3545'
          }} />
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        {/* Performance Stats */}
        <div style={{ fontSize: '12px', color: '#666' }}>
          Render: {renderPerformance.renderTime.toFixed(1)}ms | 
          Updates: {renderPerformance.updateCount} | 
          Latency: {performanceStats.updateLatency.toFixed(1)}ms
        </div>
      </div>

      {/* System Overview */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>System Overview</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px'
        }}>
          {systemOverviewCards.map((card, index) => (
            <MetricCard key={index} {...card} />
          ))}
        </div>
      </div>

      {/* Component Metrics */}
      <div>
        <h3 style={{ marginBottom: '12px' }}>Component Metrics</h3>
        {config.enableVirtualScrolling && componentMetricsList.length > 10 ? (
          <VirtualizedMetricsList
            items={componentMetricsList}
            config={virtualScrollConfig}
            renderItem={renderComponentMetricItem}
          />
        ) : (
          <div style={{ 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            {componentMetricsList.map((item, index) => renderComponentMetricItem(item, index))}
          </div>
        )}
      </div>

      {/* Performance Warning */}
      {renderPerformance.renderTime > 16 && (
        <div style={{
          marginTop: '16px',
          padding: '8px 12px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#856404'
        }}>
          ⚠️ Dashboard performance degraded: {renderPerformance.renderTime.toFixed(1)}ms render time
        </div>
      )}
    </div>
  );
};