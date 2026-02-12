import React, { useEffect, useState } from 'react';

interface ScalabilityDashboardProps {
  apiBaseUrl: string;
}

interface SystemCapacity {
  maxConcurrentUsers?: number;
  totalNodes?: number;
}

interface UserMetrics {
  currentConcurrentUsers?: number;
}

interface LoadBalancerStats {
  strategy?: string;
  averageLatencyMs?: number;
}

interface HealthStatus {
  overallStatus?: string;
  healthyNodes?: number;
}

interface ScalingEvent {
  id?: string;
  type?: unknown;
  reason?: unknown;
  deltaCapacity?: unknown;
}

interface CapacityAlert {
  id?: string;
  severity?: unknown;
  message?: unknown;
}

interface ScalabilityDashboardData {
  systemCapacity?: SystemCapacity;
  userMetrics?: UserMetrics;
  loadBalancerStats?: LoadBalancerStats;
  healthStatus?: HealthStatus;
  recentScalingEvents: ScalingEvent[];
  recentCapacityAlerts: CapacityAlert[];
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '–';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }

  return String(value);
};

export const ScalabilityDashboard: React.FC<ScalabilityDashboardProps> = ({ apiBaseUrl }) => {
  const [data, setData] = useState<ScalabilityDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/scalability/dashboard`);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message =
            (body && body.error && body.error) ||
            `Failed to load scalability dashboard: ${response.statusText}`;
          throw new Error(message);
        }
        const body = await response.json();
        setData(body.dashboard as ScalabilityDashboardData);
        setError(null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load scalability dashboard', err);
        setError(err instanceof Error ? err.message : 'Failed to load scalability dashboard');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [apiBaseUrl]);

  if (loading && !data) {
    return (
      <div style={{ fontSize: '12px', color: '#868e96' }}>
        Loading scalability metrics…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: '12px', color: '#c92a2a' }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { systemCapacity, userMetrics, loadBalancerStats, healthStatus, recentScalingEvents, recentCapacityAlerts } = data;

  return (
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          padding: '10px 12px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          color: '#343a40'
        }}
      >
      <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📈</span>
          <strong>Scalability & Capacity</strong>
        </div>
        <span style={{ fontSize: '11px', color: '#868e96' }}>
          {userMetrics?.currentConcurrentUsers ?? 0} concurrent users
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          marginBottom: '8px'
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: '#e3f2fd',
            borderLeft: '3px solid #1e88e5'
          }}
        >
          <div style={{ fontSize: '11px', color: '#555' }}>System Capacity</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e88e5' }}>
            {systemCapacity?.maxConcurrentUsers ?? '–'} users
          </div>
        </div>
        <div
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: '#e8f5e9',
            borderLeft: '3px solid #43a047'
          }}
        >
          <div style={{ fontSize: '11px', color: '#555' }}>Node Count</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2e7d32' }}>
            {systemCapacity?.totalNodes ?? 0}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          marginBottom: '8px'
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>Load Balancer</div>
          <div style={{ fontSize: '11px', color: '#495057' }}>
            Strategy: <strong>{loadBalancerStats?.strategy ?? 'N/A'}</strong>
          </div>
          <div style={{ fontSize: '11px', color: '#495057' }}>
            Avg Latency: <strong>{loadBalancerStats?.averageLatencyMs?.toFixed?.(1) ?? '–'}ms</strong>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>Health</div>
          <div style={{ fontSize: '11px', color: '#495057' }}>
            Status:{' '}
            <strong style={{ color: healthStatus?.overallStatus === 'healthy' ? '#2e7d32' : '#c92a2a' }}>
              {healthStatus?.overallStatus ?? 'unknown'}
            </strong>
          </div>
          <div style={{ fontSize: '11px', color: '#495057' }}>
            Healthy Nodes: <strong>{healthStatus?.healthyNodes ?? 0}</strong>
          </div>
        </div>
      </div>

      {recentScalingEvents.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>Recent Scaling Events</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '72px', overflowY: 'auto' }}>
            {recentScalingEvents.slice(0, 4).map((event, index) => (
              <li key={`${event.id ?? index}`} style={{ fontSize: '11px', color: '#495057', marginBottom: '2px' }}>
                <strong>{formatValue(event.type ?? 'scale')}</strong>{' '}
                → {formatValue(event.reason ?? 'auto-scale')} ({formatValue(event.deltaCapacity ?? 0)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentCapacityAlerts.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>Capacity Alerts</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '60px', overflowY: 'auto' }}>
            {recentCapacityAlerts.slice(0, 3).map((alert, index) => (
              <li key={`${alert.id ?? index}`} style={{ fontSize: '11px', color: '#c92a2a', marginBottom: '2px' }}>
                <strong>{formatValue(alert.severity ?? 'warning')}</strong>:{' '}
                {formatValue(alert.message ?? 'Capacity threshold reached')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ScalabilityDashboard;

