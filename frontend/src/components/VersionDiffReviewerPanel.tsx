import React, { useEffect, useMemo, useState } from 'react';
import { VersionApiService, type WorkspaceVersion, type PerformanceComparison } from '../services/versionApi';
import { aiInsightsApi, type VersionDiffReviewerResponse } from '../services/aiInsightsApi';

interface VersionDiffReviewerPanelProps {
  workspaceId: string;
}

export const VersionDiffReviewerPanel: React.FC<VersionDiffReviewerPanelProps> = ({ workspaceId }) => {
  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [baselineVersionId, setBaselineVersionId] = useState<string>('');
  const [comparisonVersionId, setComparisonVersionId] = useState<string>('');
  const [comparison, setComparison] = useState<PerformanceComparison | null>(null);
  const [review, setReview] = useState<VersionDiffReviewerResponse | null>(null);
  const [userIntent, setUserIntent] = useState('Choose the safer version under load with clear tradeoff visibility.');
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      try {
        setIsLoadingVersions(true);
        setError(null);

        const data = await VersionApiService.getWorkspaceVersions(workspaceId, {
          limit: 50,
          includeMetrics: true
        });

        setVersions(data.versions);
        if (data.versions.length >= 2) {
          setBaselineVersionId(data.versions[1].id);
          setComparisonVersionId(data.versions[0].id);
        } else if (data.versions.length === 1) {
          setBaselineVersionId(data.versions[0].id);
          setComparisonVersionId('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load versions');
      } finally {
        setIsLoadingVersions(false);
      }
    };

    if (workspaceId) {
      void loadVersions();
    }
  }, [workspaceId]);

  const selectedBaseline = useMemo(
    () => versions.find(v => v.id === baselineVersionId) || null,
    [versions, baselineVersionId]
  );

  const selectedComparison = useMemo(
    () => versions.find(v => v.id === comparisonVersionId) || null,
    [versions, comparisonVersionId]
  );

  const runReview = async () => {
    if (!selectedBaseline || !selectedComparison) {
      setError('Select baseline and comparison versions first.');
      return;
    }

    if (selectedBaseline.id === selectedComparison.id) {
      setError('Baseline and comparison versions must be different.');
      return;
    }

    try {
      setError(null);
      setIsAnalyzing(true);

      const perfComparison = await VersionApiService.compareVersions(selectedBaseline.id, selectedComparison.id);
      setComparison(perfComparison);

      const response = await aiInsightsApi.reviewVersionDiff({
        baselineVersion: {
          id: selectedBaseline.id,
          name: selectedBaseline.name,
          versionNumber: selectedBaseline.versionNumber,
          snapshot: selectedBaseline.snapshot,
          performanceMetrics: selectedBaseline.performanceMetrics
        },
        comparisonVersion: {
          id: selectedComparison.id,
          name: selectedComparison.name,
          versionNumber: selectedComparison.versionNumber,
          snapshot: selectedComparison.snapshot,
          performanceMetrics: selectedComparison.performanceMetrics
        },
        performanceComparison: perfComparison,
        userIntent: userIntent.trim() || undefined
      });

      setReview(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze version diff');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3 text-sm">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Version Diff Reviewer</h3>
        <p className="text-xs text-gray-600">AI interpretation of version changes, behavior implications, and adoption risk.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
      )}

      {isLoadingVersions ? (
        <div className="text-xs text-gray-500">Loading versions...</div>
      ) : versions.length < 2 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Create at least 2 versions to run AI version diff review.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Baseline version</label>
              <select
                value={baselineVersionId}
                onChange={(e) => setBaselineVersionId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select baseline</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} - {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Comparison version</label>
              <select
                value={comparisonVersionId}
                onChange={(e) => setComparisonVersionId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select comparison</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} - {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Decision intent</label>
              <input
                type="text"
                value={userIntent}
                onChange={(e) => setUserIntent(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runReview()}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-medium self-start"
          >
            {isAnalyzing ? 'Reviewing...' : 'Run AI Version Diff Review'}
          </button>
        </>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {comparison && (
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Comparison snapshot</h4>
            <p className="text-xs text-gray-700">Latency change: {comparison.overallImprovement.latencyChange.toFixed(2)}%</p>
            <p className="text-xs text-gray-700">Throughput change: {comparison.overallImprovement.throughputChange.toFixed(2)}%</p>
            <p className="text-xs text-gray-700">Error rate change: {comparison.overallImprovement.errorRateChange.toFixed(2)}%</p>
          </div>
        )}

        {review && (
          <>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <p className="text-sm text-gray-800">{review.summary}</p>
              <p className="text-xs text-gray-500 mt-1">
                Mode: {review.analysisMode} | Confidence: {(review.confidence * 100).toFixed(0)}%
              </p>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Key changes</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {review.keyChanges.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Behavior implications</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {review.behaviorImplications.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Risk flags</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {review.riskFlags.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">Verification checklist</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {review.verificationChecklist.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
              <h4 className="text-xs font-semibold uppercase text-indigo-700 mb-1">Recommendation</h4>
              <p className="text-xs font-medium text-indigo-800">{review.recommendation.suggestedDirection}</p>
              <p className="text-xs text-indigo-800 mt-1">{review.recommendation.rationale}</p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-800">
        AI recommendations should be validated with repeatable load and failure tests before promoting a version.
      </div>
    </div>
  );
};
