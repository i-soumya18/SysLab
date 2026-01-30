/**
 * Latency distribution chart component showing percentiles
 */

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { AggregatedMetrics, Component } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export interface LatencyDistributionChartProps {
  components: Component[];
  aggregatedMetrics: Map<string, AggregatedMetrics[]>;
  height?: number;
  showLatest?: boolean;
}

export const LatencyDistributionChart: React.FC<LatencyDistributionChartProps> = ({
  components,
  aggregatedMetrics,
  height = 400,
  showLatest = true
}) => {
  const [chartData, setChartData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });

  useEffect(() => {
    if (!components || components.length === 0) {
      setChartData({ labels: [], datasets: [] });
      return;
    }

    const labels = components.map(c => c.metadata.name);
    const p50Data: number[] = [];
    const p95Data: number[] = [];
    const p99Data: number[] = [];

    components.forEach(component => {
      const componentMetrics = aggregatedMetrics.get(component.id);
      
      if (!componentMetrics || componentMetrics.length === 0) {
        p50Data.push(0);
        p95Data.push(0);
        p99Data.push(0);
        return;
      }

      const latestMetric = showLatest 
        ? componentMetrics[componentMetrics.length - 1]
        : componentMetrics[0];

      p50Data.push(latestMetric.latency.p50);
      p95Data.push(latestMetric.latency.p95);
      p99Data.push(latestMetric.latency.p99);
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'P50 Latency',
          data: p50Data,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1
        },
        {
          label: 'P95 Latency',
          data: p95Data,
          backgroundColor: 'rgba(245, 158, 11, 0.6)',
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 1
        },
        {
          label: 'P99 Latency',
          data: p99Data,
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1
        }
      ]
    });
  }, [components, aggregatedMetrics, showLatest]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Latency Distribution by Component'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value?.toFixed(1) || 0} ms`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Components'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Latency (ms)'
        },
        beginAtZero: true
      }
    }
  };

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};