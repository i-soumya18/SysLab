/**
 * Workspace Component - Main application workspace
 * Combines the component palette and canvas with drag-and-drop functionality
 */

import React, { useEffect, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
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
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { useCollaboration } from '../hooks/useCollaboration';
import { WorkspaceApiService } from '../services/workspaceApi';
import { scenarioApi } from '../services/scenarioApi';
import type { BottleneckInfo, Component, ComponentMetrics, SystemMetrics } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

// Fix React types compatibility with react-dnd
const DndProviderFixed = DndProvider as any;

export const Workspace: React.FC = () => {
  const { user } = useFirebaseAuthContext();
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
  const [_simulationId, setSimulationId] = useState<string | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | undefined>(undefined);
  const [componentMetrics, setComponentMetrics] = useState<Map<string, ComponentMetrics>>(new Map());
  const [bottlenecksMap, setBottlenecksMap] = useState<Map<string, BottleneckInfo>>(new Map());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const metricsPollingRef = useRef<NodeJS.Timeout | null>(null);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [collapseEvents] = useState<CollapseEvent[]>([]);
  const [recoveryEvents] = useState<RecoveryEvent[]>([]);
  const [completedScenarios] = useState<string[]>([]);
  const [activeInsightsTab, setActiveInsightsTab] = useState<'scenarios' | 'progress' | 'health'>('scenarios');

  // Learning panels state (SRS FR-9.2, FR-9.3, FR-6)
  const [showHintsPanel, _setShowHintsPanel] = useState<boolean>(true);
  const [showConstraintsPanel, _setShowConstraintsPanel] = useState<boolean>(true);
  const [showFailurePanel, _setShowFailurePanel] = useState<boolean>(true);
  const [activeFailures, setActiveFailures] = useState<FailureInjection[]>([]);
  const [constraintSessionId] = useState<string>(`session-${Date.now()}`);

  const { collaborationState } = useCollaboration({
    workspaceId: currentWorkspaceId,
    userId: currentUserId,
    enabled: true
  });

  useEffect(() => {
    if (user?.uid) {
      setCurrentUserId(user.uid);
    }
  }, [user]);

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
    // TODO: Reload the workspace or update the UI with the imported workspace
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

      setIsSimulationRunning(true);
      setElapsedTime(0);

      // Build workspace configuration
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

      console.log('Starting simulation with workspace:', workspace);

      // Call POST /api/v1/simulation/start with workspace data
      const response = await fetch(`${API_BASE_URL}/simulation/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId: currentWorkspaceId,
          workspace: workspace,
          userCount: currentScale,
          duration: 60
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to start simulation: ${response.statusText}`);
      }

      const data = await response.json();
      setSimulationId(data.simulationId);

      // Start elapsed time tracking
      simulationTimerRef.current = setInterval(() => {
        setElapsedTime(prevTime => prevTime + 1);
      }, 1000);

      // Start metrics polling
      pollMetrics(data.simulationId);

      console.log('Simulation started with ID:', data.simulationId, 'Scale:', currentScale, 'users');
    } catch (error: any) {
      console.error('Failed to start simulation:', error);
      setIsSimulationRunning(false);
      alert(`Failed to start simulation: ${error.message}`);
    }
  };

  const pollMetrics = (simId: string) => {
    // Clear any existing polling
    if (metricsPollingRef.current) {
      clearInterval(metricsPollingRef.current);
    }

    // Poll metrics every 2 seconds
    metricsPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/simulation/metrics/${simId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }

        const data = await response.json();

        // Update system metrics
        if (data.system) {
          setSystemMetrics(data.system);
        }

        // Update component metrics
        if (data.components && Array.isArray(data.components)) {
          const metricsMap = new Map<string, ComponentMetrics>();
          data.components.forEach((metric: ComponentMetrics) => {
            metricsMap.set(metric.componentId, metric);
          });
          setComponentMetrics(metricsMap);
        }

        // Store bottlenecks in a Map keyed by componentId for easy lookup
        if (data.bottlenecks && Array.isArray(data.bottlenecks)) {
          const bottleneckMap = new Map<string, BottleneckInfo>();
          data.bottlenecks.forEach((bottleneck: BottleneckInfo) => {
            bottleneckMap.set(bottleneck.componentId, bottleneck);
          });
          setBottlenecksMap(bottleneckMap);
        }

        // Check if simulation has completed
        if (data.status === 'completed' || data.status === 'failed') {
          handleStopSimulation();
        }
      } catch (error) {
        console.error('Error polling metrics:', error);
      }
    }, 2000);
  };

  const handleStopSimulation = () => {
    setIsSimulationRunning(false);

    // Clear timers
    if (metricsPollingRef.current) {
      clearInterval(metricsPollingRef.current);
      metricsPollingRef.current = null;
    }

    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    console.log('Simulation stopped');
  };

  // Failure Injection handlers (SRS FR-6)
  const handleInjectFailure = (failure: Omit<FailureInjection, 'id'>) => {
    const newFailure: FailureInjection = {
      ...failure,
      id: `failure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now()
    };
    setActiveFailures(prev => [...prev, newFailure]);
    console.log('Failure injected:', newFailure);
    // TODO: Call backend API to inject failure in simulation
    // await fetch('/api/v1/failure-injection/inject', {
    //   method: 'POST',
    //   body: JSON.stringify(newFailure)
    // });
  };

  const handleRemoveFailure = (failureId: string) => {
    setActiveFailures(prev => prev.filter(f => f.id !== failureId));
    console.log('Failure removed:', failureId);
    // TODO: Call backend API to remove failure
    // await fetch('/api/v1/failure-injection/remove', {
    //   method: 'POST',
    //   body: JSON.stringify({ failureId })
    // });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (metricsPollingRef.current) {
        clearInterval(metricsPollingRef.current);
      }
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, []);

  return (
    <DndProviderFixed backend={HTML5Backend}>
      <div style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Component Palette */}
        <div style={{
          width: '220px',
          backgroundColor: '#fff',
          borderRight: '1px solid #e0e0e0',
          padding: '10px'
        }}>
          <ComponentPalette />
        </div>

        {/* Main Canvas Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}>
          {/* Toolbar */}
          <div style={{
            height: '60px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            marginBottom: '20px',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              System Design Simulator
            </h1>
            
            <div style={{
              display: 'flex',
              gap: '10px'
            }}>
              <button
                onClick={() => setIsImportModalOpen(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Import Workspace
              </button>
              <button
                onClick={handleExportWorkspace}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Export Workspace
              </button>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                Save Workspace
              </button>
              <button
                onClick={isSimulationRunning ? handleStopSimulation : handleStartSimulation}
                disabled={workspaceComponents.length === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isSimulationRunning ? '#dc3545' : (workspaceComponents.length === 0 ? '#6c757d' : '#28a745'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: workspaceComponents.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: workspaceComponents.length === 0 ? 0.6 : 1
                }}
                title={workspaceComponents.length === 0 ? 'Add components to the canvas first' : (isSimulationRunning ? 'Stop simulation' : 'Run simulation')}
              >
                {isSimulationRunning ? '⏹ Stop Simulation' : '▶ Run Simulation'}
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div style={{
            flex: 1,
            display: 'flex',
            gap: '20px'
          }}>
            {/* Canvas */}
            <div style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}>
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

            {/* Properties Panel */}
            <div style={{
              width: '300px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Component Properties */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '20px'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Properties
                </h3>
                
                {selectedComponent ? (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                        Component Details
                      </h4>
                      <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                        {selectedComponent.metadata.name}
                      </p>
                      <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                        {selectedComponent.metadata.description}
                      </p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                        Configuration
                      </h4>
                      <div style={{ fontSize: '12px', color: '#333' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Capacity:</strong> {selectedComponent.configuration.capacity}
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Latency:</strong> {selectedComponent.configuration.latency}ms
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Failure Rate:</strong> {(selectedComponent.configuration.failureRate * 100).toFixed(3)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                        Position
                      </h4>
                      <div style={{ fontSize: '12px', color: '#333' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>X:</strong> {selectedComponent.position.x}px
                        </div>
                        <div>
                          <strong>Y:</strong> {selectedComponent.position.y}px
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{
                    color: '#666',
                    fontSize: '14px',
                    fontStyle: 'italic'
                  }}>
                    Select a component to view its properties
                  </p>
                )}
              </div>

              {/* Scale Control - MVLE-3 */}
              <div>
                <ScaleControl
                  currentScale={currentScale}
                  onScaleChange={handleScaleChange}
                  isSimulationRunning={isSimulationRunning}
                  onStartSimulation={handleStartSimulation}
                  onStopSimulation={handleStopSimulation}
                />
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div style={{ marginTop: '10px' }}>
            <StatusBar
              selectedComponent={selectedComponent}
              componentCount={componentCount}
            />
          </div>

          {/* Insights Panel: Scenarios, Progress, System Health */}
          <div
            style={{
              marginTop: '16px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveInsightsTab('scenarios')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: activeInsightsTab === 'scenarios' ? '#007bff' : '#f1f3f5',
                    color: activeInsightsTab === 'scenarios' ? '#ffffff' : '#495057'
                  }}
                >
                  Scenarios
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInsightsTab('progress')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: activeInsightsTab === 'progress' ? '#007bff' : '#f1f3f5',
                    color: activeInsightsTab === 'progress' ? '#ffffff' : '#495057'
                  }}
                >
                  Progress
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInsightsTab('health')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: activeInsightsTab === 'health' ? '#007bff' : '#f1f3f5',
                    color: activeInsightsTab === 'health' ? '#ffffff' : '#495057'
                  }}
                >
                  System Health
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#868e96' }}>
                Learn, track progress, and monitor stability as you iterate.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                maxHeight: '260px',
                overflow: 'hidden'
              }}
            >
              {activeInsightsTab === 'scenarios' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <ScenarioLibrary
                    userId={currentUserId}
                    completedScenarios={completedScenarios}
                    onScenarioSelect={(scenario) => handleScenarioSelect(scenario.id)}
                    onScenarioLoad={handleScenarioLoad}
                  />
                </div>
              )}

              {activeInsightsTab === 'progress' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <ProgressDashboard
                    userId={currentUserId}
                    onScenarioSelect={(scenarioId) => handleScenarioSelect(scenarioId)}
                  />
                </div>
              )}

              {activeInsightsTab === 'health' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <SystemCollapseMonitor
                    components={workspaceComponents}
                    collapseEvents={collapseEvents}
                    recoveryEvents={recoveryEvents}
                    showRecoveryTimeline
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <WorkspaceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        userId={currentUserId}
      />

      {/* Collaboration Presence Overlay */}
      <CollaborationPresence
        participants={collaborationState.participants}
        currentUserId={currentUserId}
      />

      {/* Metrics Dashboard - MVLE-6 */}
      <MetricsDashboard
        isVisible={isSimulationRunning}
        systemMetrics={systemMetrics}
        componentMetrics={componentMetrics}
        bottlenecks={Array.from(bottlenecksMap.values())}
        simulationStatus={isSimulationRunning ? 'running' : 'idle'}
        elapsedTime={elapsedTime}
      />

      {/* Hints Panel - SRS FR-9.3 */}
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
          recentActions: [], // TODO: Track user actions
          componentsAdded: workspaceComponents.map(c => c.type),
          connectionsCreated: workspaceConnections.length,
          errorsEncountered: [], // TODO: Track errors
          timeStuckOnCurrentStep: bottlenecksMap.size > 0 ? elapsedTime : 0
        }}
        currentDifficulty="beginner"
        isActive={showHintsPanel && isSimulationRunning}
        onHintInteraction={(hintId, action) => {
          console.log('Hint interaction:', hintId, action);
        }}
        onExplanationRequested={(concept) => {
          console.log('Explanation requested:', concept);
        }}
      />

      {/* Progressive Constraints Panel - SRS FR-9.2 */}
      <ProgressiveConstraintsPanel
        scenarioId="demo-scenario"
        sessionId={constraintSessionId}
        userId={currentUserId}
        currentTime={elapsedTime}
        isActive={showConstraintsPanel && isSimulationRunning}
        onConstraintActivated={(constraint) => {
          console.log('Constraint activated:', constraint);
        }}
        onPerformanceUpdate={(metrics) => {
          console.log('Performance updated:', metrics);
        }}
      />

      {/* Failure Injection Panel - SRS FR-6 */}
      <FailureInjectionPanel
        isVisible={showFailurePanel}
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
    </DndProviderFixed>
  );
};