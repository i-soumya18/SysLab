/**
 * Workspace Component - Main application workspace
 * Combines the component palette and canvas with drag-and-drop functionality
 */

import React, { useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate, useParams } from 'react-router-dom';
import { Canvas } from './Canvas';
import CollaborationPresence from './CollaborationPresence';
import { ComponentPalette } from './ComponentPalette';
import { FailureInjectionPanel, type FailureInjection } from './FailureInjectionPanel';
import { HintsPanel } from './HintsPanel';
import { MetricsDashboard } from './MetricsDashboard';
import { ProgressDashboard } from './ProgressDashboard';
import { ProgressiveConstraintsPanel } from './ProgressiveConstraintsPanel';
import { ScaleControl } from './ScaleControl';
import { ScenarioLibrary } from './ScenarioLibrary';
import { StatusBar } from './StatusBar';
import { SystemCollapseMonitor, type CollapseEvent, type RecoveryEvent } from './SystemCollapseMonitor';
import { WorkspaceImportModal } from './WorkspaceImportModal';
import { BottleneckVisualizer } from './BottleneckVisualizer';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { useCollaboration } from '../hooks/useCollaboration';
import useWebSocket from '../hooks/useWebSocket';
import { WorkspaceApiService } from '../services/workspaceApi';
import { scenarioApi } from '../services/scenarioApi';
import { CostDashboard } from './CostDashboard';
import { ScalabilityDashboard } from './ScalabilityDashboard';
import type { BottleneckInfo, Component, ComponentMetrics, SystemMetrics, Workspace as WorkspaceModel } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Fix React types compatibility with react-dnd
const DndProviderFixed = DndProvider as any;

