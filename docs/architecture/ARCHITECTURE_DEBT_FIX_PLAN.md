# Architecture Debt + Fix Plan (Prioritized)

## Prioritization Framework
- `P0`: security/data integrity risk or major product breakage.
- `P1`: high operational risk, high maintenance drag, or repeated UX defects.
- `P2`: quality/scalability improvements with lower immediate risk.

---

## P0 (Do First)

### 1) Unify Auth Trust Boundary (Firebase vs Backend JWT)
- Symptoms:
  - Frontend authenticates via Firebase.
  - Backend also has its own JWT/session system.
  - Some workspace endpoints accept `userId` from request body/query without backend token trust.
- Impact:
  - Auth drift, authorization bypass opportunities, inconsistent user identity model.
- Evidence:
  - `apps/frontend/src/hooks/useFirebaseAuth.tsx`
  - `apps/backend/src/routes/workspaces.ts` (comment notes temporary hybrid model; body/query userId accepted)
  - `apps/backend/src/middleware/auth.ts`, `apps/backend/src/routes/auth.ts`
- Fix plan:
  1. Make backend trust Firebase ID tokens as primary identity source (middleware verifies Firebase token).
  2. Remove `userId` from client-controlled query/body for protected resources.
  3. Derive `userId` only from verified token claims.
  4. Keep backend local auth only if intentionally required; otherwise deprecate.
- Acceptance criteria:
  - All protected endpoints reject missing/invalid bearer tokens.
  - No protected write endpoint accepts `userId` from request payload/query.
  - E2E tests cover unauthorized access attempts.

### 2) Harden WebSocket Authorization + Identity Assignment
- Symptoms:
  - WebSocket auth middleware allows connection even when auth invalid/missing.
  - On join, handler sets `socket.userId = userId` from client payload.
- Impact:
  - User impersonation and cross-user action risk in collaboration/simulation control.
- Evidence:
  - `apps/backend/src/websocket/index.ts` (`join-workspace` path)
- Fix plan:
  1. Require valid token for any mutating WS events (simulation control, canvas updates, collaboration ops).
  2. Never assign identity from event payload; use authenticated socket principal only.
  3. Validate workspace membership/permissions server-side before joining room.
  4. Add audit logging for WS mutating operations.
- Acceptance criteria:
  - Forged `userId` in client payload has no effect.
  - Unauthorized sockets cannot emit mutating events.
  - Security tests validate rejection paths.

### 3) Resolve API Contract Mismatches (Profile endpoints)
- Symptoms:
  - Frontend profile calls `/users/profile` and `/users/account`.
  - Backend exposes `/users/me` and `/users/me/preferences`.
- Impact:
  - Broken profile/account flows in production.
- Evidence:
  - `apps/frontend/src/pages/user/ProfilePage.tsx`
  - `apps/backend/src/routes/users.ts`
- Fix plan:
  1. Align frontend to backend contract (`/users/me`) or add compatibility routes.
  2. Add shared typed API client and contract tests.
- Acceptance criteria:
  - Profile read/update/delete flows pass end-to-end.
  - CI contract test fails on future mismatch.

---

## P1 (Next)

### 4) Refactor Monolithic Workspace Orchestrator
- Symptoms:
  - `Workspace.tsx` is a very large orchestration component handling layout, state, autosave, scenario loading, simulation, and panel logic.
- Impact:
  - High defect probability, difficult onboarding, testing friction.
- Evidence:
  - `apps/frontend/src/components/Workspace.tsx`
- Fix plan:
  1. Split into feature modules: `workspace-state`, `simulation-controls`, `panel-manager`, `scenario-loader`, `autosave`.
  2. Move side-effects into dedicated hooks with unit tests.
  3. Introduce state boundaries (context or store) for panel/simulation/workspace domains.
- Acceptance criteria:
  - Workspace file significantly reduced; feature hooks/components testable in isolation.
  - No regression in run/save/load flows.

