import React from 'react';

export type TimelineSeverity = 'info' | 'success' | 'warning' | 'critical';
export type TimelineCategory =
  | 'simulation'
  | 'load'
  | 'bottleneck'
  | 'failure'
  | 'recovery'
  | 'component'
  | 'system';

export interface SimulationTimelineItem {
  id: string;
  timestamp: number;
  category: TimelineCategory;
  severity: TimelineSeverity;
  title: string;
  details?: string;
  userCount?: number;
  scaleFactor?: number;
}

interface SimulationTimelinePanelProps {
  events: SimulationTimelineItem[];
  isSimulationRunning: boolean;
  onClear: () => void;
}

const severityStyle: Record<TimelineSeverity, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  critical: 'bg-rose-50 border-rose-200 text-rose-800'
};

const categoryLabel: Record<TimelineCategory, string> = {
  simulation: 'Simulation',
  load: 'Load',
  bottleneck: 'Bottleneck',
  failure: 'Failure',
  recovery: 'Recovery',
  component: 'Component',
  system: 'System'
};

export const SimulationTimelinePanel: React.FC<SimulationTimelinePanelProps> = ({
  events,
  isSimulationRunning,
  onClear
}) => {
  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isSimulationRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-600">
            {isSimulationRunning ? 'Live timeline' : 'Idle timeline'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          Clear
        </button>
      </div>

      {events.length === 0 ? (
        <div className="h-full grid place-items-center text-center text-sm text-gray-500 px-4">
          Timeline will show live scale ramp, bottlenecks, failures, and recovery events.
        </div>
      ) : (
        <div className="h-full overflow-y-auto space-y-2 pr-1">
          {events.map((event) => (
            <div key={event.id} className={`border rounded-md p-2 ${severityStyle[event.severity]}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide">
                  {categoryLabel[event.category]}
                </div>
                <div className="text-[10px] opacity-80">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>

              <div className="text-sm font-medium mt-0.5">{event.title}</div>
              {event.details && <div className="text-xs mt-1 opacity-90">{event.details}</div>}

              {(event.userCount || event.scaleFactor) && (
                <div className="text-[11px] mt-1 opacity-90">
                  {event.userCount ? `Users: ${event.userCount.toLocaleString()}` : ''}
                  {event.userCount && event.scaleFactor ? ' | ' : ''}
                  {event.scaleFactor ? `Scale: ${event.scaleFactor.toFixed(2)}x` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