export const Workspace: React.FC = () => {
  const { id: routeWorkspaceId } = useParams<{ id?: string }>();
  const { user } = useFirebaseAuthContext();
  const navigate = useNavigate();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('demo-workspace-id');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [componentCount, setComponentCount] = useState<number>(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('anonymous-user');
  const [currentScale, setCurrentScale] = useState<number>(100); // Default to 100 users for MVLE-3
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(false);

  // Workspace data - track components and connections
  const [workspaceComponents, setWorkspaceComponents] = useState<Component[]>([]);
  const [workspaceConnections, setWorkspaceConnections] = useState<any[]>([]);

  // Simulation state
  const [_simulationId, _setSimulationId] = useState<string | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | undefined>(undefined);
  const [componentMetrics, setComponentMetrics] = useState<Map<string, ComponentMetrics>>(new Map());
  const [bottlenecksMap, setBottlenecksMap] = useState<Map<string, BottleneckInfo>>(new Map());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [collapseEvents] = useState<CollapseEvent[]>([]);
  const [recoveryEvents] = useState<RecoveryEvent[]>([]);
  const [completedScenarios] = useState<string[]>([]);
  const [activeInsightsTab, setActiveInsightsTab] = useState<'scenarios' | 'progress' | 'health'>('scenarios');

  // Learning panels state (SRS FR-9.2, FR-9.3, FR-6)
  const [showHintsPanel, setShowHintsPanel] = useState<boolean>(false);
  const [showConstraintsPanel, setShowConstraintsPanel] = useState<boolean>(false);
  const [showFailurePanel, setShowFailurePanel] = useState<boolean>(false);
  const [activeFailures, setActiveFailures] = useState<FailureInjection[]>([]);
  const [constraintSessionId] = useState<string>(`session-${Date.now()}`);

  // Floating panels visibility state
  const [showMetricsPanel, setShowMetricsPanel] = useState<boolean>(false);
  const [showCostPanel, setShowCostPanel] = useState<boolean>(false);
  const [showScalabilityPanel, setShowScalabilityPanel] = useState<boolean>(false);

  // Layout sizing state
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(320);
  const [insightsHeight, setInsightsHeight] = useState<number>(240);

  const minLeftSidebarWidth = 200;
  const maxLeftSidebarWidth = 400;
  const minRightSidebarWidth = 260;
  const maxRightSidebarWidth = 420;
  const minInsightsHeight = 160;
  const maxInsightsHeight = 400;

  const { collaborationState } = useCollaboration({
    workspaceId: currentWorkspaceId,
    userId: currentUserId,
    enabled: true
  });

  const {
    isConnected: isWebSocketConnected,
    simulationMetrics: wsSimulationMetrics,
    simulationProgress: wsSimulationProgress,
    simulationStatus: wsSimulationStatus,
    startSimulation: wsStartSimulation,
    stopSimulation: wsStopSimulation,
    pauseSimulation: wsPauseSimulation,
    resumeSimulation: wsResumeSimulation,
    subscribe
  } = useWebSocket({
    workspaceId: currentWorkspaceId,
    userId: currentUserId,
    autoConnect: true
  });

  const loadWorkspaceById = async (workspaceId: string, userId: string): Promise<void> => {
    try {
      const url = new URL(`${API_BASE_URL}/workspaces/${workspaceId}`);
      if (userId) {
        url.searchParams.append('userId', userId);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody && errorBody.error && errorBody.error.message) ||
          `Failed to load workspace: ${response.statusText}`;
        throw new Error(message);
      }

      const body: { success?: boolean; data?: WorkspaceModel } = await response.json();
      if (!body.data) {
        throw new Error('Workspace data is missing in the response');
      }

      const loadedWorkspace = body.data;
      setCurrentWorkspaceId(loadedWorkspace.id);
      setWorkspaceComponents(loadedWorkspace.components || []);
      setWorkspaceConnections(loadedWorkspace.connections || []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load workspace from route:', error);
      if (error instanceof Error) {
        alert(
          `Unable to load workspace. Please check the link or choose another workspace. Details: ${error.message}`
        );
      } else {
        alert('Unable to load workspace. Please check the link or choose another workspace.');
      }
    }
  };

  useEffect(() => {
    if (user?.uid) {
      setCurrentUserId(user.uid);
    }
  }, [user]);

  useEffect(() => {
    // Don't attempt to load workspace if user is not authenticated
    if (routeWorkspaceId && currentUserId && currentUserId !== 'anonymous-user' && routeWorkspaceId !== currentWorkspaceId) {
      void loadWorkspaceById(routeWorkspaceId, currentUserId);
    }
  }, [routeWorkspaceId, currentUserId]);

  useEffect(() => {
    if (wsSimulationStatus) {
      setIsSimulationRunning(wsSimulationStatus.isRunning);
      // Auto-show metrics panel when simulation starts
      if (wsSimulationStatus.isRunning && !showMetricsPanel) {
        setShowMetricsPanel(true);
      }
    }
  }, [wsSimulationStatus, showMetricsPanel]);

  useEffect(() => {
    if (wsSimulationProgress) {
      setElapsedTime(Math.floor(wsSimulationProgress.currentTime / 1000));
    }
  }, [wsSimulationProgress]);

  useEffect(() => {
    if (!wsSimulationMetrics) {
      return;
    }

    if (wsSimulationMetrics.type === 'system_metrics') {
      setSystemMetrics(wsSimulationMetrics.data as SystemMetrics);
    } else if (wsSimulationMetrics.type === 'component_metrics') {
      const metric = wsSimulationMetrics.data as ComponentMetrics;
      setComponentMetrics(prev => {
        const next = new Map(prev);
        next.set(metric.componentId, metric);
        return next;
      });
    }
  }, [wsSimulationMetrics]);

  useEffect(() => {
    const unsubscribe = subscribe('simulation:bottleneck', (payload: { data?: BottleneckInfo[] | BottleneckInfo }) => {
      const data = payload?.data;
      if (!data) {
        return;
      }

      const list = Array.isArray(data) ? data : [data];
      const next = new Map<string, BottleneckInfo>();
      list.forEach(bottleneck => {
        next.set(bottleneck.componentId, bottleneck);
      });
      setBottlenecksMap(next);

      // Auto-show hints panel when bottlenecks are detected
      if (list.length > 0 && isSimulationRunning && !showHintsPanel) {
        setShowHintsPanel(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe, isSimulationRunning, showHintsPanel]);

  const handleComponentAdd = (component: Component) => {
    console.log('Component added:', component);
    setWorkspaceComponents(prev => [...prev, component]);
  };

  const handleComponentSelect = (component: Component | null) => {
    setSelectedComponent(component);
    console.log('Component selected:', component);
  };

  const handleComponentUpdate = (component: Component) => {
    console.log('Component updated:', component);
    setWorkspaceComponents(prev => 
      prev.map(c => c.id === component.id ? component : c)
    );
  };

  const handleComponentDelete = (componentId: string) => {
    console.log('Component deleted:', componentId);
    setWorkspaceComponents(prev => prev.filter(c => c.id !== componentId));
    // Also remove connections involving this component
    setWorkspaceConnections(prev => 
      prev.filter(conn => 
        conn.sourceComponentId !== componentId && 
        conn.targetComponentId !== componentId
      )
    );
  };

  const handleConnectionCreate = (connection: any) => {
    console.log('Connection created:', connection);
    setWorkspaceConnections(prev => [...prev, connection]);
  };

  const handleConnectionDelete = (connectionId: string) => {
    console.log('Connection deleted:', connectionId);
    setWorkspaceConnections(prev => prev.filter(conn => conn.id !== connectionId));
  };

  const handleComponentCountChange = (count: number) => {
    setComponentCount(count);
  };

  const handleExportWorkspace = async () => {
    try {
      await WorkspaceApiService.downloadWorkspaceExport(
        currentWorkspaceId,
        currentUserId,
        'System Design Simulator User'
      );
    } catch (error: any) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  };

  const handleImportSuccess = (workspace: any) => {
    console.log('Workspace imported successfully:', workspace);
    alert(`Workspace "${workspace.name}" imported successfully!`);
    if (workspace.id) {
      setCurrentWorkspaceId(workspace.id);
    }
    if (workspace.components) {
      setWorkspaceComponents(workspace.components);
    }
    if (workspace.connections) {
      setWorkspaceConnections(workspace.connections);
    }
  };

  const handleScenarioSelect = (scenarioId: string) => {
    console.log('Scenario selected:', scenarioId);
  };

  const handleScenarioLoad = async (scenarioId: string) => {
    try {
      const result = await scenarioApi.loadScenario(scenarioId, currentUserId);
      const loadedWorkspace = result.workspace;
      setCurrentWorkspaceId(loadedWorkspace.id);
      setWorkspaceComponents(loadedWorkspace.components || []);
      setWorkspaceConnections(loadedWorkspace.connections || []);
    } catch (error) {
      console.error('Failed to load scenario into workspace:', error);
      alert('Failed to load scenario. Please try again.');
    }
  };

  const handleScaleChange = (userCount: number) => {
    setCurrentScale(userCount);
    console.log('Scale changed to:', userCount, 'users');
  };

  const handleStartSimulation = async () => {
    try {
      // Validate that we have components
      if (workspaceComponents.length === 0) {
        alert('Please add components to the canvas before running the simulation');
        return;
      }

      setElapsedTime(0);

      const workspace = {
        id: currentWorkspaceId,
        name: 'Demo Workspace',
        description: 'System design simulation workspace',
        userId: currentUserId,
        components: workspaceComponents,
        connections: workspaceConnections,
        configuration: {
          duration: 60, // 60 seconds simulation
          loadPattern: {
            type: 'constant' as const,
            baseLoad: currentScale * 2 // Approximate requests per second (2 req/sec per user)
          },
          failureScenarios: [],
          metricsCollection: {
            collectionInterval: 1000, // Collect metrics every second
            retentionPeriod: 300, // Keep metrics for 5 minutes
            enabledMetrics: ['latency', 'throughput', 'errorRate', 'resourceUtilization']
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('Starting simulation (WebSocket) with workspace:', workspace);

      await wsStartSimulation({
        workspace,
        userCount: currentScale,
        duration: 60
      });

      setIsSimulationRunning(true);
    } catch (error: any) {
      console.error('Failed to start simulation:', error);
      setIsSimulationRunning(false);
      alert(`Failed to start simulation: ${error.message}`);
    }
  };

  const handleStopSimulation = () => {
    setIsSimulationRunning(false);
    wsStopSimulation().catch(error => {
      // eslint-disable-next-line no-console
      console.error('Failed to stop simulation via WebSocket:', error);
    });
  };

  // Failure Injection handlers (SRS FR-6)
  const handleInjectFailure = async (failure: Omit<FailureInjection, 'id'>): Promise<void> => {
    try {
      const baseUrl = `${API_BASE_URL}/failure-injection`;

      const mapFailureTypeToConfig = (): {
        path: string;
        body: unknown;
      } => {
        const severity = failure.severity;
        const durationMs = failure.duration * 1000;

        switch (failure.type) {
          case 'slow':
            return {
              path: `/component/${encodeURIComponent(failure.componentId)}`,
              body: {
                componentId: failure.componentId,
                failureType: 'latency_spike',
                severity,
                duration: durationMs,
                recoveryType: 'automatic'
              }
            };
          case 'network-partition':
            return {
              path: `/component/${encodeURIComponent(failure.componentId)}`,
              body: {
                componentId: failure.componentId,
                failureType: 'network_partition',
                severity,
                duration: durationMs,
                recoveryType: 'automatic'
              }
            };
          case 'high-load':
            return {
              path: `/component/${encodeURIComponent(failure.componentId)}`,
              body: {
                componentId: failure.componentId,
                failureType: 'degraded_mode',
                severity,
                duration: durationMs,
                recoveryType: 'automatic'
              }
            };
          case 'resource-exhaustion':
            return {
              path: `/component/${encodeURIComponent(failure.componentId)}`,
              body: {
                componentId: failure.componentId,
                failureType: 'component_disable',
                severity,
                duration: durationMs,
                recoveryType: 'manual'
              }
            };
          case 'crash':
          default:
            return {
              path: `/component/${encodeURIComponent(failure.componentId)}`,
              body: {
                componentId: failure.componentId,
                failureType: 'component_disable',
                severity,
                duration: durationMs,
                recoveryType: 'automatic'
              }
            };
        }
      };

      const config = mapFailureTypeToConfig();
      const response = await fetch(`${baseUrl}${config.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config.body)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody && errorBody.error && errorBody.error.message) ||
          `Failed to inject failure: ${response.statusText}`;
        throw new Error(message);
      }

      const result: {
        injectionId: string;
      } = await response.json();

      const newFailure: FailureInjection = {
        ...failure,
        id: result.injectionId,
        startTime: Date.now()
      };

      setActiveFailures(prev => [...prev, newFailure]);
      // eslint-disable-next-line no-console
      console.log('Failure injected:', newFailure);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to inject failure:', error);
      if (error instanceof Error) {
        alert(
          `Failed to inject failure. Try again or adjust parameters. Details: ${error.message}`
        );
      } else {
        alert('Failed to inject failure. Try again or adjust parameters.');
      }
    }
  };

  const handleRemoveFailure = async (failureId: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/failure-injection/stop/${encodeURIComponent(failureId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recoveryType: 'immediate'
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody && errorBody.error && errorBody.error.message) ||
          `Failed to stop failure injection: ${response.statusText}`;
        throw new Error(message);
      }

      setActiveFailures(prev => prev.filter(f => f.id !== failureId));
      // eslint-disable-next-line no-console
      console.log('Failure removed:', failureId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to remove failure:', error);
      if (error instanceof Error) {
        alert(
          `Failed to remove failure injection. You can continue the simulation or retry. Details: ${error.message}`
        );
      } else {
        alert('Failed to remove failure injection. You can continue the simulation or retry.');
      }
    }
  };

  const handleHorizontalDrag = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    side: 'left' | 'right'
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startLeftWidth = leftSidebarWidth;
    const startRightWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaX = moveEvent.clientX - startX;

      if (side === 'left') {
        const nextWidth = Math.min(
          Math.max(startLeftWidth + deltaX, minLeftSidebarWidth),
          maxLeftSidebarWidth
        );
        setLeftSidebarWidth(nextWidth);
      } else {
        const nextWidth = Math.min(
          Math.max(startRightWidth - deltaX, minRightSidebarWidth),
          maxRightSidebarWidth
        );
        setRightSidebarWidth(nextWidth);
      }
    };

    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleVerticalDrag = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = insightsHeight;

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaY = moveEvent.clientY - startY;
      const nextHeight = Math.min(
        Math.max(startHeight - deltaY, minInsightsHeight),
        maxInsightsHeight
      );
      setInsightsHeight(nextHeight);
    };

    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <DndProviderFixed backend={HTML5Backend}>
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar - Component Palette */}
        <aside
          className="bg-white border-r border-gray-200 flex flex-col"
          style={{ width: leftSidebarWidth }}
        >
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Components</h2>
            <p className="text-xs text-gray-500 mt-1">Drag to canvas</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ComponentPalette />
          </div>
        </aside>

        {/* Left resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize component palette"
          className="w-1 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300"
          onMouseDown={(event) => handleHorizontalDrag(event, 'left')}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Toolbar */}
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="font-medium text-gray-600 hover:text-blue-600"
                >
                  Dashboard
                </button>
                <span>/</span>
                <span className="font-medium text-gray-700">Workspace</span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-800">System Design Workspace</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {componentCount} components
                  </span>
                  {isWebSocketConnected ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      Connecting...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Workspace actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-md transition-colors"
                  type="button"
                >
                  Import
                </button>
                <button
                  onClick={handleExportWorkspace}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-md transition-colors"
                  type="button"
                >
                  Export
                </button>
                <button
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                  type="button"
                >
                  Save
                </button>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Panels Menu */}
              <div className="relative group">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md transition-colors"
                >
                  📊 Panels
                </button>
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-2 space-y-1 text-sm">
                    <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Dashboards
                    </p>
                    <button
                      onClick={() => setShowMetricsPanel(!showMetricsPanel)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${showMetricsPanel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      type="button"
                    >
                      {showMetricsPanel ? '✓' : '○'} Metrics Dashboard
                    </button>
                    <button
                      onClick={() => setShowCostPanel(!showCostPanel)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${showCostPanel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      type="button"
                    >
                      {showCostPanel ? '✓' : '○'} Cost Dashboard
                    </button>
                    <button
                      onClick={() => setShowScalabilityPanel(!showScalabilityPanel)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${showScalabilityPanel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      type="button"
                    >
                      {showScalabilityPanel ? '✓' : '○'} Scalability
                    </button>
                    <div className="border-t border-gray-200 my-1" />
                    <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Learning tools
                    </p>
                    <button
                      onClick={() => setShowHintsPanel(!showHintsPanel)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${showHintsPanel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      type="button"
                    >
                      {showHintsPanel ? '✓' : '○'} Hints
                    </button>
                    <button
                      onClick={() => setShowConstraintsPanel(!showConstraintsPanel)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${showConstraintsPanel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      type="button"
                    >
                      {showConstraintsPanel ? '✓' : '○'} Constraints
                    </button>
                    <button
                      onClick={() => setShowFailurePanel(!showFailurePanel)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${showFailurePanel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      type="button"
                    >
                      {showFailurePanel ? '✓' : '○'} Failure Injection
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Simulation controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={isSimulationRunning ? handleStopSimulation : handleStartSimulation}
                  disabled={workspaceComponents.length === 0 || !isWebSocketConnected}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    isSimulationRunning
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : workspaceComponents.length === 0 || !isWebSocketConnected
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  title={
                    !isWebSocketConnected
                      ? 'Waiting for real-time connection'
                      : workspaceComponents.length === 0
                        ? 'Add components to the canvas first'
                        : (isSimulationRunning ? 'Stop simulation' : 'Run simulation')
                  }
                  type="button"
                >
                  {isSimulationRunning ? '⏹ Stop' : '▶ Run'}
                </button>
                <button
                  onClick={
                    isSimulationRunning
                      ? () => wsPauseSimulation().catch(console.error)
                      : () => wsResumeSimulation().catch(console.error)
                  }
                  disabled={!isWebSocketConnected || workspaceComponents.length === 0}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    !isWebSocketConnected || workspaceComponents.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  title={isSimulationRunning ? 'Pause simulation' : 'Resume simulation'}
                  type="button"
                >
                  {isSimulationRunning ? '⏸' : '⏯'}
                </button>
              </div>
            </div>
          </header>

          {/* Main Workspace Area */}
          <div className="flex-1 flex gap-0 p-4 min-h-0">
            {/* Canvas Section */}
            <div className="flex-1 flex flex-col gap-4 min-w-0 pr-4">
              {/* Canvas Container */}
              <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-center overflow-hidden">
                <Canvas
                  width={1000}
                  height={600}
                  onComponentAdd={handleComponentAdd}
                  onComponentSelect={handleComponentSelect}
                  onComponentUpdate={handleComponentUpdate}
                  onComponentDelete={handleComponentDelete}
                  onComponentCountChange={handleComponentCountChange}
                  onConnectionCreate={handleConnectionCreate}
                  onConnectionDelete={handleConnectionDelete}
                  bottlenecks={bottlenecksMap}
                />
              </div>

              {/* Status Bar */}
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-2">
                <StatusBar
                  selectedComponent={selectedComponent}
                  componentCount={componentCount}
                />
              </div>

              {/* Horizontal resize handle between canvas/status and insights */}
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize insights panel"
                className="h-1 w-full cursor-row-resize bg-transparent hover:bg-blue-200 active:bg-blue-300 rounded"
                onMouseDown={handleVerticalDrag}
              />

              {/* Insights Panel with Tabs */}
              <div
                className="bg-white rounded-lg border border-gray-200 p-4"
                style={{ height: insightsHeight }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveInsightsTab('scenarios')}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        activeInsightsTab === 'scenarios'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Scenarios
                    </button>
                    <button
                      onClick={() => setActiveInsightsTab('progress')}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        activeInsightsTab === 'progress'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Progress
                    </button>
                    <button
                      onClick={() => setActiveInsightsTab('health')}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        activeInsightsTab === 'health'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      System Health
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Track progress and monitor stability</p>
                </div>

                <div className="h-full overflow-y-auto">
                  {activeInsightsTab === 'scenarios' && (
                    <ScenarioLibrary
                      userId={currentUserId}
                      completedScenarios={completedScenarios}
                      onScenarioSelect={(scenario) => handleScenarioSelect(scenario.id)}
                      onScenarioLoad={handleScenarioLoad}
                    />
                  )}

                  {activeInsightsTab === 'progress' && (
                    <ProgressDashboard
                      userId={currentUserId}
                      onScenarioSelect={(scenarioId) => handleScenarioSelect(scenarioId)}
                    />
                  )}

                  {activeInsightsTab === 'health' && (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <SystemCollapseMonitor
                          components={workspaceComponents}
                          collapseEvents={collapseEvents}
                          recoveryEvents={recoveryEvents}
                          showRecoveryTimeline
                        />
                      </div>
                      <div className="flex-1">
                        <BottleneckVisualizer
                          components={workspaceComponents}
                          componentMetrics={componentMetrics}
                          onComponentSelect={(componentId) => {
                            const component = workspaceComponents.find(c => c.id === componentId) || null;
                            setSelectedComponent(component);
                          }}
                          showDetails
                          enableAnimation
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right resize handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize details panel"
              className="w-1 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300"
              onMouseDown={(event) => handleHorizontalDrag(event, 'right')}
            />

            {/* Right Sidebar - Properties & Controls */}
            <aside
              className="flex flex-col gap-4"
              style={{ width: rightSidebarWidth }}
            >
              {/* Component Properties */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Properties</h3>

                {selectedComponent ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm text-gray-600 mb-2">Component Details</h4>
                      <p className="text-base font-semibold text-gray-900 mb-1">
                        {selectedComponent.metadata.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedComponent.metadata.description}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm text-gray-600 mb-2">Configuration</h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Capacity:</span>
                          <span className="font-medium text-gray-900">{selectedComponent.configuration.capacity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Latency:</span>
                          <span className="font-medium text-gray-900">{selectedComponent.configuration.latency}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Failure Rate:</span>
                          <span className="font-medium text-gray-900">
                            {(selectedComponent.configuration.failureRate * 100).toFixed(3)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm text-gray-600 mb-2">Position</h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">X:</span>
                          <span className="font-medium text-gray-900">{selectedComponent.position.x}px</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Y:</span>
                          <span className="font-medium text-gray-900">{selectedComponent.position.y}px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Select a component to view its properties
                  </p>
                )}
              </div>

              {/* Scale Control */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <ScaleControl
                  currentScale={currentScale}
                  onScaleChange={handleScaleChange}
                  isSimulationRunning={isSimulationRunning}
                  onStartSimulation={handleStartSimulation}
                  onStopSimulation={handleStopSimulation}
                />
              </div>

              {/* Simulation Time */}
              {isSimulationRunning && (
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">Elapsed Time</span>
                    <span className="text-2xl font-bold text-blue-600">{elapsedTime}s</span>
                  </div>
                </div>
              )}

              {/* Metrics Dashboard (docked) */}
              {showMetricsPanel && isSimulationRunning && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Metrics Dashboard</h3>
                    <button
                      type="button"
                      onClick={() => setShowMetricsPanel(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <MetricsDashboard
                    isVisible={true}
                    systemMetrics={systemMetrics}
                    componentMetrics={componentMetrics}
                    bottlenecks={Array.from(bottlenecksMap.values())}
                    simulationStatus={isSimulationRunning ? 'running' : 'idle'}
                    elapsedTime={elapsedTime}
                  />
                </div>
              )}

              {/* Cost Dashboard (docked) */}
              {showCostPanel && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Cost Dashboard</h3>
                    <button
                      type="button"
                      onClick={() => setShowCostPanel(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <CostDashboard
                    components={workspaceComponents}
                    userCount={currentScale}
                  />
                </div>
              )}

              {/* Scalability Dashboard (docked) */}
              {showScalabilityPanel && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Scalability Dashboard</h3>
                    <button
                      type="button"
                      onClick={() => setShowScalabilityPanel(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <ScalabilityDashboard apiBaseUrl={API_BASE_URL} />
                </div>
              )}

              {/* Learning Panels (docked) */}
              {showHintsPanel && isSimulationRunning && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Hints</h3>
                    <button
                      type="button"
                      onClick={() => setShowHintsPanel(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <HintsPanel
                      context={{
                        userId: currentUserId,
                        scenarioId: 'demo-scenario',
                        currentTime: elapsedTime,
                        userPerformance: {
                          latency: systemMetrics?.averageLatency || 0,
                          throughput: systemMetrics?.totalThroughput || 0,
                          errorRate: systemMetrics?.systemErrorRate || 0
                        },
                        recentActions: [],
                        componentsAdded: workspaceComponents.map(c => c.type),
                        connectionsCreated: workspaceConnections.length,
                        errorsEncountered: [],
                        timeStuckOnCurrentStep: bottlenecksMap.size > 0 ? elapsedTime : 0
                      }}
                      currentDifficulty="beginner"
                      isActive={true}
                      onHintInteraction={(hintId, action) => {
                        console.log('Hint interaction:', hintId, action);
                      }}
                      onExplanationRequested={(concept) => {
                        console.log('Explanation requested:', concept);
                      }}
                    />
                  </div>
                </div>
              )}

              {showConstraintsPanel && isSimulationRunning && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Progressive Constraints</h3>
                    <button
                      type="button"
                      onClick={() => setShowConstraintsPanel(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <ProgressiveConstraintsPanel
                    scenarioId="demo-scenario"
                    sessionId={constraintSessionId}
                    userId={currentUserId}
                    currentTime={elapsedTime}
                    isActive={true}
                    onConstraintActivated={(constraint) => {
                      console.log('Constraint activated:', constraint);
                    }}
                    onPerformanceUpdate={(metrics) => {
                      console.log('Performance updated:', metrics);
                    }}
                  />
                </div>
              )}

              {/* Failure Injection Panel (docked) */}
              {showFailurePanel && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Failure Injection</h3>
                    <button
                      type="button"
                      onClick={() => setShowFailurePanel(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <FailureInjectionPanel
                    isVisible={true}
                    components={workspaceComponents.map(c => ({
                      id: c.id,
                      name: c.metadata.name,
                      type: c.type
                    }))}
                    activeFailures={activeFailures}
                    onInjectFailure={handleInjectFailure}
                    onRemoveFailure={handleRemoveFailure}
                    simulationRunning={isSimulationRunning}
                  />
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Modals and collaboration */}
      <WorkspaceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        userId={currentUserId}
      />

      <CollaborationPresence
        participants={collaborationState.participants}
        currentUserId={currentUserId}
      />
    </DndProviderFixed>
  );
};