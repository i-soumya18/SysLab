import type { SimulationTimelineItem } from '../components/SimulationTimelinePanel';

export function mergeTimelineEvents(
  existing: SimulationTimelineItem[],
  incoming: SimulationTimelineItem,
  maxItems = 180
): SimulationTimelineItem[] {
  const merged = [incoming, ...existing];

  merged.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return b.id.localeCompare(a.id);
  });

  return merged.slice(0, maxItems);
}

