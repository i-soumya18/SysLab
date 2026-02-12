/**
 * Collaboration Service Tests
 * Tests real-time synchronization and operational transformation per SRS FR-10.3
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { CollaborationService, CollaborativeOperation } from '../services/collaborationService';
import { Component, Connection } from '../types';

describe('Collaboration Service - Real-time Synchronization', () => {
  let collaborationService: CollaborationService;
  const mockWorkspaceId = 'test-workspace-123';
  const mockUser1 = 'user-1';
  const mockUser2 = 'user-2';
  const mockSocketId1 = 'socket-1';
  const mockSocketId2 = 'socket-2';

  beforeEach(() => {
    // Initialize service without database for unit tests
    collaborationService = new CollaborationService(false);
  });

  afterEach(() => {
    // Clean up any event listeners
    collaborationService.removeAllListeners();
  });

  describe('Session Management', () => {
    test('should create collaboration session for workspace', async () => {
      const session = await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      
      expect(session).toBeDefined();
      expect(session.workspaceId).toBe(mockWorkspaceId);
      expect(session.participants).toHaveLength(1);
      expect(session.participants[0].userId).toBe(mockUser1);
      expect(session.participants[0].socketId).toBe(mockSocketId1);
      expect(session.participants[0].color).toBeDefined();
    });

    test('should add multiple participants to session', async () => {
      // Start session with first user
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      
      // Add second user
      const session = await collaborationService.startSession(mockWorkspaceId, mockUser2, mockSocketId2);
      
      expect(session.participants).toHaveLength(2);
      expect(session.participants.map(p => p.userId)).toContain(mockUser1);
      expect(session.participants.map(p => p.userId)).toContain(mockUser2);
    });

    test('should assign different colors to participants', async () => {
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      const session = await collaborationService.startSession(mockWorkspaceId, mockUser2, mockSocketId2);
      
      const colors = session.participants.map(p => p.color);
      expect(new Set(colors).size).toBe(2); // All colors should be unique
    });

    test('should end session when user leaves', async () => {
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      await collaborationService.startSession(mockWorkspaceId, mockUser2, mockSocketId2);
      
      await collaborationService.endSession(mockWorkspaceId, mockUser1);
      
      const session = collaborationService.getSession(mockWorkspaceId);
      expect(session?.participants).toHaveLength(1);
      expect(session?.participants[0].userId).toBe(mockUser2);
    });
  });

  describe('Operational Transformation', () => {
    beforeEach(async () => {
      // Set up session with two users
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      await collaborationService.startSession(mockWorkspaceId, mockUser2, mockSocketId2);
    });

    test('should apply operation without transformation when no conflicts', async () => {
      const mockComponent: Component = {
        id: 'comp-1',
        type: 'database',
        position: { x: 100, y: 100 },
        configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
        metadata: { name: 'Test DB', description: 'Test database', version: '1.0' }
      };

      const operation = await collaborationService.applyOperation(mockWorkspaceId, {
        sessionId: '',
        userId: mockUser1,
        type: 'component-add',
        data: mockComponent
      });

      expect(operation).toBeDefined();
      expect(operation.applied).toBe(true);
      expect(operation.userId).toBe(mockUser1);
      expect(operation.type).toBe('component-add');
      expect(operation.data).toEqual(mockComponent);
      expect(operation.transformedFrom).toBeUndefined();
    });

    test('should transform component add operations with same position', async () => {
      const mockComponent1: Component = {
        id: 'comp-1',
        type: 'database',
        position: { x: 100, y: 100 },
        configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
        metadata: { name: 'Test DB 1', description: 'Test database 1', version: '1.0' }
      };

      const mockComponent2: Component = {
        id: 'comp-2',
        type: 'cache',
        position: { x: 100, y: 100 }, // Same position
        configuration: { capacity: 500, latency: 5, failureRate: 0.005 },
        metadata: { name: 'Test Cache', description: 'Test cache', version: '1.0' }
      };

      // Simulate concurrent operations by adding first operation without marking as applied
      const session = collaborationService.getSession(mockWorkspaceId)!;
      const concurrentOp: CollaborativeOperation = {
        id: uuidv4(),
        sessionId: session.id,
        userId: mockUser1,
        type: 'component-add',
        data: mockComponent1,
        timestamp: new Date(),
        applied: false
      };
      session.operations.push(concurrentOp);

      // Apply second operation (should be transformed)
      const transformedOp = await collaborationService.applyOperation(mockWorkspaceId, {
        sessionId: '',
        userId: mockUser2,
        type: 'component-add',
        data: mockComponent2
      });

      expect(transformedOp.transformedFrom).toBeDefined();
      expect(transformedOp.data.position.x).toBe(150); // Offset by 50
      expect(transformedOp.data.position.y).toBe(150); // Offset by 50
    });

    test('should transform component update operations on same component', async () => {
      const componentId = 'comp-1';
      
      // Simulate concurrent updates to same component
      const update1 = {
        id: componentId,
        configuration: { capacity: 2000, latency: 15 }
      };

      const update2 = {
        id: componentId,
        configuration: { capacity: 1500, failureRate: 0.02 }
      };

      // Add first operation as concurrent (not applied)
      const session = collaborationService.getSession(mockWorkspaceId)!;
      const concurrentOp: CollaborativeOperation = {
        id: uuidv4(),
        sessionId: session.id,
        userId: mockUser1,
        type: 'component-update',
        data: update1,
        timestamp: new Date(),
        applied: false
      };
      session.operations.push(concurrentOp);

      // Apply second update (should be merged)
      const transformedOp = await collaborationService.applyOperation(mockWorkspaceId, {
        sessionId: '',
        userId: mockUser2,
        type: 'component-update',
        data: update2
      });

      expect(transformedOp.transformedFrom).toBeDefined();
      expect(transformedOp.data.configuration.capacity).toBe(1500); // User2's value wins
      expect(transformedOp.data.configuration.latency).toBe(15); // User1's value preserved
      expect(transformedOp.data.configuration.failureRate).toBe(0.02); // User2's value
    });

    test('should handle delete vs update conflict', async () => {
      const componentId = 'comp-1';

      // Add delete operation as concurrent (not applied)
      const session = collaborationService.getSession(mockWorkspaceId)!;
      const concurrentOp: CollaborativeOperation = {
        id: uuidv4(),
        sessionId: session.id,
        userId: mockUser1,
        type: 'component-delete',
        data: { componentId },
        timestamp: new Date(),
        applied: false
      };
      session.operations.push(concurrentOp);

      // User2 tries to update same component (should be transformed to no-op)
      const transformedOp = await collaborationService.applyOperation(mockWorkspaceId, {
        sessionId: '',
        userId: mockUser2,
        type: 'component-update',
        data: { id: componentId, configuration: { capacity: 2000 } }
      });

      expect(transformedOp.transformedFrom).toBeDefined();
      expect(transformedOp.type).toBe('component-delete'); // Converted to no-op
      expect(transformedOp.data.reason).toBe('component_already_deleted');
    });

    test('should handle connection creation with deleted component', async () => {
      const sourceComponentId = 'comp-1';
      const targetComponentId = 'comp-2';

      // Add delete operation as concurrent (not applied)
      const session = collaborationService.getSession(mockWorkspaceId)!;
      const concurrentOp: CollaborativeOperation = {
        id: uuidv4(),
        sessionId: session.id,
        userId: mockUser1,
        type: 'component-delete',
        data: { componentId: sourceComponentId },
        timestamp: new Date(),
        applied: false
      };
      session.operations.push(concurrentOp);

      // User2 tries to create connection involving deleted component
      const mockConnection: Connection = {
        id: 'conn-1',
        sourceComponentId,
        targetComponentId,
        sourcePort: 'out',
        targetPort: 'in',
        configuration: { bandwidth: 1000, latency: 5, protocol: 'HTTP', reliability: 0.99 }
      };

      const transformedOp = await collaborationService.applyOperation(mockWorkspaceId, {
        sessionId: '',
        userId: mockUser2,
        type: 'connection-create',
        data: mockConnection
      });

      expect(transformedOp.transformedFrom).toBeDefined();
      expect(transformedOp.type).toBe('connection-delete'); // Converted to no-op
      expect(transformedOp.data.reason).toBe('component_deleted');
      expect(transformedOp.data.deletedComponentId).toBe(sourceComponentId);
    });
  });

  describe('Cursor and Selection Tracking', () => {
    beforeEach(async () => {
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      await collaborationService.startSession(mockWorkspaceId, mockUser2, mockSocketId2);
    });

    test('should update cursor position', async () => {
      const position = { x: 200, y: 300 };
      
      await collaborationService.updateCursor(mockWorkspaceId, mockUser1, position);
      
      const session = collaborationService.getSession(mockWorkspaceId);
      const participant = session?.participants.find(p => p.userId === mockUser1);
      
      expect(participant?.cursor).toEqual(position);
    });

    test('should update selection', async () => {
      const selectedIds = ['comp-1', 'comp-2', 'conn-1'];
      
      await collaborationService.updateSelection(mockWorkspaceId, mockUser1, selectedIds);
      
      const session = collaborationService.getSession(mockWorkspaceId);
      const participant = session?.participants.find(p => p.userId === mockUser1);
      
      expect(participant?.selection).toEqual(selectedIds);
    });

    test('should emit cursor update events', async () => {
      const position = { x: 150, y: 250 };
      let eventEmitted = false;
      
      collaborationService.on('cursor:updated', (data) => {
        expect(data.userId).toBe(mockUser1);
        expect(data.position).toEqual(position);
        eventEmitted = true;
      });
      
      await collaborationService.updateCursor(mockWorkspaceId, mockUser1, position);
      
      expect(eventEmitted).toBe(true);
    });

    test('should emit selection update events', async () => {
      const selectedIds = ['comp-1'];
      let eventEmitted = false;
      
      collaborationService.on('selection:updated', (data) => {
        expect(data.userId).toBe(mockUser1);
        expect(data.selectedIds).toEqual(selectedIds);
        eventEmitted = true;
      });
      
      await collaborationService.updateSelection(mockWorkspaceId, mockUser1, selectedIds);
      
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Presence Information', () => {
    beforeEach(async () => {
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      await collaborationService.startSession(mockWorkspaceId, mockUser2, mockSocketId2);
    });

    test('should return presence info for all participants', () => {
      const presenceInfo = collaborationService.getPresenceInfo(mockWorkspaceId);
      
      expect(presenceInfo).toHaveLength(2);
      expect(presenceInfo.map(p => p.userId)).toContain(mockUser1);
      expect(presenceInfo.map(p => p.userId)).toContain(mockUser2);
      
      presenceInfo.forEach(participant => {
        expect(participant.socketId).toBeDefined();
        expect(participant.color).toBeDefined();
        expect(participant.isActive).toBe(true);
        expect(participant.cursor).toEqual({ x: 0, y: 0 });
        expect(participant.selection).toEqual([]);
      });
    });

    test('should return empty array for non-existent workspace', () => {
      const presenceInfo = collaborationService.getPresenceInfo('non-existent-workspace');
      expect(presenceInfo).toEqual([]);
    });
  });

  describe('Event Emission', () => {
    test('should emit session started event', async () => {
      let eventEmitted = false;
      
      collaborationService.on('session:started', (data) => {
        expect(data.workspaceId).toBe(mockWorkspaceId);
        expect(data.participant.userId).toBe(mockUser1);
        eventEmitted = true;
      });
      
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      
      expect(eventEmitted).toBe(true);
    });

    test('should emit operation applied event', async () => {
      await collaborationService.startSession(mockWorkspaceId, mockUser1, mockSocketId1);
      
      let eventEmitted = false;
      
      collaborationService.on('operation:applied', (data) => {
        expect(data.workspaceId).toBe(mockWorkspaceId);
        expect(data.operation.userId).toBe(mockUser1);
        expect(data.operation.type).toBe('component-add');
        eventEmitted = true;
      });
      
      const mockComponent: Component = {
        id: 'comp-1',
        type: 'database',
        position: { x: 100, y: 100 },
        configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
        metadata: { name: 'Test DB', description: 'Test database', version: '1.0' }
      };

      await collaborationService.applyOperation(mockWorkspaceId, {
        sessionId: '',
        userId: mockUser1,
        type: 'component-add',
        data: mockComponent
      });
      
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for non-existent session', async () => {
      const mockComponent: Component = {
        id: 'comp-1',
        type: 'database',
        position: { x: 100, y: 100 },
        configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
        metadata: { name: 'Test DB', description: 'Test database', version: '1.0' }
      };

      await expect(
        collaborationService.applyOperation('non-existent-workspace', {
          sessionId: '',
          userId: mockUser1,
          type: 'component-add',
          data: mockComponent
        })
      ).rejects.toThrow('No active collaboration session for workspace');
    });

    test('should handle cursor update for non-existent session gracefully', async () => {
      // Should not throw error
      await collaborationService.updateCursor('non-existent-workspace', mockUser1, { x: 100, y: 100 });
    });

    test('should handle selection update for non-existent session gracefully', async () => {
      // Should not throw error
      await collaborationService.updateSelection('non-existent-workspace', mockUser1, ['comp-1']);
    });
  });
});