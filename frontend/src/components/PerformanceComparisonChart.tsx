/**
 * Performance Comparison Chart Component
 * Visualizes performance differences between workspace versions
 */

import React, { useEffect, useRef } from 'react';
import { Chart, type ChartConfiguration, registerables } from 'chart.js';
import type { PerformanceComparison } from '../types';
import './PerformanceComparisonChart.css';

Chart.register(...registerables);

interface PerformanceComparisonChartProps {
  comparison: PerformanceComparison;
  chartType?: 'overview' | 'components' | 'bottlenecks';
}

export const PerformanceComparisonChart: React.FC<PerformanceComparisonChartProps> = ({
  comparison,
  chartType = 'overview'
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    let chartConfig: ChartConfiguration;

    switch (chartType) {
      case 'overview':
        chartConfig = createOverviewChart(comparison);
        break;
      case 'components':
        chartConfig = createComponentsChart(comparison);
        break;
      case 'bottlenecks':
        chartConfig = createBottlenecksChart(comparison);
        break;
      default:
        chartConfig = createOverviewChart(comparison);
    }

    chartInstance.current = new Chart(ctx, chartConfig);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [comparison, chartType]);

  const createOverviewChart = (comparison: PerformanceComparison): ChartConfiguration => {
    const { overallImprovement } = comparison;
    
    return {
      type: 'bar',
      data: {
        labels: ['Latency', 'Throughput', 'Error Rate', 'Resource Efficiency'],
        datasets: [
          {
            label: 'Performance Change (%)',
            data: [
              overallImprovement.latencyChange,
              overallImprovement.throughputChange,
              overallImprovement.errorRateChange,
              overallImprovement.resourceEfficiencyChange
            ],
            backgroundColor: [
              overallImprovement.latencyChange < 0 ? '#28a745' : '#dc3545',
              overallImprovement.throughputChange > 0 ? '#28a745' : '#dc3545',
              overallImprovement.errorRateChange < 0 ? '#28a745' : '#dc3545',
              overallImprovement.resourceEfficiencyChange > 0 ? '#28a745' : '#dc3545'
            ],
            borderColor: [
              overallImprovement.latencyChange < 0 ? '#1e7e34' : '#c82333',
              overallImprovement.throughputChange > 0 ? '#1e7e34' : '#c82333',
              overallImprovement.errorRateChange < 0 ? '#1e7e34' : '#c82333',
              overallImprovement.resourceEfficiencyChange > 0 ? '#1e7e34' : '#c82333'
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Overall Performance Comparison',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y ?? 0;
                const metric = context.label;
                const direction = value > 0 ? 'increase' : 'decrease';
                return `${metric}: ${Math.abs(value).toFixed(1)}% ${direction}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Percentage Change'
            },
            ticks: {
              callback: (value) => `${value}%`
            }
          }
        }
      }
    };
  };

  const createComponentsChart = (comparison: PerformanceComparison): ChartConfiguration => {
    const componentData = comparison.componentComparisons.slice(0, 10); // Limit to top 10 components
    
    return {
      type: 'radar',
      data: {
        labels: componentData.map(c => `${c.componentType} (${c.componentId.slice(-4)})`),
        datasets: [
          {
            label: 'Baseline',
            data: componentData.map(c => c.baseline.averageLatency),
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            pointBackgroundColor: '#007bff',
            pointBorderColor: '#007bff',
            pointHoverBackgroundColor: '#007bff',
            pointHoverBorderColor: '#007bff'
          },
          {
            label: 'Comparison',
            data: componentData.map(c => c.comparison.averageLatency),
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            pointBackgroundColor: '#28a745',
            pointBorderColor: '#28a745',
            pointHoverBackgroundColor: '#28a745',
            pointHoverBorderColor: '#28a745'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Component Latency Comparison',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average Latency (ms)'
            }
          }
        }
      }
    };
  };

  const createBottlenecksChart = (comparison: PerformanceComparison): ChartConfiguration => {
    const { bottleneckAnalysis } = comparison;
    
    return {
      type: 'doughnut',
      data: {
        labels: ['Resolved', 'Persisting', 'Introduced'],
        datasets: [
          {
            data: [
              bottleneckAnalysis.resolved.length,
              bottleneckAnalysis.persisting.length,
              bottleneckAnalysis.introduced.length
            ],
            backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
            borderColor: ['#1e7e34', '#e0a800', '#c82333'],
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Bottleneck Analysis',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label;
                const value = typeof context.parsed === 'number' ? context.parsed : 0;
                const dataArray = context.dataset.data.map(d => typeof d === 'number' ? d : 0);
                const total = dataArray.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
  };

  return (
    <div className="performance-comparison-chart">
      <canvas ref={chartRef} />
    </div>
  );
};

export default PerformanceComparisonChart;