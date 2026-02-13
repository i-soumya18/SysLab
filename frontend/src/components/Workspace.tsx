/**
 * Workspace Component - Main application workspace
 * Combines the component palette and canvas with drag-and-drop functionality
 */

import React, { useCallback, useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { ComponentConfigPanel } from './ComponentConfigPanel';
import { ResizableCard } from './ResizableCard';
import { componentLibrary } from './ComponentLibrary';
import type {
  BottleneckInfo,
  Component,
  ComponentMetrics,
  Connection,
  SimulationConfig,
  SystemMetrics,
  Workspace as WorkspaceModel
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Fix React types compatibility with react-dnd
const DndProviderFixed = DndProvider as any;

// Helper function to check if a string is a valid UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export const Workspace: React.FC = () => {
  const { id: routeWorkspaceId } = useParams<{ id?: string }>();
  const { user } = useFirebaseAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('demo-workspace-id');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [componentCount, setComponentCount] = useState<number>(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('anonymous-user');
  const [currentScale, setCurrentScale] = useState<number>(100); // Default to 100 users for MVLE-3
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(false);

  // Workspace data - track components and connections
  const [workspaceComponents, setWorkspaceComponents] = useState<Component[]>([]);
  const [workspaceConnections, setWorkspaceConnections] = useState<Connection[]>([]);
  const [workspaceMeta, setWorkspaceMeta] = useState<WorkspaceModel | null>(null);

  // Simulation state
  const [_simulationId, _setSimulationId] = useState<string | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | undefined>(undefined);
  const [componentMetrics, setComponentMetrics] = useState<Map<string, ComponentMetrics>>(new Map());
  const [bottlenecksMap, setBottlenecksMap] = useState<Map<string, BottleneckInfo>>(new Map());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [collapseEvents, setCollapseEvents] = useState<CollapseEvent[]>([]);
  const [recoveryEvents, setRecoveryEvents] = useState<RecoveryEvent[]>([]);
  const [loadPattern, setLoadPattern] = useState<{ currentLoad: number; pattern: string } | null>(null);
  const [completedScenarios] = useState<string[]>([]);
  const [activeInsightsTab, setActiveInsightsTab] = useState<'scenarios' | 'progress' | 'health'>('scenarios');
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);

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
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  
  // Individual card heights for right sidebar
  const [propertiesPanelHeight, setPropertiesPanelHeight] = useState<number>(300);
  const [scaleControlHeight, setScaleControlHeight] = useState<number>(340);
  const [simulationTimeHeight, setSimulationTimeHeight] = useState<number>(80);
  const [metricsPanelHeight, setMetricsPanelHeight] = useState<number>(250);
  const [costPanelHeight, setCostPanelHeight] = useState<number>(200);
  const [scalabilityPanelHeight, setScalabilityPanelHeight] = useState<number>(250);
  const [hintsPanelHeight, setHintsPanelHeight] = useState<number>(200);
  const [constraintsPanelHeight, setConstraintsPanelHeight] = useState<number>(200);
  const [failurePanelHeight, setFailurePanelHeight] = useState<number>(200);

  const minLeftSidebarWidth = 200;
  const maxLeftSidebarWidth = 400;
  const minRightSidebarWidth = 260;
  const maxRightSidebarWidth = 420;
  const minInsightsHeight = 160;
  const maxInsightsHeight = 400;

  // Save / autosave state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);

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
      setWorkspaceMeta(loadedWorkspace);
      // Clear scenario ID when loading a regular workspace (not from scenario)
      setCurrentScenarioId(null);
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

  // Subscribe to bottleneck events
  useEffect(() => {
    if (!subscribe) return;
    
    const unsubscribe = subscribe('simulation:bottleneck', (payload: { data?: BottleneckInfo[] | BottleneckInfo; type?: string }) => {
      const data = payload?.data;
      if (!data) {
        return;
      }

      const list = Array.isArray(data) ? data : [data];
      const next = new Map<string, BottleneckInfo>();
      list.forEach(bottleneck => {
        if (bottleneck && bottleneck.componentId) {
          next.set(bottleneck.componentId, bottleneck);
        }
      });
      
      // Only update if bottlenecks actually changed
      setBottlenecksMap(prev => {
        if (prev.size === next.size && 
            Array.from(prev.keys()).every(id => next.has(id) && prev.get(id) === next.get(id))) {
          return prev; // No change
        }
        return next;
      });

      // Auto-show hints panel when bottlenecks are detected
      if (list.length > 0 && isSimulationRunning && !showHintsPanel) {
        setShowHintsPanel(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe, isSimulationRunning, showHintsPanel]);

  // Subscribe to load pattern events
  useEffect(() => {
    if (!subscribe) return;
    
    const unsubscribe = subscribe('simulation:load', (payload: { type?: string; data?: any }) => {
      if (!payload?.data) return;
      
      if (payload.type === 'load_changed') {
        const patternData = payload.data.pattern || payload.data.type;
        const patternString = typeof patternData === 'string' 
          ? patternData 
          : (patternData?.type || 'unknown');
        const currentLoad = payload.data.currentLoad || payload.data.load || patternData?.baseLoad || 0;
        
        setLoadPattern(prev => {
          const newPattern = {
            currentLoad: typeof currentLoad === 'number' ? currentLoad : 0,
            pattern: patternString
          };
          // Only update if values actually changed
          if (prev?.currentLoad === newPattern.currentLoad && prev?.pattern === newPattern.pattern) {
            return prev;
          }
          return newPattern;
        });
      } else if (payload.type === 'load_pattern_scheduled') {
        const patternData = payload.data.pattern || payload.data.type;
        const patternString = typeof patternData === 'string' 
          ? patternData 
          : (patternData?.type || 'scheduled');
        const expectedLoad = payload.data.expectedLoad || patternData?.baseLoad || 0;
        
        setLoadPattern(prev => {
          const newPattern = {
            currentLoad: typeof expectedLoad === 'number' ? expectedLoad : 0,
            pattern: patternString
          };
          // Only update if values actually changed
          if (prev?.currentLoad === newPattern.currentLoad && prev?.pattern === newPattern.pattern) {
            return prev;
          }
          return newPattern;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  // Subscribe to collapse and recovery events
  useEffect(() => {
    const unsubscribeFailure = subscribe('simulation:failure', (payload: { type?: string; data?: any }) => {
      if (payload?.type === 'random_failure_occurred' || payload?.type === 'failure_injected') {
        const failureData = payload.data;
        if (failureData?.componentId) {
          const collapseEvent: CollapseEvent = {
            id: `collapse-${Date.now()}-${Math.random()}`,
            componentId: failureData.componentId,
            componentType: failureData.componentType || 'unknown',
            timestamp: failureData.timestamp || Date.now(),
            reason: failureData.reason || failureData.type || 'Component failure',
            severity: failureData.severity || 'high',
            impact: failureData.impact || { affectedComponents: [], systemWide: false }
          };
          setCollapseEvents(prev => [...prev.slice(-49), collapseEvent]); // Keep last 50 events
        }
      }
    });

    const unsubscribeEvent = subscribe('simulation:event', (payload: { type?: string; data?: any }) => {
      if (payload?.type === 'component_failed') {
        const failureData = payload.data;
        if (failureData?.componentId) {
          const collapseEvent: CollapseEvent = {
            id: `collapse-${Date.now()}-${Math.random()}`,
            componentId: failureData.componentId,
            componentType: failureData.componentType || 'unknown',
            timestamp: failureData.timestamp || Date.now(),
            reason: 'Component failure detected',
            severity: 'high',
            impact: { affectedComponents: [failureData.componentId], systemWide: false }
          };
          setCollapseEvents(prev => [...prev.slice(-49), collapseEvent]);
        }
      } else if (payload?.type === 'component_recovered') {
        const recoveryData = payload.data;
        if (recoveryData?.componentId) {
          const recoveryEvent: RecoveryEvent = {
            id: `recovery-${Date.now()}-${Math.random()}`,
            componentId: recoveryData.componentId,
            componentType: recoveryData.componentType || 'unknown',
            timestamp: recoveryData.timestamp || Date.now(),
            recoveryTime: recoveryData.recoveryTime || 0,
            strategy: recoveryData.strategy || 'automatic'
          };
          setRecoveryEvents(prev => [...prev.slice(-49), recoveryEvent]); // Keep last 50 events
        }
      }
    });

    return () => {
      unsubscribeFailure();
      unsubscribeEvent();
    };
  }, [subscribe]);

  const handleComponentAdd = (component: Component) => {
    console.log('Component added:', component);
    setWorkspaceComponents(prev => [...prev, component]);
  };

  const handleComponentSelect = (component: Component | null) => {
    setSelectedComponent(component);
    // Don't auto-open config panel - user must click "Configure" from menu
    if (!component) {
      setShowConfigPanel(false);
    }
    console.log('Component selected:', component);
  };

  const handleComponentConfigure = useCallback(() => {
    if (selectedComponent) {
      setShowConfigPanel(true);
    }
  }, [selectedComponent]);

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
    setWorkspaceConnections(prev => [...prev, connection as Connection]);
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
      // Show loading state
      setIsSaving(true);
      
      // Store the current scenario ID
      setCurrentScenarioId(scenarioId);
      
      const result = await scenarioApi.loadScenario(scenarioId, currentUserId);
      const loadedWorkspace = result.workspace as WorkspaceModel;
      const scenario = result.scenario;
      
      // Build components from component keys if scenario provides them
      let componentsToLoad: Component[] = [];
      
      // First, try to use components from loaded workspace
      if (loadedWorkspace.components && loadedWorkspace.components.length > 0) {
        componentsToLoad = loadedWorkspace.components.map((comp: any) => {
          // If component has componentKey, create it from component library
          if (comp.componentKey && comp.type) {
            const libraryComponent = componentLibrary.createComponent(
              comp.componentKey,
              comp.type,
              comp.position || { x: 100, y: 100 },
              comp.configuration
            );
            if (libraryComponent) {
              // Preserve the original ID if provided, and position
              return { 
                ...libraryComponent, 
                id: comp.id || libraryComponent.id,
                position: comp.position || libraryComponent.position
              };
            }
          }
          // Otherwise use component as-is, ensuring it has required fields
          return {
            ...comp,
            id: comp.id || `component-${Date.now()}-${Math.random()}`,
            position: comp.position || { x: 100, y: 100 },
            metadata: comp.metadata || { name: comp.type, version: '1.0' }
          } as Component;
        });
      }
      // If no components in workspace, try scenario's initialWorkspace
      else if (scenario?.initialWorkspace?.components && scenario.initialWorkspace.components.length > 0) {
        componentsToLoad = scenario.initialWorkspace.components.map((comp: any, index: number) => {
          // If component has componentKey, create it from component library
          if (comp.componentKey && comp.type) {
            const libraryComponent = componentLibrary.createComponent(
              comp.componentKey,
              comp.type,
              comp.position || { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 150 },
              comp.configuration
            );
            if (libraryComponent) {
              return { 
                ...libraryComponent, 
                id: comp.id || libraryComponent.id,
                position: comp.position || libraryComponent.position
              };
            }
          }
          // Otherwise create a basic component
          return {
            id: comp.id || `component-${Date.now()}-${index}`,
            type: comp.type,
            position: comp.position || { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 150 },
            configuration: comp.configuration || { capacity: 1000, latency: 50, failureRate: 0.01 },
            metadata: comp.metadata || { name: comp.type, version: '1.0' }
          } as Component;
        });
      }
      
      // Build a mapping from old component IDs to new UUID IDs BEFORE converting
      // This ensures connections can reference the correct component IDs
      const componentIdMap = new Map<string, string>();
      componentsToLoad.forEach(comp => {
        const oldId = comp.id;
        if (oldId && !isValidUUID(oldId)) {
          // Generate a new UUID for non-UUID IDs
          const newId = crypto.randomUUID();
          componentIdMap.set(oldId, newId);
        }
      });
      
      // Ensure all components have proper UUID IDs and positions
      // Use the mapping we just created to preserve ID relationships
      componentsToLoad = componentsToLoad.map((comp: Component, index: number) => {
        const oldId = comp.id;
        let newId: string;
        
        if (oldId && isValidUUID(oldId)) {
          // Already a UUID, keep it
          newId = oldId;
        } else if (oldId && componentIdMap.has(oldId)) {
          // Use the mapped UUID
          newId = componentIdMap.get(oldId)!;
        } else {
          // Generate a new UUID if somehow missing
          newId = crypto.randomUUID();
          if (oldId) {
            componentIdMap.set(oldId, newId);
          }
        }
        
        return {
          ...comp,
          id: newId,
          position: comp.position || { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 150 }
        };
      });
      
      // Ensure connections reference valid component IDs and have UUID IDs
      // Use the componentIdMap to translate old IDs to new UUIDs
      const validComponentIds = new Set(componentsToLoad.map(c => c.id));
      const connectionsToLoad = (loadedWorkspace.connections || scenario?.initialWorkspace?.connections || [])
        .map((conn: Connection) => {
          // Map old component IDs to new UUIDs using the componentIdMap
          let sourceId = conn.sourceComponentId;
          let targetId = conn.targetComponentId;
          
          // Check if the connection references an old ID that needs mapping
          if (componentIdMap.has(sourceId)) {
            sourceId = componentIdMap.get(sourceId)!;
          }
          if (componentIdMap.has(targetId)) {
            targetId = componentIdMap.get(targetId)!;
          }
          
          // Ensure both IDs are valid UUIDs (should be after mapping)
          if (!isValidUUID(sourceId)) {
            console.warn(`Connection source ID ${sourceId} is not a valid UUID, skipping connection`);
            return null;
          }
          if (!isValidUUID(targetId)) {
            console.warn(`Connection target ID ${targetId} is not a valid UUID, skipping connection`);
            return null;
          }
          
          return {
            ...conn,
            id: (conn.id && isValidUUID(conn.id)) ? conn.id : crypto.randomUUID(),
            sourceComponentId: sourceId,
            targetComponentId: targetId
          };
        })
        .filter((conn: Connection | null): conn is Connection => 
          conn !== null && 
          validComponentIds.has(conn.sourceComponentId) && 
          validComponentIds.has(conn.targetComponentId)
        );
      
      // When loading a scenario, always create a new workspace (don't use the UUID from the scenario)
      // Scenarios are templates - they should always result in new workspace creation
      const workspaceId = 'demo-workspace-id';
      
      setCurrentWorkspaceId(workspaceId);
      setWorkspaceComponents(componentsToLoad);
      setWorkspaceConnections(connectionsToLoad);
      setWorkspaceMeta({
        ...loadedWorkspace,
        id: workspaceId,
        configuration: loadedWorkspace.configuration || scenario?.initialWorkspace?.configuration || buildSimulationConfig()
      });
      
      // Close scenario library panel
      setActiveInsightsTab('scenarios');
      
      // Save the workspace immediately so user can start experimenting
      if (componentsToLoad.length > 0) {
        // Trigger save after state updates - this will create a new workspace if ID is invalid
        setTimeout(async () => {
          try {
            await saveWorkspace({ silent: true });
          } catch (error) {
            console.error('Failed to save scenario workspace:', error);
            // Don't show error to user if silent save fails - they can still use the workspace
          } finally {
            setIsSaving(false);
          }
        }, 200);
      } else {
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Failed to load scenario into workspace:', error);
      setIsSaving(false);
      alert('Failed to load scenario. Please try again.');
    }
  };

  const handleScaleChange = (userCount: number) => {
    setCurrentScale(userCount);
    console.log('Scale changed to:', userCount, 'users');
  };

  const buildSimulationConfig = useCallback((): SimulationConfig => ({
    duration: 60,
    loadPattern: {
      type: 'constant',
      baseLoad: currentScale * 2
    },
    failureScenarios: [],
    metricsCollection: {
      collectionInterval: 1000,
      retentionPeriod: 300,
      enabledMetrics: ['latency', 'throughput', 'errorRate', 'resourceUtilization']
    }
  }), [currentScale]);

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
        name: workspaceMeta?.name ?? 'Demo Workspace',
        description: workspaceMeta?.description ?? 'System design simulation workspace',
        userId: currentUserId,
        components: workspaceComponents,
        connections: workspaceConnections,
        configuration: workspaceMeta?.configuration ?? buildSimulationConfig(),
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
    if (!isSimulationRunning) {
      // No simulation running, nothing to stop
      return;
    }
    
    setIsSimulationRunning(false);
    wsStopSimulation().catch(error => {
      // eslint-disable-next-line no-console
      console.error('Failed to stop simulation via WebSocket:', error);
      // Don't show error to user if simulation wasn't actually running
      if (error.message && error.message.includes('No running simulation')) {
        // Silently ignore - simulation was already stopped
        return;
      }
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

  const saveWorkspace = useCallback(async (options?: { silent?: boolean }) => {
    if (!currentUserId) {
      return;
    }

    if (workspaceComponents.length === 0 && workspaceConnections.length === 0) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      // Clean components - remove any extra fields like componentKey that aren't in the schema
      // Ensure all IDs are valid UUIDs
      const cleanedComponents = workspaceComponents.map(comp => {
        const compId = isValidUUID(comp.id) ? comp.id : crypto.randomUUID();
        return {
          id: compId,
          type: comp.type,
          position: comp.position,
          configuration: comp.configuration,
          metadata: comp.metadata
        };
      });

      // Create a mapping for component ID updates
      const componentIdUpdateMap = new Map<string, string>();
      workspaceComponents.forEach((comp, idx) => {
        if (!isValidUUID(comp.id)) {
          componentIdUpdateMap.set(comp.id, cleanedComponents[idx].id);
        }
      });

      // Clean connections - ensure all required fields are present and IDs are UUIDs
      const cleanedConnections = workspaceConnections.map(conn => {
        const connId = isValidUUID(conn.id) ? conn.id : crypto.randomUUID();
        let sourceId = conn.sourceComponentId;
        let targetId = conn.targetComponentId;
        
        // Update component IDs if they were changed
        if (componentIdUpdateMap.has(sourceId)) {
          sourceId = componentIdUpdateMap.get(sourceId)!;
        }
        if (componentIdUpdateMap.has(targetId)) {
          targetId = componentIdUpdateMap.get(targetId)!;
        }
        
        // Ensure source and target IDs are valid UUIDs
        if (!isValidUUID(sourceId)) {
          sourceId = crypto.randomUUID();
        }
        if (!isValidUUID(targetId)) {
          targetId = crypto.randomUUID();
        }
        
        return {
          id: connId,
          sourceComponentId: sourceId,
          targetComponentId: targetId,
          sourcePort: conn.sourcePort,
          targetPort: conn.targetPort,
          configuration: conn.configuration
        };
      }).filter(conn => {
        // Ensure both source and target components exist
        const sourceExists = cleanedComponents.some(c => c.id === conn.sourceComponentId);
        const targetExists = cleanedComponents.some(c => c.id === conn.targetComponentId);
        return sourceExists && targetExists;
      });

      const payload = {
        name: workspaceMeta?.name ?? 'New Workspace',
        description: workspaceMeta?.description ?? 'A system design workspace',
        userId: currentUserId,
        components: cleanedComponents,
        connections: cleanedConnections,
        configuration: workspaceMeta?.configuration ?? buildSimulationConfig()
      };

      let nextWorkspaceId = currentWorkspaceId;
      let response: Response;

      // Create new workspace if:
      // 1. It's a demo workspace ID
      // 2. It's not a valid UUID format (e.g., scenario-generated IDs)
      // 3. No route workspace ID exists
      if (
        (currentWorkspaceId === 'demo-workspace-id' || !isValidUUID(currentWorkspaceId)) &&
        !routeWorkspaceId
      ) {
        // Create a new workspace on first save
        response = await fetch(`${API_BASE_URL}/workspaces`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Update existing workspace (only if it's a valid UUID)
        if (!isValidUUID(currentWorkspaceId)) {
          // If somehow we have an invalid UUID, create a new workspace instead
          response = await fetch(`${API_BASE_URL}/workspaces`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        } else {
          // Try to update existing workspace
          response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(currentWorkspaceId)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          // If workspace doesn't exist (404), fall back to creating a new one
          if (response.status === 404) {
            console.warn(`Workspace ${currentWorkspaceId} not found, creating new workspace instead`);
            response = await fetch(`${API_BASE_URL}/workspaces`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });
            // Reset workspace ID so we use the new one from the response
            nextWorkspaceId = 'demo-workspace-id';
          }
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody && errorBody.error && errorBody.error.message) ||
          'Failed to save workspace. Please try again or check your connection.';
        throw new Error(message);
      }

      const body = await response.json().catch(() => null);
      const savedWorkspace: WorkspaceModel | null = body?.data ?? null;

      if (savedWorkspace) {
        nextWorkspaceId = savedWorkspace.id;
        setWorkspaceMeta(savedWorkspace);
        setWorkspaceComponents(savedWorkspace.components || []);
        setWorkspaceConnections(savedWorkspace.connections || []);
      }

      setCurrentWorkspaceId(nextWorkspaceId);
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save workspace:', error);
      if (error instanceof Error) {
        setSaveError(error.message);
        if (!options?.silent) {
          alert(
            `Unable to save your workspace. Your changes are still on this page, but may be lost if you close it. Details: ${error.message}`
          );
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    currentUserId,
    currentWorkspaceId,
    routeWorkspaceId,
    workspaceComponents,
    workspaceConnections,
    workspaceMeta,
    buildSimulationConfig
  ]);

  // Track unsaved changes and trigger autosave
  useEffect(() => {
    if (workspaceComponents.length === 0 && workspaceConnections.length === 0) {
      return;
    }
    setHasUnsavedChanges(true);

    if (!autoSaveEnabled) {
      return;
    }

    const timeout = setTimeout(() => {
      void saveWorkspace({ silent: true });
    }, 4000);

    return () => clearTimeout(timeout);
  }, [workspaceComponents, workspaceConnections, autoSaveEnabled, saveWorkspace]);

  // Warn user before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

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
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-800">Components</h2>
            <p className="text-xs text-gray-500 mt-1">Drag to canvas</p>
          </div>
          <div className="flex-1 overflow-hidden p-3" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ComponentPalette 
              width={leftSidebarWidth - 24} 
              height={undefined}
              onWidthChange={setLeftSidebarWidth}
            />
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
                  onClick={() => {
                    void saveWorkspace();
                  }}
                  disabled={isSaving || !hasUnsavedChanges}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isSaving
                      ? 'bg-blue-300 text-white cursor-wait'
                      : hasUnsavedChanges
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-200 text-gray-600 cursor-default'
                  }`}
                  type="button"
                >
                  {isSaving ? 'Saving…' : hasUnsavedChanges ? 'Save' : 'Saved'}
                </button>
              </div>

              <div className="flex flex-col items-end gap-1">
                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(event) => setAutoSaveEnabled(event.target.checked)}
                    className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Auto-save
                </label>
                {lastSavedAt && (
                  <span className="text-[10px] text-gray-400">
                    Last saved at {lastSavedAt.toLocaleTimeString()}
                  </span>
                )}
                {saveError && (
                  <span className="text-[10px] text-red-500 max-w-[180px] truncate" title={saveError}>
                    {saveError}
                  </span>
                )}
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
              <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-center overflow-auto min-h-0">
                <div className="w-full h-full min-w-[800px] min-h-[500px]">
                  <Canvas
                    width={1000}
                    height={600}
                  initialComponents={workspaceComponents}
                  initialConnections={workspaceConnections}
                  onComponentAdd={handleComponentAdd}
                  onComponentSelect={handleComponentSelect}
                  onComponentUpdate={handleComponentUpdate}
                  onComponentDelete={handleComponentDelete}
                  onComponentCountChange={handleComponentCountChange}
                  onComponentConfigure={handleComponentConfigure}
                  onConnectionCreate={handleConnectionCreate}
                  onConnectionDelete={handleConnectionDelete}
                    bottlenecks={bottlenecksMap}
                  />
                </div>
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
              className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden"
              style={{ width: rightSidebarWidth, maxHeight: 'calc(100vh - 80px)' }}
            >
              {/* Component Properties / Configuration Panel */}
              <ResizableCard
                minHeight={150}
                maxHeight={600}
                defaultHeight={propertiesPanelHeight}
                onResize={setPropertiesPanelHeight}
                className="flex-shrink-0"
                header={
                  selectedComponent ? (
                    showConfigPanel ? (
                      <div className="flex items-center justify-between w-full">
                        <h3 className="text-base font-semibold text-gray-800">Configuration</h3>
                        <button
                          type="button"
                          onClick={() => setShowConfigPanel(false)}
                          className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          View Properties
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <h3 className="text-base font-semibold text-gray-800">Properties</h3>
                        <button
                          type="button"
                          onClick={() => setShowConfigPanel(true)}
                          className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Configure
                        </button>
                      </div>
                    )
                  ) : (
                    <h3 className="text-base font-semibold text-gray-800">Properties</h3>
                  )
                }
                onClose={selectedComponent ? () => {
                  setShowConfigPanel(false);
                  setSelectedComponent(null);
                } : undefined}
              >
                {selectedComponent ? (
                  showConfigPanel ? (
                    <div className="p-4">
                      <ComponentConfigPanel
                        component={selectedComponent}
                        onUpdate={handleComponentUpdate}
                        onClose={() => {
                          setShowConfigPanel(false);
                          setSelectedComponent(null);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
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
                    </div>
                  )
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Select a component to view its properties
                  </p>
                )}
              </ResizableCard>

              {/* Scale Control */}
              <ResizableCard
                minHeight={280}
                maxHeight={500}
                defaultHeight={scaleControlHeight}
                onResize={setScaleControlHeight}
                className="flex-shrink-0"
              >
                <ScaleControl
                  currentScale={currentScale}
                  onScaleChange={handleScaleChange}
                  isSimulationRunning={isSimulationRunning}
                  onStartSimulation={handleStartSimulation}
                  onStopSimulation={handleStopSimulation}
                />
              </ResizableCard>

              {/* Simulation Time */}
              {isSimulationRunning && (
                <ResizableCard
                  minHeight={60}
                  maxHeight={150}
                  defaultHeight={simulationTimeHeight}
                  onResize={setSimulationTimeHeight}
                  className="flex-shrink-0 bg-blue-50 border-blue-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">Elapsed Time</span>
                    <span className="text-2xl font-bold text-blue-600">{elapsedTime}s</span>
                  </div>
                </ResizableCard>
              )}

              {/* Metrics Dashboard (docked) */}
              {showMetricsPanel && (
                <ResizableCard
                  minHeight={150}
                  maxHeight={500}
                  defaultHeight={metricsPanelHeight}
                  onResize={setMetricsPanelHeight}
                  title="Metrics Dashboard"
                  onClose={() => setShowMetricsPanel(false)}
                  className="flex-shrink-0"
                >
                  <div className="h-full overflow-hidden">
                  <MetricsDashboard
                    isVisible={true}
                    systemMetrics={systemMetrics}
                    componentMetrics={componentMetrics}
                    bottlenecks={Array.from(bottlenecksMap.values())}
                    simulationStatus={isSimulationRunning ? 'running' : 'idle'}
                    elapsedTime={elapsedTime}
                    loadPattern={loadPattern}
                  />
                  </div>
                </ResizableCard>
              )}

              {/* Cost Dashboard (docked) */}
              {showCostPanel && (
                <ResizableCard
                  minHeight={150}
                  maxHeight={500}
                  defaultHeight={costPanelHeight}
                  onResize={setCostPanelHeight}
                  title="Cost Dashboard"
                  onClose={() => setShowCostPanel(false)}
                  className="flex-shrink-0"
                >
                  <CostDashboard
                    components={workspaceComponents}
                    userCount={currentScale}
                  />
                </ResizableCard>
              )}

              {/* Scalability Dashboard (docked) */}
              {showScalabilityPanel && (
                <ResizableCard
                  minHeight={150}
                  maxHeight={500}
                  defaultHeight={scalabilityPanelHeight}
                  onResize={setScalabilityPanelHeight}
                  title="Scalability Dashboard"
                  onClose={() => setShowScalabilityPanel(false)}
                  className="flex-shrink-0"
                >
                  <ScalabilityDashboard apiBaseUrl={API_BASE_URL} />
                </ResizableCard>
              )}

              {/* Learning Panels (docked) */}
              {showHintsPanel && isSimulationRunning && (
                <ResizableCard
                  minHeight={150}
                  maxHeight={500}
                  defaultHeight={hintsPanelHeight}
                  onResize={setHintsPanelHeight}
                  title="Hints"
                  onClose={() => setShowHintsPanel(false)}
                  className="flex-shrink-0"
                >
                  <HintsPanel
                    context={{
                      userId: currentUserId,
                      scenarioId: currentScenarioId || 'demo-scenario',
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
                </ResizableCard>
              )}

              {showConstraintsPanel && isSimulationRunning && (
                <ResizableCard
                  minHeight={150}
                  maxHeight={500}
                  defaultHeight={constraintsPanelHeight}
                  onResize={setConstraintsPanelHeight}
                  title="Progressive Constraints"
                  onClose={() => setShowConstraintsPanel(false)}
                  className="flex-shrink-0"
                >
                  <ProgressiveConstraintsPanel
                    scenarioId={currentScenarioId || 'demo-scenario'}
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
                </ResizableCard>
              )}

              {/* Failure Injection Panel (docked) */}
              {showFailurePanel && (
                <ResizableCard
                  minHeight={150}
                  maxHeight={500}
                  defaultHeight={failurePanelHeight}
                  onResize={setFailurePanelHeight}
                  title="Failure Injection"
                  onClose={() => setShowFailurePanel(false)}
                  className="flex-shrink-0"
                >
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
                </ResizableCard>
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