import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface RealTimeSimulationDashboardProps {
  workspaceId: string;
  userId?: string;
  onSimulationStart?: (data: any) => void;
  onSimulationStop?: (data: any) => void;
}

export const RealTimeSimulationDashboard: React.FC<RealTimeSimulationDashboardProps> = ({
  workspaceId,
  userId,
  onSimulationStart,
  onSimulationStop
}) => {
  const {
    isConnected,
    simulationMetrics,
    simulationEvents,
    simulationProgress,
    startSimulation,
    stopSimulation,
    subscribe
  } = useWebSocket({
    workspaceId,
    userId,
    autoConnect: true
  });

  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [componentMetrics, setComponentMetrics] = useState<Map<string, any>>(new Map());
  const [systemMetrics, setSystemMetrics] = useState<any>(null);

  // Subscribe to simulation events
  useEffect(() => {
    const unsubscribeStarted = subscribe('simulation:started', (data: any) => {
      setIsSimulationRunning(true);
      onSimulationStart?.(data);
    });

    const unsubscribeStopped = subscribe('simulation:stopped', (data: any) => {
      setIsSimulationRunning(false);
      onSimulationStop?.(data);
    });

    const unsubscribeStatus = subscribe('simulation:status', (data: any) => {
      setIsSimulationRunning(data.isRunning);
      if (data.systemMetrics) {
        setSystemMetrics(data.systemMetrics);
      }
    });

    return () => {
      unsubscribeStarted();
      unsubscribeStopped();
      unsubscribeStatus();
    };
  }, [subscribe, onSimulationStart, onSimulationStop]);

  // Process metrics updates
  useEffect(() => {
    if (simulationMetrics) {
      if (simulationMetrics.type === 'component_metrics') {
        const metrics = simulationMetrics.data;
        setComponentMetrics(prev => new Map(prev.set(metrics.componentId, metrics)));
      } else if (simulationMetrics.type === 'system_metrics') {
        setSystemMetrics(simulationMetrics.data);
      }
    }
  }, [simulationMetrics]);

  const handleStartSimulation = async () => {
    try {
      // For demo purposes, using a basic workspace configuration
      const demoWorkspace = {
        id: workspaceId,
        name: 'Demo Workspace',
        components: [
          {
            id: 'web-server-1',
            type: 'web-server',
            position: { x: 100, y: 100 },
            configuration: {
              capacity: 100,
              latency: 50,
              failureRate: 0.01
            }
          },
          {
            id: 'database-1',
            type: 'database',
            position: { x: 300, y: 100 },
            configuration: {
              capacity: 50,
              latency: 100,
              failureRate: 0.005
            }
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceComponentId: 'web-server-1',
            targetComponentId: 'database-1',
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: 1000,
              latency: 10,
              protocol: 'HTTP',
              reliability: 0.99
            }
          }
        ],
        configuration: {
          duration: 60, // 60 seconds
          loadPattern: {
            type: 'realistic',
            baseLoad: 10,
            peakLoad: 50
          },
          failureScenarios: [],
          metricsCollection: {
            collectionInterval: 1000,
            retentionPeriod: 300000
          }
        }
      };

      await startSimulation({ workspace: demoWorkspace });
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  const handleStopSimulation = async () => {
    try {
      await stopSimulation();
    } catch (error) {
      console.error('Failed to stop simulation:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
        <p className="text-yellow-800">Connecting to real-time updates...</p>
      </div>
    );
  }

  return (
    <div className="real-time-simulation-dashboard p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Real-Time Simulation Dashboard</h2>
        
        {/* Simulation Controls */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleStartSimulation}
            disabled={isSimulationRunning}
            className={`px-4 py-2 rounded font-medium ${
              isSimulationRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSimulationRunning ? 'Running...' : 'Start Simulation'}
          </button>
          
          <button
            onClick={handleStopSimulation}
            disabled={!isSimulationRunning}
            className={`px-4 py-2 rounded font-medium ${
              !isSimulationRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Stop Simulation
          </button>
        </div>

        {/* Simulation Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">Status</h3>
            <p className={`text-lg font-bold ${isSimulationRunning ? 'text-green-600' : 'text-gray-600'}`}>
              {isSimulationRunning ? 'Running' : 'Stopped'}
            </p>
          </div>
          
          {simulationProgress && (
            <>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800">Current Time</h3>
                <p className="text-lg font-bold text-green-600">
                  {Math.round(simulationProgress.currentTime / 1000)}s
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800">Events Processed</h3>
                <p className="text-lg font-bold text-purple-600">
                  {simulationProgress.eventCount.toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* System Metrics */}
      {systemMetrics && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">System Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Total Throughput</div>
              <div className="text-xl font-bold">{systemMetrics.totalThroughput.toFixed(1)} req/s</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Avg Latency</div>
              <div className="text-xl font-bold">{systemMetrics.averageLatency.toFixed(0)}ms</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Error Rate</div>
              <div className="text-xl font-bold">{(systemMetrics.systemErrorRate * 100).toFixed(2)}%</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Healthy Components</div>
              <div className="text-xl font-bold">
                {systemMetrics.healthyComponents}/{systemMetrics.activeComponents}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Component Metrics */}
      {componentMetrics.size > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Component Metrics</h3>
          <div className="space-y-4">
            {Array.from(componentMetrics.entries()).map(([componentId, metrics]) => (
              <div key={componentId} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">{componentId}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">RPS:</span>
                    <span className="ml-1 font-medium">{metrics.requestsPerSecond.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Latency:</span>
                    <span className="ml-1 font-medium">{metrics.averageLatency.toFixed(0)}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-600">CPU:</span>
                    <span className="ml-1 font-medium">{(metrics.cpuUtilization * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Queue:</span>
                    <span className="ml-1 font-medium">{metrics.queueDepth}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {simulationEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Events</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {simulationEvents.slice(-10).reverse().map((event, index) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="ml-2 font-medium">{event.type}</span>
                  {event.data.componentId && (
                    <span className="ml-2 text-blue-600">{event.data.componentId}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeSimulationDashboard;