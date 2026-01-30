/**
 * Resource utilization visualization component
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
import type { ComponentMetrics, AggregatedMetrics, Component } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export interface ResourceUtilizationChartProps {
  components: Component[];
  metrics: Map<string, ComponentMetrics[] | AggregatedMetrics[]>;
  height?: number;
  showLatest?: boolean;
}

export const ResourceUtilizationChart: React.FC<ResourceUtilizationChartProps> = ({
  components,
  metrics,
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
    const cpuData: number[] = [];
    const memoryData: number[] = [];
    const queueData: number[] = [];

    components.forEach(component => {
      const componentMetrics = metrics.get(component.id);
      
      if (!componentMetrics || componentMetrics.length === 0) {
        cpuData.push(0);
        memoryData.push(0);
        queueData.push(0);
        return;
      }

      const latestMetric = showLatest 
        ? componentMetrics[componentMetrics.length - 1]
        : componentMetrics[0];

      if ('cpuUtilization' in latestMetric) {
        // Raw metrics
        const rawMetric = latestMetric as ComponentMetrics;
        cpuData.push(rawMetric.cpuUtilization * 100);
        memoryData.push(rawMetric.memoryUtilization * 100);
        queueData.push(rawMetric.queueDepth);
      } else {
        // Aggregated metrics
        const aggMetric = latestMetric as AggregatedMetrics;
        cpuData.push(aggMetric.resourceUtilization.cpu.avg * 100);
        memoryData.push(aggMetric.resourceUtilization.memory.avg * 100);
        queueData.push(aggMetric.queueDepth.avg);
      }
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'CPU Utilization (%)',
          data: cpuData,
          backgroundColor: 'rgba(139, 92, 246, 0.6)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: 'Memory Utilization (%)',
          data: memoryData,
          backgroundColor: 'rgba(6, 182, 212, 0.6)',
          borderColor: 'rgba(6, 182, 212, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: 'Queue Depth',
          data: queueData,
          backgroundColor: 'rgba(236, 72, 153, 0.6)',
          borderColor: 'rgba(236, 72, 153, 1)',
          borderWidth: 1,
          yAxisID: 'y1'
        }
      ]
    });
  }, [components, metrics, showLatest]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Resource Utilization by Component'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const unit = context.dataset.label?.includes('Queue') ? ' requests' : '%';
            return `${context.dataset.label}: ${value?.toFixed(1) || 0}${unit}`;
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
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Utilization (%)'
        },
        min: 0,
        max: 100
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Queue Depth'
        },
        min: 0,
        grid: {
          drawOnChartArea: false,
        },
      }
    }
  };

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};