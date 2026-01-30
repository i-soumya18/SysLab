/**
 * Simulation engine types and interfaces
 */

export interface SimulationEvent {
  id: string;
  timestamp: number;
  type: SimulationEventType;
  componentId: string;
  data: any;
}

export type SimulationEventType = 
  | 'request_arrival'
  | 'request_completion'
  | 'component_failure'
  | 'component_recovery'
  | 'metrics_collection'
  | 'load_change'
  | 'failure_injection'
  | 'recovery_check'
  | 'random_failure_check';

export interface SimulationState {
  currentTime: number;
  isRunning: boolean;
  startTime: number;
  endTime: number;
  eventCount: number;
  components: Map<string, any>;
  metrics: Map<string, any[]>;
}

export interface EventScheduler {
  scheduleEvent(event: SimulationEvent): void;
  getNextEvent(): SimulationEvent | null;
  hasEvents(): boolean;
  clear(): void;
  getCurrentTime(): number;
}