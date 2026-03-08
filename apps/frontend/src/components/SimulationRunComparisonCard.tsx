import React from 'react';

export interface SimulationRunSummary {
  id: string;
  completedAt: number;
  avgLatency: number;
  peakLatency: number;
  avgThroughput: number;
  avgErrorRate: number;
  peakErrorRate: number;
  bottleneckCount: number;
  maxUserCount: number;
  sustainableUserCount: number;
}

interface SimulationRunComparisonCardProps {
  baseline: SimulationRunSummary | null;
  latest: SimulationRunSummary | null;
}

const percentage = (value: number): string => `${value.toFixed(1)}%`;

const change = (before: number, after: number): number => {
  if (!Number.isFinite(before) || before === 0) {
    return 0;
  }
  return ((after - before) / before) * 100;
};

const metricState = (delta: number, goodWhenLower: boolean): 'improved' | 'worse' | 'neutral' => {
  if (Math.abs(delta) < 0.01) {
    return 'neutral';
  }

  if (goodWhenLower) {
    return delta < 0 ? 'improved' : 'worse';
  }

  return delta > 0 ? 'improved' : 'worse';
};

const stateClass: Record<'improved' | 'worse' | 'neutral', string> = {
  improved: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  worse: 'text-rose-700 bg-rose-50 border-rose-200',
  neutral: 'text-gray-700 bg-gray-50 border-gray-200'
};

const stateLabel: Record<'improved' | 'worse' | 'neutral', string> = {
  improved: 'Improved',
  worse: 'Regressed',
  neutral: 'No change'
};

export const SimulationRunComparisonCard: React.FC<SimulationRunComparisonCardProps> = ({
  baseline,
  latest
}) => {
  if (!latest) {
    return (
      <div className="p-3 text-sm text-gray-500">
        Run at least one simulation to generate an automated performance summary.
      </div>
    );
  }

  if (!baseline) {
    return (
      <div className="p-3 text-sm text-gray-600 space-y-2">
        <div className="font-semibold text-gray-800">Baseline Captured</div>
        <div>Complete one more run after applying a fix (cache/replica/queue) to compare outcomes.</div>
      </div>
    );
  }

  const latencyDelta = change(baseline.avgLatency, latest.avgLatency);
  const errorDelta = change(baseline.avgErrorRate, latest.avgErrorRate);
  const throughputDelta = change(baseline.avgThroughput, latest.avgThroughput);
  const scaleDelta = change(baseline.sustainableUserCount, latest.sustainableUserCount);

  const latencyState = metricState(latencyDelta, true);
  const errorState = metricState(errorDelta, true);
  const throughputState = metricState(throughputDelta, false);
  const scaleState = metricState(scaleDelta, false);

  const checks = [
    latencyDelta <= -15,
    errorDelta <= -20,
    throughputDelta >= 10,
    scaleDelta >= 25
  ];
  const passCount = checks.filter(Boolean).length;
  const overall = passCount >= 2 ? 'improved' : 'worse';

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${stateClass[overall]}`}>
        {stateLabel[overall]} ({passCount}/4 checks)
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-gray-200 p-2">
          <div className="text-gray-500">Baseline</div>
          <div className="font-semibold text-gray-800">
            {new Date(baseline.completedAt).toLocaleTimeString()}
          </div>
        </div>
        <div className="rounded border border-gray-200 p-2">
          <div className="text-gray-500">Latest</div>
          <div className="font-semibold text-gray-800">
            {new Date(latest.completedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className={`rounded border px-2 py-1 ${stateClass[latencyState]}`}>
          Latency: {baseline.avgLatency.toFixed(1)}ms {'->'} {latest.avgLatency.toFixed(1)}ms ({percentage(latencyDelta)})
        </div>
        <div className={`rounded border px-2 py-1 ${stateClass[errorState]}`}>
          Error rate: {(baseline.avgErrorRate * 100).toFixed(2)}% {'->'} {(latest.avgErrorRate * 100).toFixed(2)}% ({percentage(errorDelta)})
        </div>
        <div className={`rounded border px-2 py-1 ${stateClass[throughputState]}`}>
          Throughput: {baseline.avgThroughput.toFixed(1)} {'->'} {latest.avgThroughput.toFixed(1)} req/s ({percentage(throughputDelta)})
        </div>
        <div className={`rounded border px-2 py-1 ${stateClass[scaleState]}`}>
          Sustainable users: {baseline.sustainableUserCount.toLocaleString()} {'->'} {latest.sustainableUserCount.toLocaleString()} ({percentage(scaleDelta)})
        </div>
      </div>
    </div>
  );
};
