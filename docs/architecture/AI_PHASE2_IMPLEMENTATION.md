# Phase 2 Implementation: Socratic Tutor + Version Diff Reviewer

## What was implemented

### 1) Socratic Tutor
- Backend endpoint: `POST /api/v1/ai/socratic-tutor`
- Frontend docked panel: `Socratic Tutor`
- Input context includes workspace topology, metrics, bottlenecks, learner objective/question/actions.
- Output includes:
  - `coachSummary`
  - `socraticQuestions`
  - `conceptualHints`
  - `misconceptionChecks`
  - `nextStepExperiments`
  - `confidence`, `analysisMode`, `responsibleUse`

### 2) Version Diff Reviewer
- Backend endpoint: `POST /api/v1/ai/version-diff-reviewer`
- Frontend docked panel: `AI Version Diff Review`
- Frontend loads versions, runs existing `/versions/compare`, then asks AI to interpret meaning and risk.
- Output includes:
  - `keyChanges`
  - `behaviorImplications`
  - `riskFlags`
  - `verificationChecklist`
  - directional recommendation (`keep-baseline` / `adopt-comparison` / `hybrid-follow-up`)
  - `confidence`, `analysisMode`, `responsibleUse`

## LLM + fallback behavior
- If `OPENAI_API_KEY` is available and model call succeeds: `analysisMode = ai`.
- If unavailable/fails: deterministic fallback with explicit limitations and validation checklist (`analysisMode = heuristic-fallback`).

## Files added
- `apps/frontend/src/components/SocraticTutorPanel.tsx`
- `apps/frontend/src/components/VersionDiffReviewerPanel.tsx`
- `docs/architecture/AI_PHASE2_IMPLEMENTATION.md`

## Files updated
- `apps/backend/src/services/aiInsightService.ts`
- `apps/backend/src/routes/aiInsights.ts`
- `apps/frontend/src/services/aiInsightsApi.ts`
- `apps/frontend/src/components/Workspace.tsx`

## Responsible design choices
- AI prompts emphasize guidance and verification over authoritative answers.
- UI communicates confidence and limitations.
- No auto-application of recommendations.
- Version recommendation always paired with verification checklist.
