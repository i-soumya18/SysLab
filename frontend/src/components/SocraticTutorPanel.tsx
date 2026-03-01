import React, { useMemo, useState } from 'react';
import type { BottleneckInfo, SystemMetrics, Workspace } from '../types';
import { aiInsightsApi, type SocraticTutorResponse } from '../services/aiInsightsApi';

interface SocraticTutorPanelProps {
  workspace: Workspace;
  systemMetrics?: SystemMetrics;
  bottlenecks: BottleneckInfo[];
  isSimulationRunning: boolean;
}

export const SocraticTutorPanel: React.FC<SocraticTutorPanelProps> = ({
  workspace,
  systemMetrics,
  bottlenecks,
  isSimulationRunning
}) => {
  const [learningObjective, setLearningObjective] = useState('Identify and fix the highest-impact bottleneck with evidence.');
  const [learnerQuestion, setLearnerQuestion] = useState('');
  const [learnerActionSummary, setLearnerActionSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SocraticTutorResponse | null>(null);

  const contextText = useMemo(() => {
    return `Components: ${workspace.components.length}, Connections: ${workspace.connections.length}, Bottlenecks: ${bottlenecks.length}`;
  }, [workspace.components.length, workspace.connections.length, bottlenecks.length]);

  const runTutor = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await aiInsightsApi.generateSocraticTutor({
        workspace,
        systemMetrics,
        bottlenecks,
        learningObjective: learningObjective.trim() || undefined,
        learnerQuestion: learnerQuestion.trim() || undefined,
        learnerActionSummary: learnerActionSummary.trim() || undefined
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Socratic guidance');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3 text-sm">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Socratic Tutor</h3>
        <p className="text-xs text-gray-600">Guided questioning to build reasoning, not just answers.</p>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
        {contextText}
        {!isSimulationRunning && (
          <div className="mt-1 text-amber-700">Simulation is not running. Tutor can still help, but runtime context will be weaker.</div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Learning objective</label>
        <input
          type="text"
          value={learningObjective}
          onChange={(e) => setLearningObjective(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Your question</label>
        <textarea
          value={learnerQuestion}
          onChange={(e) => setLearnerQuestion(e.target.value)}
          rows={3}
          placeholder="Example: Why did latency rise even after I increased capacity?"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">What you already tried</label>
        <textarea
          value={learnerActionSummary}
          onChange={(e) => setLearnerActionSummary(e.target.value)}
          rows={2}
          placeholder="Example: Increased DB capacity 2x, error rate improved but p95 still high"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <button
        type="button"
        onClick={() => void runTutor()}
        disabled={isLoading}
        className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-medium self-start"
      >
        {isLoading ? 'Guiding...' : 'Generate Socratic Guidance'}
      </button>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {result && (
          <>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <p className="text-sm text-gray-800">{result.coachSummary}</p>
              <p className="text-xs text-gray-500 mt-1">
                Mode: {result.analysisMode} | Confidence: {(result.confidence * 100).toFixed(0)}%
              </p>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Socratic questions</h4>
              <ol className="list-decimal pl-5 text-xs text-gray-700 space-y-1">
                {result.socraticQuestions.map((q, idx) => <li key={idx}>{q}</li>)}
              </ol>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Conceptual hints</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {result.conceptualHints.map((h, idx) => <li key={idx}>{h}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Misconception checks</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {result.misconceptionChecks.map((m, idx) => <li key={idx}>{m}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Next-step experiments</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {result.nextStepExperiments.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-800">
        This tutor is designed to improve reasoning via guided questions. Validate each hypothesis with controlled simulation runs.
      </div>
    </div>
  );
};
