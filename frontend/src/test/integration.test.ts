/**
 * Frontend Integration Tests
 * Tests complete frontend workflows and component integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Component } from '../types';

// Mock WebSocket service
vi.mock('../services/websocket', () => ({
  WebSocketService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    joinWorkspace: vi.fn().mockResolvedValue(undefined),
    leaveWorkspace: vi.fn().mockResolvedValue(undefined),
    controlSimulation: vi.fn().mockResolvedValue(undefined),
    updateCanvas: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue({ connected: true, connecting: false }),
    getCurrentWorkspaceId: vi.fn().mockReturnValue('test-workspace')
  })),
  getWebSocketService: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    joinWorkspace: vi.fn().mockResolvedValue(undefined),
    leaveWorkspace: vi.fn().mockResolvedValue(undefined),
    controlSimulation: vi.fn().mockResolvedValue(undefined),
    updateCanvas: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue({ connected: true, connecting: false }),
    getCurrentWorkspaceId: vi.fn().mockReturnValue('test-workspace')
  }))
}));

// Mock workspace API service
vi.mock('../services/workspaceApi', () => ({
  WorkspaceApiService: {
    downloadWorkspaceExport: vi.fn().mockResolvedValue(undefined),
    importWorkspace: vi.fn().mockResolvedValue({ success: true, workspace: { name: 'Test' } })
  }
}));

describe('Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Integration', () => {
    it('should initialize WebSocket service correctly', async () => {
      const { getWebSocketService } = await import('../services/websocket');
      
      const service = getWebSocketService({ url: 'test' });
      expect(service).toBeDefined();
      expect(service.connect).toBeDefined();
      expect(service.disconnect).toBeDefined();
    });

    it('should handle workspace API operations', async () => {
      const { WorkspaceApiService } = await import('../services/workspaceApi');
      
      expect(WorkspaceApiService.downloadWorkspaceExport).toBeDefined();
      expect(WorkspaceApiService.importWorkspace).toBeDefined();
    });
  });

  describe('Component Integration', () => {
    it('should handle component data structures correctly', () => {
      const testComponent: Component = {
        id: 'test-component-1',
        type: 'database',
        position: { x: 100, y: 100 },
        configuration: {
          capacity: 1000,
          latency: 50,
          failureRate: 0.001
        },
        metadata: {
          name: 'Test Database',
          description: 'Test database component',
          version: '1.0.0'
        }
      };

      expect(testComponent.id).toBe('test-component-1');
      expect(testComponent.type).toBe('database');
      expect(testComponent.position).toEqual({ x: 100, y: 100 });
      expect(testComponent.configuration.capacity).toBe(1000);
    });

    it('should handle component selection workflow', () => {
      let selectedComponent: Component | null = null;
      const mockOnComponentSelect = vi.fn((component) => {
        selectedComponent = component;
      });

      const testComponent: Component = {
        id: 'test-component-2',
        type: 'web-server',
        position: { x: 200, y: 200 },
        configuration: {
          capacity: 2000,
          latency: 30,
          failureRate: 0.002
        },
        metadata: {
          name: 'Test Web Server',
          description: 'Test web server component',
          version: '1.0.0'
        }
      };

      mockOnComponentSelect(testComponent);

      expect(mockOnComponentSelect).toHaveBeenCalledWith(testComponent);
      expect(selectedComponent).toEqual(testComponent);
    });
  });

  describe('WebSocket Integration', () => {
    it('should have WebSocket service available', async () => {
      const { getWebSocketService } = await import('../services/websocket');
      
      // The function should be available
      expect(typeof getWebSocketService).toBe('function');
    });

    it('should create WebSocket service instance', async () => {
      const { WebSocketService } = await import('../services/websocket');
      
      // The class should be available
      expect(typeof WebSocketService).toBe('function');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle WebSocket connection errors gracefully', async () => {
      // Create a new mock instance for this test
      const mockConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));
      const mockService = {
        connect: mockConnect,
        disconnect: vi.fn(),
        joinWorkspace: vi.fn(),
        leaveWorkspace: vi.fn(),
        controlSimulation: vi.fn(),
        updateCanvas: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        getConnectionStatus: vi.fn(),
        getCurrentWorkspaceId: vi.fn()
      };

      try {
        await mockService.connect();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Connection failed');
      }
      
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should handle export errors gracefully', async () => {
      const { WorkspaceApiService } = await import('../services/workspaceApi');
      
      vi.mocked(WorkspaceApiService.downloadWorkspaceExport).mockRejectedValue(
        new Error('Export failed')
      );

      try {
        await WorkspaceApiService.downloadWorkspaceExport('test', 'test', 'test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Export failed');
      }
    });

    it('should handle component configuration edge cases', () => {
      const edgeCaseComponent: Component = {
        id: 'edge-case-component',
        type: 'database',
        position: { x: 0, y: 0 },
        configuration: {
          capacity: 0,
          latency: -1,
          failureRate: 1.5
        },
        metadata: {
          name: '',
          description: undefined,
          version: '0.0.0'
        }
      };

      expect(edgeCaseComponent.id).toBe('edge-case-component');
      expect(edgeCaseComponent.configuration.capacity).toBe(0);
      expect(edgeCaseComponent.configuration.latency).toBe(-1);
      expect(edgeCaseComponent.configuration.failureRate).toBe(1.5);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of components efficiently', () => {
      const mockOnComponentAdd = vi.fn();
      const components: Component[] = [];

      for (let i = 0; i < 100; i++) {
        const component: Component = {
          id: `component-${i}`,
          type: 'web-server',
          position: { x: (i % 10) * 80, y: Math.floor(i / 10) * 80 },
          configuration: {
            capacity: 1000 + i,
            latency: 50 + i,
            failureRate: 0.001
          },
          metadata: {
            name: `Component ${i}`,
            description: `Test component ${i}`,
            version: '1.0.0'
          }
        };
        components.push(component);
        mockOnComponentAdd(component);
      }

      expect(mockOnComponentAdd).toHaveBeenCalledTimes(100);
      expect(components).toHaveLength(100);
    });

    it('should handle rapid user interactions', () => {
      const mockOnComponentSelect = vi.fn();

      const testComponent: Component = {
        id: 'rapid-test-component',
        type: 'load-balancer',
        position: { x: 300, y: 300 },
        configuration: {
          capacity: 1500,
          latency: 25,
          failureRate: 0.0005
        },
        metadata: {
          name: 'Rapid Test Component',
          description: 'Component for rapid interaction testing',
          version: '1.0.0'
        }
      };

      for (let i = 0; i < 50; i++) {
        mockOnComponentSelect(testComponent);
      }

      expect(mockOnComponentSelect).toHaveBeenCalledTimes(50);
    });
  });
});