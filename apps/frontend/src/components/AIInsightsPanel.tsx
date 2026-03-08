import React, { useMemo, useState } from 'react';
import type { BottleneckInfo, ComponentMetrics, SystemMetrics, Workspace } from '../types';
import {
  aiInsightsApi,
  type ArchitectureCriticResponse,
  type BottleneckRootCauseResponse
} from '../services/aiInsightsApi';

interface AIInsightsPanelProps {
  workspace: Workspace;
  systemMetrics?: SystemMetrics;
  componentMetrics: Map<string, ComponentMetrics>;
  bottlenecks: BottleneckInfo[];
  isSimulationRunning: boolean;
}

type Tab = 'critic' | 'root-cause';

const severityColor: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
};

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  workspace,
  systemMetrics,
  componentMetrics,
  bottlenecks,
  isSimulationRunning
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('critic');
  const [isLoadingCritic, setIsLoadingCritic] = useState(false);
  const [isLoadingRootCause, setIsLoadingRootCause] = useState(false);
  const [criticResult, setCriticResult] = useState<ArchitectureCriticResponse | null>(null);
  const [rootCauseResult, setRootCauseResult] = useState<BottleneckRootCauseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextSummary = useMemo(() => {
    return {
      components: workspace.components.length,
      connections: workspace.connections.length,
      bottlenecks: bottlenecks.length,
      avgLatency: systemMetrics?.averageLatency,
      throughput: systemMetrics?.totalThroughput,
      errorRate: systemMetrics?.systemErrorRate
    };
  }, [workspace.components.length, workspace.connections.length, bottlenecks.length, systemMetrics]);

  const runArchitectureCritic = async () => {
    try {
      setError(null);
      setIsLoadingCritic(true);
      const result = await aiInsightsApi.critiqueArchitecture({
        workspace,
        systemMetrics,
        bottlenecks,
        userGoal: 'Improve reliability and performance while keeping design understandable for learners.'
      });
      setCriticResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run architecture critic');
    } finally {
      setIsLoadingCritic(false);
    }
  };

  const runRootCauseAnalysis = async () => {
    try {
      setError(null);
      setIsLoadingRootCause(true);
      const result = await aiInsightsApi.analyzeBottleneckRootCause({
        workspace,
        systemMetrics,
        componentMetrics,
        bottlenecks,
        recentEvents: []
      });
      setRootCauseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run root-cause analysis');
    } finally {
      setIsLoadingRootCause(false);
    }
  };

  const runBoth = async () => {
    await Promise.all([runArchitectureCritic(), runRootCauseAnalysis()]);
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI Insights</h3>
          <p className="text-xs text-gray-600">
            Context-aware architecture critique and root-cause hypotheses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runBoth()}
          disabled={isLoadingCritic || isLoadingRootCause}
          className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-medium"
        >
          {isLoadingCritic || isLoadingRootCause ? 'Analyzing...' : 'Run Full AI Analysis'}
        </button>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
        Components: {contextSummary.components} | Connections: {contextSummary.connections} | Bottlenecks: {contextSummary.bottlenecks}
        {typeof contextSummary.avgLatency === 'number' && ` | Avg Latency: ${contextSummary.avgLatency.toFixed(1)}ms`}
        {typeof contextSummary.throughput === 'number' && ` | Throughput: ${contextSummary.throughput.toFixed(1)}`}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('critic')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${
            activeTab === 'critic' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Architecture Critic
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('root-cause')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${
            activeTab === 'root-cause' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Bottleneck Root Cause
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === 'critic' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void runArchitectureCritic()}
              disabled={isLoadingCritic}
              className="px-3 py-1.5 rounded-md bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-100 text-indigo-800 text-xs font-medium"
            >
              {isLoadingCritic ? 'Running...' : 'Run Architecture Critic'}
            </button>

            {criticResult && (
              <>
                <div className="rounded-md border border-gray-200 p-3 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">Mode: {criticResult.analysisMode}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${severityColor[criticResult.overallRisk === 'high' ? 'critical' : criticResult.overallRisk === 'medium' ? 'medium' : 'low']}`}>
                      Risk: {criticResult.overallRisk}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{criticResult.summary}</p>
                  <p className="text-xs text-gray-500 mt-1">Confidence: {(criticResult.confidence * 100).toFixed(0)}%</p>
                </div>

                {criticResult.findings.map((finding) => (
                  <div key={finding.id} className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">{finding.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${severityColor[finding.severity]}`}>
                        {finding.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{finding.whyItMatters}</p>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-600 uppercase">Evidence</p>
                      <ul className="list-disc pl-5 text-xs text-gray-700">
                        {finding.evidence.map((item, idx) => <li key={idx}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-600 uppercase">Recommended Actions</p>
                      <ul className="list-disc pl-5 text-xs text-gray-700">
                        {finding.recommendations.map((item, idx) => <li key={idx}>{item}</li>)}
                      </ul>
                    </div>
                    <p className="text-xs text-gray-600"><span className="font-semibold">Expected impact:</span> {finding.expectedImpact}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'root-cause' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void runRootCauseAnalysis()}
              disabled={isLoadingRootCause || !isSimulationRunning}
              className="px-3 py-1.5 rounded-md bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-100 disabled:text-gray-400 text-indigo-800 text-xs font-medium"
            >
              {isLoadingRootCause ? 'Running...' : 'Run Root-Cause Analysis'}
            </button>

            {!isSimulationRunning && (
              <p className="text-xs text-gray-500">Start simulation for stronger root-cause analysis context.</p>
            )}

            {rootCauseResult && (
              <>
                <div className="rounded-md border border-gray-200 p-3 bg-white">
                  <p className="text-sm text-gray-800">{rootCauseResult.summary}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Mode: {rootCauseResult.analysisMode} | Confidence: {(rootCauseResult.confidence * 100).toFixed(0)}%
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-gray-600">Primary hypotheses</h4>
                  {rootCauseResult.primaryCauses.map((cause, idx) => (
                    <div key={idx} className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                      <p className="text-sm font-semibold text-gray-900">{cause.cause}</p>
                      <p className="text-xs text-gray-500">Confidence: {(cause.confidence * 100).toFixed(0)}%</p>
                      <ul className="list-disc pl-5 text-xs text-gray-700">
                        {cause.evidence.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                      <p className="text-xs text-gray-600"><span className="font-semibold">Expected metric shift:</span> {cause.expectedMetricShift}</p>
                      <ul className="list-disc pl-5 text-xs text-gray-700">
                        {cause.recommendedFixes.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>

                {rootCauseResult.nextExperiments.length > 0 && (
                  <div className="rounded-md border border-gray-200 bg-white p-3">
                    <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Next experiments</h4>
                    <ul className="list-disc pl-5 text-xs text-gray-700">
                      {rootCauseResult.nextExperiments.map((experiment, idx) => <li key={idx}>{experiment}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-800">
        AI provides hypotheses, not guarantees. Validate changes with controlled simulation runs before adopting design decisions.
      </div>
    </div>
  );
};
