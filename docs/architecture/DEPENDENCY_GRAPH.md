# Module Dependency Graph (Frontend + Backend)

## Scope
This graph is module-level (not file-level) and reflects the current import/runtime structure in `apps/frontend/src` and `apps/backend/src`.

## Frontend Module Graph
```mermaid
graph TD
  F_Main[main.tsx] --> F_App[App Router + Route Guards]
  F_App --> F_Shell[AppShell / Nav / Layout]
  F_App --> F_Pages[Pages: dashboard/workspaces/scenarios/profile/settings/subscription/admin/marketing]
  F_App --> F_AuthGate[AuthGate]
  F_App --> F_AuthHook[useFirebaseAuth]

  F_Pages --> F_Workspace[Workspace Module]
  F_Pages --> F_Hooks[Hooks]
  F_Pages --> F_Services[Services API Layer]

  F_Workspace --> F_UI[Canvas + Panels + Dashboards + Editors]
  F_Workspace --> F_Hooks
  F_Workspace --> F_Services
  F_Workspace --> F_Types[types]
  F_Workspace --> F_Utils[utils]

  F_Hooks --> F_Services
  F_Hooks --> F_Types

  F_Services --> F_Backend[(Backend REST API)]
  F_Services --> F_WS[(Backend Socket.IO)]
  F_Services --> F_Firebase[(Firebase Auth)]

  F_Perf[performance/*] --> F_UI
  F_Perf --> F_Types
  F_Perf --> F_Utils

  F_UI --> F_Types
  F_UI --> F_Utils
```

## Frontend Module Responsibilities + Dependencies
- `App Router + Guards`: route composition, auth/public route guard logic.
  - Depends on: `hooks/useFirebaseAuth`, `components/AuthGate`, `pages/*`, `components/AppShell`.
- `Pages`: route screens and page-level orchestration.
  - Depends on: `services/*`, `hooks/*`, route navigation.
- `Workspace Module`: main product surface (canvas, simulation controls, dashboards, scenario loading, autosave).
  - Depends on: `components/*`, `hooks/useWebSocket`, `hooks/useCollaboration`, `services/workspaceApi|scenarioApi`, `types`, `utils`.
- `Hooks`: reusable stateful integrations (`useWebSocket`, `useCollaboration`, auth/admin hooks).
  - Depends on: `services/*`, `types`.
- `Services`: IO boundary for REST/WebSocket/Firebase.
  - Depends on: backend APIs, Socket.IO client, Firebase client.
- `Types/Utils`: shared primitives and helpers.
  - No business-layer dependencies.

---

## Backend Module Graph
```mermaid
graph TD
  B_Index[index.ts] --> B_Config[config: database + redis]
  B_Index --> B_Routes[routes/index.ts]
  B_Index --> B_WS[websocket/index.ts]
  B_Index --> B_MW[middleware/scalability + security stack]

  B_Routes --> B_RouteModules[Route Modules]
  B_RouteModules --> B_Services[Domain Services]
  B_RouteModules --> B_MW

  B_WS --> B_CollabSvc[CollaborationService]
  B_WS --> B_AuthSvc[AuthService]
  B_WS --> B_SimEngine[SimulationEngine]

  B_Services --> B_Config
  B_Services --> B_SimCore[simulation/* engines]
  B_Services --> B_Perf[performance/*]
  B_Services --> B_CompManagers[components/* managers]
  B_Services --> B_Types[types + validation]

  B_SimEngine --> B_SimCore
  B_SimEngine --> B_Perf

  B_Config --> B_DB[(PostgreSQL)]
  B_Config --> B_Redis[(Redis)]
```

## Backend Module Responsibilities + Dependencies
- `index.ts` (composition root): boot sequence, middleware wiring, route mounting, websocket setup.
  - Depends on: `config/*`, `routes/*`, `websocket/*`.
- `routes/*`: HTTP contracts and request validation.
  - Depends on: `services/*`, `middleware/*`, `types/validation`.
- `middleware/*`: auth, subscription, audit, metrics, scalability cross-cutting behavior.
  - Depends on: `services/authService`, monitoring and scaling services.
- `services/*`: business/domain logic layer.
  - Depends on: `config/database|redis`, `simulation/*`, `components/*`, `types`.
- `websocket/*`: realtime protocol handlers, room membership, simulation control broadcast.
  - Depends on: `SimulationEngine`, `AuthService`, `CollaborationService`.
- `simulation/*`: discrete event core, scheduling, failure/load/metrics engines.
  - Depends on: `types`, performance support modules.
- `components/*` (backend): capacity/scaling/consistency domain managers.
  - Depends on: `types`.

---

## Route-Module to Service Dependency Map
- `routes/workspaces` -> `WorkspaceService`, `SharingService`, `VersionHistoryService`.
- `routes/simulation` -> `simulationService`, `simulationWorkloadRoutes`.
- `routes/scenarios` -> `scenarioService`.
- `routes/progress` -> `progressService`, `scenarioService`, `guidanceService`.
- `routes/subscription` -> `SubscriptionService`, `subscriptionMiddleware`.
- `routes/admin` -> `AdminService`, `adminAuth`.
- `websocket/index` -> `SimulationEngine`, `AuthService`, `CollaborationService`.

## Notable Structural Characteristics
- Frontend has one very large orchestration module: `components/Workspace.tsx`.
- Backend has two control planes for simulation (`REST /simulation/*` and Socket.IO `simulation:control`).
- Auth is hybrid: Firebase client auth in frontend; backend also has first-party JWT/session auth routes.
