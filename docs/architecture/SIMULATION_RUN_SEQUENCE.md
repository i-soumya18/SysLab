# Sequence Diagram: "Run Simulation" Path

## Primary Path Used by UI
Current workspace UI starts/stops simulation via Socket.IO (`wsStartSimulation`), not via `POST /api/v1/simulation/start`.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant W as Workspace.tsx
  participant H as useWebSocket Hook
  participant C as WebSocketService (socket.io-client)
  participant S as Socket.IO Server
  participant WH as websocket/index.ts handler
  participant E as SimulationEngine
  participant M as MetricsCollector/MetricsStorage
  participant O as Other Clients in Workspace

  U->>W: Click "Run"
  W->>W: Validate workspace has components
  W->>W: Build workspace payload + config
  W->>H: startSimulation({workspace, userCount, duration})
  H->>C: controlSimulation('start', parameters)
  C->>S: emit simulation:control (workspaceId, action=start, params)
  S->>WH: Route event to handler

  WH->>WH: Validate socket workspace authorization
  alt No simulation exists
    WH->>E: new SimulationEngine()
    WH->>WH: setupSimulationEventHandlers(engine)
  end

  WH->>E: initialize(workspace)
  WH->>E: start()
  E->>M: start metrics collection/aggregation/storage
  E-->>WH: emit started + runtime events

  WH-->>C: callback success
  C-->>H: Promise resolve
  H-->>W: success
  W->>W: setIsSimulationRunning(true)

  WH-->>S: simulation:started, simulation:metrics, simulation:progress, simulation:event, simulation:bottleneck...
  S-->>C: stream realtime events
  C-->>H: event listeners update state
  H-->>W: simulationMetrics/progress/status updates
  W-->>U: Live dashboards + bottlenecks + status updates
  S-->>O: Broadcast same simulation events to collaborators
```

## Stop Path
```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant W as Workspace.tsx
  participant H as useWebSocket
  participant C as WebSocketService
  participant WH as websocket/index.ts
  participant E as SimulationEngine

  U->>W: Click "Stop"
  W->>H: stopSimulation()
  H->>C: controlSimulation('stop')
  C->>WH: emit simulation:control stop
  WH->>E: stop()
  E-->>WH: emit stopped
  WH-->>All: simulation:stopped
  WH->>WH: activeSimulations.delete(workspaceId)
  WH-->>C: callback success
  C-->>H: resolved
  H-->>W: done
  W->>W: setIsSimulationRunning(false)
```

## Data + Event Flow Notes
- Realtime state fan-out occurs through Socket.IO room `workspace-${workspaceId}`.
- Progress events are throttled server-side to ~1 update/sec (`event_processed` listener).
- Metrics events include both component-level and aggregated system-level payloads.
- Workspace join must happen before simulation control; client enforces this through `joinWorkspace` flow in `useWebSocket`.

## Failure Modes in Current Path
- If workspace has no components, UI blocks run and alerts user.
- If socket not connected or workspace not joined, client throws from `controlSimulation`.
- If server rejects action (`already running`, `not authorized`, invalid workspace), callback error propagates to UI alert.
