/**
 * Loading State Management
 * Utilities for managing loading states and user feedback
 */

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface LoadingOperation {
  id: string;
  label: string;
  state: LoadingState;
  progress?: number;
  error?: string;
  startTime: number;
  endTime?: number;
}

/**
 * Loading state manager for tracking multiple operations
 */
export class LoadingStateManager {
  private operations = new Map<string, LoadingOperation>();
  private listeners: ((operations: LoadingOperation[]) => void)[] = [];

  startOperation(id: string, label: string): void {
    const operation: LoadingOperation = {
      id,
      label,
      state: LoadingState.LOADING,
      startTime: Date.now()
    };

    this.operations.set(id, operation);
    this.notifyListeners();
  }

  updateProgress(id: string, progress: number): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.progress = Math.max(0, Math.min(100, progress));
      this.notifyListeners();
    }
  }

  completeOperation(id: string): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.state = LoadingState.SUCCESS;
      operation.endTime = Date.now();
      this.notifyListeners();

      // Auto-remove successful operations after a delay
      setTimeout(() => {
        this.operations.delete(id);
        this.notifyListeners();
      }, 2000);
    }
  }

  failOperation(id: string, error: string): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.state = LoadingState.ERROR;
      operation.error = error;
      operation.endTime = Date.now();
      this.notifyListeners();
    }
  }

  cancelOperation(id: string): void {
    this.operations.delete(id);
    this.notifyListeners();
  }

  getOperation(id: string): LoadingOperation | undefined {
    return this.operations.get(id);
  }

  getAllOperations(): LoadingOperation[] {
    return Array.from(this.operations.values());
  }

  getActiveOperations(): LoadingOperation[] {
    return this.getAllOperations().filter(op => op.state === LoadingState.LOADING);
  }

  isLoading(): boolean {
    return this.getActiveOperations().length > 0;
  }

  subscribe(listener: (operations: LoadingOperation[]) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const operations = this.getAllOperations();
    this.listeners.forEach(listener => {
      try {
        listener(operations);
      } catch (error) {
        console.error('Error in loading state listener:', error);
      }
    });
  }

  clear(): void {
    this.operations.clear();
    this.notifyListeners();
  }
}

/**
 * Loading operation IDs for common operations
 */
export const LoadingOperations = {
  WORKSPACE_SAVE: 'workspace-save',
  WORKSPACE_LOAD: 'workspace-load',
  WORKSPACE_EXPORT: 'workspace-export',
  WORKSPACE_IMPORT: 'workspace-import',
  SIMULATION_START: 'simulation-start',
  SIMULATION_STOP: 'simulation-stop',
  WEBSOCKET_CONNECT: 'websocket-connect',
  CANVAS_RENDER: 'canvas-render',
  COMPONENT_ADD: 'component-add',
  COMPONENT_UPDATE: 'component-update',
  CONNECTION_CREATE: 'connection-create'
} as const;

/**
 * Loading operation labels
 */
export const LoadingLabels = {
  [LoadingOperations.WORKSPACE_SAVE]: 'Saving workspace...',
  [LoadingOperations.WORKSPACE_LOAD]: 'Loading workspace...',
  [LoadingOperations.WORKSPACE_EXPORT]: 'Exporting workspace...',
  [LoadingOperations.WORKSPACE_IMPORT]: 'Importing workspace...',
  [LoadingOperations.SIMULATION_START]: 'Starting simulation...',
  [LoadingOperations.SIMULATION_STOP]: 'Stopping simulation...',
  [LoadingOperations.WEBSOCKET_CONNECT]: 'Connecting to server...',
  [LoadingOperations.CANVAS_RENDER]: 'Rendering canvas...',
  [LoadingOperations.COMPONENT_ADD]: 'Adding component...',
  [LoadingOperations.COMPONENT_UPDATE]: 'Updating component...',
  [LoadingOperations.CONNECTION_CREATE]: 'Creating connection...'
} as const;

/**
 * Global loading state manager instance
 */
export const globalLoadingManager = new LoadingStateManager();

/**
 * Hook-like function for managing loading states
 */
export function useLoadingState(operationId: string) {
  const manager = globalLoadingManager;

  const start = (label?: string) => {
    const operationLabel = label || LoadingLabels[operationId as keyof typeof LoadingLabels] || 'Loading...';
    manager.startOperation(operationId, operationLabel);
  };

  const updateProgress = (progress: number) => {
    manager.updateProgress(operationId, progress);
  };

  const complete = () => {
    manager.completeOperation(operationId);
  };

  const fail = (error: string) => {
    manager.failOperation(operationId, error);
  };

  const cancel = () => {
    manager.cancelOperation(operationId);
  };

  const getState = () => {
    return manager.getOperation(operationId);
  };

  return {
    start,
    updateProgress,
    complete,
    fail,
    cancel,
    getState
  };
}

/**
 * Utility for wrapping async operations with loading states
 */
export async function withLoadingState<T>(
  operationId: string,
  operation: () => Promise<T>,
  label?: string
): Promise<T> {
  const loadingState = useLoadingState(operationId);
  
  try {
    loadingState.start(label);
    const result = await operation();
    loadingState.complete();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Operation failed';
    loadingState.fail(errorMessage);
    throw error;
  }
}

/**
 * Progress tracking utility for operations with known steps
 */
export class ProgressTracker {
  private currentStep = 0;
  private totalSteps: number;
  private operationId: string;
  private loadingState: ReturnType<typeof useLoadingState>;

  constructor(operationId: string, totalSteps: number, label?: string) {
    this.operationId = operationId;
    this.totalSteps = totalSteps;
    this.loadingState = useLoadingState(operationId);
    this.loadingState.start(label);
  }

  nextStep(stepLabel?: string): void {
    this.currentStep++;
    const progress = (this.currentStep / this.totalSteps) * 100;
    this.loadingState.updateProgress(progress);
    
    if (stepLabel) {
      // Update the operation label if needed
      globalLoadingManager.startOperation(this.operationId, stepLabel);
      this.loadingState.updateProgress(progress);
    }
  }

  complete(): void {
    this.currentStep = this.totalSteps;
    this.loadingState.updateProgress(100);
    this.loadingState.complete();
  }

  fail(error: string): void {
    this.loadingState.fail(error);
  }

  getProgress(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }
}