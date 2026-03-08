/**
 * Real-time metrics chart component using Chart.js
 */

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ComponentMetrics, AggregatedMetrics, SystemMetrics } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export interface MetricsChartProps {
  title: string;
  metrics: ComponentMetrics[] | AggregatedMetrics[] | SystemMetrics[];
  metricKey: string;
  color?: string;
  height?: number;
  maxDataPoints?: number;
  showPercentiles?: boolean;
  unit?: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  title,
  metrics,
  metricKey,
  color = '#3B82F6',
  height = 300,
  maxDataPoints = 50,
  showPercentiles = false,
  unit = ''
}) => {
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });

  useEffect(() => {
    if (!metrics || metrics.length === 0) {
      setChartData({ labels: [], datasets: [] });
      return;
    }

    // Take only the most recent data points
    const recentMetrics = metrics.slice(-maxDataPoints);
    
    // Generate labels (timestamps)
    const labels = recentMetrics.map(m => {
      let timestamp: number;
      if ('timestamp' in m) {
        timestamp = m.timestamp;
      } else if ('endTime' in m) {
        timestamp = m.endTime;
      } else {
        timestamp = Date.now();
      }
      return new Date(timestamp).toLocaleTimeString();
    });

    // Prepare datasets
    const datasets: any[] = [];

    if (showPercentiles && recentMetrics.length > 0 && 'requestsPerSecond' in recentMetrics[0] && typeof recentMetrics[0].requestsPerSecond === 'object') {
      // For aggregated metrics, show percentiles
      const aggregatedMetrics = recentMetrics as AggregatedMetrics[];
      
      datasets.push({
        label: `${title} (P50)`,
        data: aggregatedMetrics.map(m => getNestedValue(m, `${metricKey}.p50`)),
        borderColor: color,
        backgroundColor: `${color}20`,
        tension: 0.1,
        fill: false
      });

      datasets.push({
        label: `${title} (P95)`,
        data: aggregatedMetrics.map(m => getNestedValue(m, `${metricKey}.p95`)),
        borderColor: `${color}80`,
        backgroundColor: `${color}10`,
        tension: 0.1,
        fill: false,
        borderDash: [5, 5]
      });

      datasets.push({
        label: `${title} (P99)`,
        data: aggregatedMetrics.map(m => getNestedValue(m, `${metricKey}.p99`)),
        borderColor: `${color}60`,
        backgroundColor: `${color}05`,
        tension: 0.1,
        fill: false,
        borderDash: [2, 2]
      });
    } else {
      // For raw metrics or simple values
      datasets.push({
        label: title,
        data: recentMetrics.map(m => getNestedValue(m, metricKey)),
        borderColor: color,
        backgroundColor: `${color}20`,
        tension: 0.1,
        fill: true
      });
    }

    setChartData({ labels, datasets });
  }, [metrics, metricKey, title, color, maxDataPoints, showPercentiles]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value?.toFixed(2) || 0}${unit}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: unit
        },
        beginAtZero: true
      }
    },
    animation: {
      duration: 300
    }
  };

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

/**
 * Helper function to get nested object values using dot notation
 */
function getNestedValue(obj: any, path: string): number {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : 0;
  }, obj);
}