### 5) Replace Frontend Hardcoded Admin Gate
- Symptoms:
  - Admin UI visibility uses hardcoded email check.
- Impact:
  - Fragile access control and environment-specific behavior.
- Evidence:
  - `apps/frontend/src/hooks/useAdmin.ts`
- Fix plan:
  1. Fetch admin claim/role from backend or Firebase custom claims.
  2. Use backend authz response as single source of truth.
- Acceptance criteria:
  - Admin access based on role claims, not static email list.

### 6) Rationalize Simulation Control Plane (REST vs WS)
- Symptoms:
  - Both REST `/simulation/*` and WS `simulation:control` exist.
- Impact:
  - Duplicate logic, inconsistent behavior, difficult observability.
- Evidence:
  - `apps/backend/src/routes/simulation.ts`
  - `apps/backend/src/websocket/index.ts`
- Fix plan:
  1. Define canonical control path (likely WS for interactive runs).
  2. Keep REST for async/batch use cases only; route both through shared service layer.
  3. Document API ownership and expected clients.
- Acceptance criteria:
  - Single domain service governs start/stop state transitions.
  - Behavior parity tests across supported entrypoints.

### 7) Standardize API Base URL Strategy
- Symptoms:
  - Mixed use of absolute `http://localhost:8080/api/v1` and relative `/api/v1` in frontend services.
- Impact:
  - Environment-specific CORS/network bugs.
- Evidence:
  - Multiple files under `apps/frontend/src/services/*` and pages.
- Fix plan:
  1. Centralize API/WS base URL resolver in one config module.
  2. Enforce via lint rule or code review checklist.
- Acceptance criteria:
  - No hardcoded localhost backend URL in source except env defaults.

---

## P2 (After Stabilization)

### 8) Normalize User/Ownership Data Modeling
- Symptoms:
  - `users.id` is UUID; some ownership fields in workspaces/collaboration are `VARCHAR` without FK.
- Impact:
  - Referential integrity and migration complexity.
- Evidence:
  - `apps/backend/src/config/database.ts`
- Fix plan:
  1. Decide canonical user identity format.
  2. Add migration path + FK constraints where feasible.
  3. Backfill and validate existing records.
- Acceptance criteria:
  - Consistent user identifier type across core tables.

### 9) Make Scenario/Progress Flow Fully Persistent
- Symptoms:
  - Scenario recommendation/progress paths still use partial/mock assumptions.
- Impact:
  - Learning path quality and data fidelity limits.
- Evidence:
  - `apps/backend/src/routes/scenarios.ts`, `apps/frontend/src/pages/ScenarioLibraryPage.tsx`
- Fix plan:
  1. Persist prerequisite completion IDs and recommendation inputs.
  2. Add dedicated endpoint returning completed scenario IDs.
- Acceptance criteria:
  - Scenario gating/recommendation driven by stored progress, not placeholders.

### 10) Complete Subscription Billing Integration
- Symptoms:
  - Subscription page has TODOs/alerts for upgrade/cancel workflows.
- Impact:
  - Product capability gap.
- Evidence:
  - `apps/frontend/src/pages/user/SubscriptionPage.tsx`
- Fix plan:
  1. Integrate Stripe (or chosen provider) through backend webhook-driven billing state.
  2. Replace mock usage with backend-backed usage metrics.
- Acceptance criteria:
  - Real checkout, cancellation, and billing status lifecycle verified in staging.

---

## Execution Roadmap
- Sprint 1: P0 items 1-3 (auth boundary, websocket authz, API contract alignment).
- Sprint 2: P1 items 4-7 (workspace refactor start, admin role source, simulation path rationalization, URL config unification).
- Sprint 3+: P2 items 8-10 (data model normalization, scenario persistence maturity, billing completion).

## Guardrails to Add Immediately
- Contract tests between frontend service layer and backend routes.
- Security tests for WS identity spoofing and cross-workspace mutation attempts.
- Architecture decision records (ADRs) for auth model and simulation control plane ownership.
