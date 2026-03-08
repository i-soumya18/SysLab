import { describe, it, expect } from 'vitest';
import type { SimulationTimelineItem } from '../components/SimulationTimelinePanel';
import { mergeTimelineEvents } from '../utils/simulationTimeline';

describe('Simulation Timeline Ordering Regression', () => {
  it('should keep deterministic newest-first ordering for scale, bottleneck, and recovery events', () => {
    let timeline: SimulationTimelineItem[] = [];

    const events: SimulationTimelineItem[] = [
      {
        id: 'recovery-1',
        timestamp: 3000,
        category: 'recovery',
        severity: 'success',
        title: 'Component recovered'
      },
      {
        id: 'bottleneck-1',
        timestamp: 2000,
        category: 'bottleneck',
        severity: 'warning',
        title: 'DB bottleneck'
      },
      {
        id: 'scale-1',
        timestamp: 1000,
        category: 'load',
        severity: 'info',
        title: 'Scale ramp update'
      }
    ];

    // Intentionally insert out of order to verify deterministic final ordering.
    timeline = mergeTimelineEvents(timeline, events[1]);
    timeline = mergeTimelineEvents(timeline, events[0]);
    timeline = mergeTimelineEvents(timeline, events[2]);

    expect(timeline.map((item) => item.category)).toEqual(['recovery', 'bottleneck', 'load']);
    expect(timeline[0].timestamp).toBe(3000);
    expect(timeline[1].timestamp).toBe(2000);
    expect(timeline[2].timestamp).toBe(1000);
  });

  it('should enforce max timeline size deterministically', () => {
    let timeline: SimulationTimelineItem[] = [];

    for (let i = 0; i < 10; i += 1) {
      timeline = mergeTimelineEvents(
        timeline,
        {
          id: `evt-${i}`,
          timestamp: i,
          category: 'load',
          severity: 'info',
          title: `event-${i}`
        },
        5
      );
    }

    expect(timeline).toHaveLength(5);
    expect(timeline[0].id).toBe('evt-9');
    expect(timeline[4].id).toBe('evt-5');
  });
});

