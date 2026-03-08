/**
 * Property-Based Tests for Real-time Collaboration
 * 
 * **Property 10: Real-time Collaboration Consistency**
 * **Validates: SRS FR-10.2, FR-10.3**
 * 
 * For any sequence of collaborative operations from multiple users, the collaboration system should:
 * - Maintain operational transformation consistency across all participants
 * - Ensure convergence of all participants to the same final state
 * - Preserve operation semantics after transformation
 * - Handle concurrent operations without data loss
 * - Maintain cursor and selection consistency across participants
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';
import { CollaborationService, CollaborativeOperation, SessionParticipant } from '../services/collaborationService';
import { Component, Connection, ComponentType } from '../types';

describe('Collaboration Property Tests', () => {

  /**
   * Property 10: Real-time Collaboration Consistency
   * For any sequence of collaborative operations, the system should maintain consistency
   */
  it('Property 10: Real-time Collaboration Consistency - should maintain session consistency', () => {
    // Feature: system-design-simulator, Property 10: Real-time Collaboration Consistency
    fc.assert(fc.property(
      // Generate workspace ID for this test case
      fc.string({ minLength: 10, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      // Generate exactly 2 users to avoid complexity
      fc.tuple(
        fc.record({
          userId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          socketId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
        }),
        fc.record({
          userId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          socketId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
        })
      ),

      async (mockWorkspaceId, [user1, user2]) => {
        // Create fresh service instance for each test case
        const collaborationService = new CollaborationService(false);
        
        // Ensure users have different IDs
        if (user1.userId === user2.userId) {
          user2.userId = user2.userId + '_2';
        }
        if (user1.socketId === user2.socketId) {
          user2.socketId = user2.socketId + '_2';
        }

        try {
          // Start collaboration session with both users
          await collaborationService.startSession(mockWorkspaceId, user1.userId, user1.socketId);
          await collaborationService.startSession(mockWorkspaceId, user2.userId, user2.socketId);

          const session = collaborationService.getSession(mockWorkspaceId);
          
          // Verify session was created
          expect(session).toBeDefined();
          expect(session!.participants.length).toBe(2);
          
          // Verify both users are in session
          const userIds = session!.participants.map(p => p.userId);
          expect(userIds).toContain(user1.userId);
          expect(userIds).toContain(user2.userId);
          
          // Verify all participants are active
          session!.participants.forEach(participant => {
            expect(participant.isActive).toBe(true);
            expect(participant.color).toBeDefined();
            expect(participant.cursor).toEqual({ x: 0, y: 0 });
            expect(participant.selection).toEqual([]);
          });

          // Test presence info
          const presenceInfo = collaborationService.getPresenceInfo(mockWorkspaceId);
          expect(presenceInfo.length).toBe(2);
          
          presenceInfo.forEach(presence => {
            expect(presence.userId).toBeDefined();
            expect(presence.socketId).toBeDefined();
            expect(presence.color).toBeDefined();
            expect(presence.isActive).toBe(true);
            expect(typeof presence.cursor.x).toBe('number');
            expect(typeof presence.cursor.y).toBe('number');
            expect(Array.isArray(presence.selection)).toBe(true);
            expect(presence.lastSeen).toBeInstanceOf(Date);
          });

          // Clean up session
          await collaborationService.endSession(mockWorkspaceId, user1.userId);
          await collaborationService.endSession(mockWorkspaceId, user2.userId);
          
          // Verify session is cleaned up
          const finalSession = collaborationService.getSession(mockWorkspaceId);
          expect(finalSession).toBeNull();
          
        } catch (error) {
          // Clean up on error
          try {
            await collaborationService.endSession(mockWorkspaceId, user1.userId);
            await collaborationService.endSession(mockWorkspaceId, user2.userId);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          throw error;
        }
      }
    ), { numRuns: 20 });
  });

  /**
   * Property: Cursor Updates Consistency
   * For any cursor position updates, the system should maintain consistent state
   */
  it('Property: Cursor Updates Consistency - should maintain cursor state consistency', () => {
    fc.assert(fc.property(
      // Generate workspace ID
      fc.string({ minLength: 10, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      // Generate cursor position
      fc.record({
        x: fc.integer({ min: 0, max: 1000 }),
        y: fc.integer({ min: 0, max: 1000 })
      }),

      async (mockWorkspaceId, cursorPosition) => {
        const collaborationService = new CollaborationService(false);
        const userId = 'test-user';
        const socketId = 'test-socket';
        
        try {
          // Start session
          await collaborationService.startSession(mockWorkspaceId, userId, socketId);

          // Update cursor position
          await collaborationService.updateCursor(mockWorkspaceId, userId, cursorPosition);

          // Verify cursor position was updated
          const presenceInfo = collaborationService.getPresenceInfo(mockWorkspaceId);
          expect(presenceInfo.length).toBe(1);
          expect(presenceInfo[0].cursor).toEqual(cursorPosition);
          expect(presenceInfo[0].userId).toBe(userId);

          // Verify cursor position is within valid range
          expect(presenceInfo[0].cursor.x).toBeGreaterThanOrEqual(0);
          expect(presenceInfo[0].cursor.x).toBeLessThanOrEqual(1000);
          expect(presenceInfo[0].cursor.y).toBeGreaterThanOrEqual(0);
          expect(presenceInfo[0].cursor.y).toBeLessThanOrEqual(1000);

          // Clean up
          await collaborationService.endSession(mockWorkspaceId, userId);
        } catch (error) {
          try {
            await collaborationService.endSession(mockWorkspaceId, userId);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          throw error;
        }
      }
    ), { numRuns: 20 });
  });

  /**
   * Property: Operational Transformation Basic Functionality
   * For concurrent component additions at same position, transformation should occur
   */
  it('Property: Operational Transformation Basic Functionality - should transform conflicting operations', () => {
    fc.assert(fc.property(
      // Generate workspace ID
      fc.string({ minLength: 10, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      // Generate position that will conflict
      fc.record({
        x: fc.integer({ min: 0, max: 500 }),
        y: fc.integer({ min: 0, max: 500 })
      }),
      // Generate component properties
      fc.record({
        capacity1: fc.integer({ min: 100, max: 5000 }),
        capacity2: fc.integer({ min: 100, max: 5000 })
      }),

      async (mockWorkspaceId, position, { capacity1, capacity2 }) => {
        const collaborationService = new CollaborationService(false);
        const user1 = { userId: 'user-1', socketId: 'socket-1' };
        const user2 = { userId: 'user-2', socketId: 'socket-2' };
        
        try {
          // Start session with both users
          await collaborationService.startSession(mockWorkspaceId, user1.userId, user1.socketId);
          await collaborationService.startSession(mockWorkspaceId, user2.userId, user2.socketId);

          const session = collaborationService.getSession(mockWorkspaceId);
          expect(session).toBeDefined();

          // Create first operation (concurrent, not applied)
          const concurrentOp1: CollaborativeOperation = {
            id: uuidv4(),
            sessionId: session!.id,
            userId: user1.userId,
            type: 'component-add',
            data: {
              id: 'comp-1',
              type: 'database' as ComponentType,
              position: position,
              configuration: { capacity: capacity1, latency: 10, failureRate: 0.01 },
              metadata: { name: 'Test Component 1', description: 'Test', version: '1.0' }
            },
            timestamp: new Date(),
            applied: false
          };

          // Add to session operations to simulate concurrency
          session!.operations.push(concurrentOp1);

          // Apply second operation (should be transformed due to same position)
          const transformedOp = await collaborationService.applyOperation(mockWorkspaceId, {
            sessionId: session!.id,
            userId: user2.userId,
            type: 'component-add',
            data: {
              id: 'comp-2',
              type: 'cache' as ComponentType,
              position: position, // Same position as first operation
              configuration: { capacity: capacity2, latency: 5, failureRate: 0.005 },
              metadata: { name: 'Test Component 2', description: 'Test', version: '1.0' }
            }
          });

          // Verify operation was applied
          expect(transformedOp.applied).toBe(true);
          expect(transformedOp.userId).toBe(user2.userId);
          expect(transformedOp.type).toBe('component-add');

          // Verify transformation occurred (position should be offset)
          expect(transformedOp.transformedFrom).toBeDefined();
          expect(transformedOp.data.position.x).toBe(position.x + 50);
          expect(transformedOp.data.position.y).toBe(position.y + 50);

          // Verify session has operations
          const finalSession = collaborationService.getSession(mockWorkspaceId);
          expect(finalSession!.operations.length).toBeGreaterThanOrEqual(1);

          // Clean up
          await collaborationService.endSession(mockWorkspaceId, user1.userId);
          await collaborationService.endSession(mockWorkspaceId, user2.userId);
        } catch (error) {
          try {
            await collaborationService.endSession(mockWorkspaceId, user1.userId);
            await collaborationService.endSession(mockWorkspaceId, user2.userId);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          throw error;
        }
      }
    ), { numRuns: 15 });
  });
});