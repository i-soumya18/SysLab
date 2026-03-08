/**
 * Priority queue-based event scheduler for discrete-event simulation
 */

import { SimulationEvent, EventScheduler } from './types';

export class PriorityQueueEventScheduler implements EventScheduler {
  private events: SimulationEvent[] = [];
  private currentTime: number = 0;

  /**
   * Schedule an event to be processed at its timestamp
   */
  scheduleEvent(event: SimulationEvent): void {
    // Insert event in chronological order (priority queue)
    let insertIndex = 0;
    while (insertIndex < this.events.length && this.events[insertIndex].timestamp <= event.timestamp) {
      insertIndex++;
    }
    this.events.splice(insertIndex, 0, event);
  }

  /**
   * Get the next event to process (earliest timestamp)
   */
  getNextEvent(): SimulationEvent | null {
    const event = this.events.shift();
    if (event) {
      this.currentTime = event.timestamp;
    }
    return event || null;
  }

  /**
   * Check if there are pending events
   */
  hasEvents(): boolean {
    return this.events.length > 0;
  }

  /**
   * Clear all scheduled events
   */
  clear(): void {
    this.events = [];
    this.currentTime = 0;
  }

  /**
   * Get current simulation time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Get number of pending events (for debugging)
   */
  getPendingEventCount(): number {
    return this.events.length;
  }

  /**
   * Peek at next event without removing it
   */
  peekNextEvent(): SimulationEvent | null {
    return this.events[0] || null;
  }
}