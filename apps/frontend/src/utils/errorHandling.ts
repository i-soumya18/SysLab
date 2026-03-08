/**
 * Error Handling Utilities
 * Comprehensive error handling and recovery mechanisms
 */

export const ErrorType = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  WEBSOCKET: 'WEBSOCKET',
  CANVAS: 'CANVAS',
  SIMULATION: 'SIMULATION',
  WORKSPACE: 'WORKSPACE',
  UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  timestamp: Date;
  context?: string;
  recoverable: boolean;
  retryable: boolean;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

/**
 * Error factory for creating standardized errors
 */
export class ErrorFactory {
  static createNetworkError(message: string, details?: any): AppError {
    return {
      id: this.generateId(),
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.HIGH,
      message,
      details,
      timestamp: new Date(),
      recoverable: true,
      retryable: true
    };
  }

  static createValidationError(message: string, context?: string): AppError {
    return {
      id: this.generateId(),
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      message,
      timestamp: new Date(),
      context,
      recoverable: true,
      retryable: false
    };
  }

  static createWebSocketError(message: string, details?: any): AppError {
    return {
      id: this.generateId(),
      type: ErrorType.WEBSOCKET,
      severity: ErrorSeverity.HIGH,
      message,
      details,
      timestamp: new Date(),
      recoverable: true,
      retryable: true
    };
  }

  static createCanvasError(message: string, context?: string): AppError {
    return {
      id: this.generateId(),
      type: ErrorType.CANVAS,
      severity: ErrorSeverity.MEDIUM,
      message,
      timestamp: new Date(),
      context,
      recoverable: true,
      retryable: false
    };
  }

  static createSimulationError(message: string, details?: any): AppError {
    return {
      id: this.generateId(),
      type: ErrorType.SIMULATION,
      severity: ErrorSeverity.HIGH,
      message,
      details,
      timestamp: new Date(),
      recoverable: true,
      retryable: true
    };
  }

  static createWorkspaceError(message: string, details?: any): AppError {
    return {
      id: this.generateId(),
      type: ErrorType.WORKSPACE,
      severity: ErrorSeverity.HIGH,
      message,
      details,
      timestamp: new Date(),
      recoverable: true,
      retryable: true
    };
  }

  private static generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Error boundary for React components
 */
export class ErrorBoundaryState {
  hasError: boolean = false;
  error: Error | null = null;
  errorInfo: any = null;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.error = error;
    this.errorInfo = errorInfo;
    
    // Log error to monitoring service
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Report to error tracking service
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: any) {
    // In a real application, you would send this to an error tracking service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Error Report:', errorReport);
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryManager {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_BASE_DELAY = 1000;

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.DEFAULT_MAX_RETRIES,
    baseDelay: number = this.DEFAULT_BASE_DELAY
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;

  constructor(failureThreshold: number = 5, recoveryTimeout: number = 60000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Global error handler
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errors: AppError[] = [];
  private maxErrors = 100;
  private listeners: ((error: AppError) => void)[] = [];

  static getInstance(): GlobalErrorHandler {
    if (!this.instance) {
      this.instance = new GlobalErrorHandler();
    }
    return this.instance;
  }

  private constructor() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = ErrorFactory.createNetworkError(
        'Unhandled promise rejection',
        { reason: event.reason }
      );
      this.handleError(error);
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      const error = ErrorFactory.createNetworkError(
        event.message,
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
      this.handleError(error);
    });
  }

  handleError(error: AppError): void {
    this.errors.push(error);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });

    // Log error
    console.error('Application Error:', error);
  }

  subscribe(listener: (error: AppError) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  getErrorsByType(type: ErrorType): AppError[] {
    return this.errors.filter(error => error.type === type);
  }

  clearErrors(): void {
    this.errors = [];
  }

  getErrorStats() {
    const stats = {
      total: this.errors.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recent: this.errors.filter(e => Date.now() - e.timestamp.getTime() < 300000).length // Last 5 minutes
    };

    this.errors.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  static validateComponent(component: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!component.id || typeof component.id !== 'string' || component.id.trim().length === 0) {
      errors.push('Component ID is required and must be a non-empty string');
    }

    if (!component.type || typeof component.type !== 'string') {
      errors.push('Component type is required and must be a string');
    }

    if (!component.position || typeof component.position.x !== 'number' || typeof component.position.y !== 'number') {
      errors.push('Component position must have numeric x and y coordinates');
    }

    if (component.position && (component.position.x < 0 || component.position.y < 0)) {
      errors.push('Component position coordinates must be non-negative');
    }

    if (!component.configuration || typeof component.configuration !== 'object') {
      errors.push('Component configuration is required and must be an object');
    }

    if (component.configuration) {
      if (typeof component.configuration.capacity !== 'number' || component.configuration.capacity <= 0) {
        errors.push('Component capacity must be a positive number');
      }

      if (typeof component.configuration.latency !== 'number' || component.configuration.latency < 0) {
        errors.push('Component latency must be a non-negative number');
      }

      if (typeof component.configuration.failureRate !== 'number' || 
          component.configuration.failureRate < 0 || 
          component.configuration.failureRate > 1) {
        errors.push('Component failure rate must be a number between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateConnection(connection: any, components: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!connection.id || typeof connection.id !== 'string' || connection.id.trim().length === 0) {
      errors.push('Connection ID is required and must be a non-empty string');
    }

    if (!connection.sourceComponentId || typeof connection.sourceComponentId !== 'string') {
      errors.push('Source component ID is required and must be a string');
    }

    if (!connection.targetComponentId || typeof connection.targetComponentId !== 'string') {
      errors.push('Target component ID is required and must be a string');
    }

    if (connection.sourceComponentId === connection.targetComponentId) {
      errors.push('Source and target components cannot be the same');
    }

    // Check if components exist
    const sourceExists = components.some(c => c.id === connection.sourceComponentId);
    const targetExists = components.some(c => c.id === connection.targetComponentId);

    if (!sourceExists) {
      errors.push('Source component does not exist');
    }

    if (!targetExists) {
      errors.push('Target component does not exist');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}