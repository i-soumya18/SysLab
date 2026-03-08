/**
 * Collaboration Service Layer
 * Handles real-time multi-user editing and operational transformation per SRS FR-10
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import { Component, Connection } from '../types';

export interface CollaborationSession {
  id: string;
  workspaceId: string;
  participants: SessionParticipant[];
  operations: CollaborativeOperation[];
  startedAt: Date;
  lastActivity: Date;
}

export interface SessionParticipant {
  userId: string;
  socketId: string;
  cursor: { x: number; y: number };
  selection: string[];
  color: string;
  isActive: boolean;
  joinedAt: Date;
  lastSeen: Date;
}

export interface CollaborativeOperation {
  id: string;
  sessionId: string;
  userId: string;
  type: 'component-add' | 'component-update' | 'component-delete' | 'connection-create' | 'connection-delete' | 'cursor-move' | 'selection-change';
  data: any;
  timestamp: Date;
  applied: boolean;
  transformedFrom?: string; // ID of original operation if this was transformed
}

export interface OperationTransform {
  originalOperation: CollaborativeOperation;
  concurrentOperations: CollaborativeOperation[];
  transformedOperation: CollaborativeOperation;
}

export interface CursorUpdate {
  userId: string;
  position: { x: number; y: number };
  timestamp: Date;
}

export interface SelectionUpdate {
  userId: string;
  selectedIds: string[];
  timestamp: Date;
}

export interface PresenceInfo {
  userId: string;
  socketId: string;
  cursor: { x: number; y: number };
  selection: string[];
  color: string;
  isActive: boolean;
  lastSeen: Date;
}

export class CollaborationService extends EventEmitter {
  private db: Pool | null = null;
  private activeSessions: Map<string, CollaborationSession> = new Map();
  private userColors: string[] = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  constructor(requireDatabase: boolean = true) {
    super();
    if (requireDatabase) {
      this.db = getDatabase();
    }
  }

  /**
   * Start a collaboration session for a workspace
   */
  async startSession(workspaceId: string, userId: string, socketId: string): Promise<CollaborationSession> {
    // Check if session already exists
    let session = this.activeSessions.get(workspaceId);
    
    if (!session) {
      // Create new session
      const sessionId = uuidv4();
      const now = new Date();

      // Insert session record if database is available
      if (this.db) {
        const client = await this.db.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO collaboration_sessions (id, workspace_id, started_at, last_activity)
             VALUES ($1, $2, $3, $4)`,
            [sessionId, workspaceId, now, now]
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }

      session = {
        id: sessionId,
        workspaceId,
        participants: [],
        operations: [],
        startedAt: now,
        lastActivity: now
      };

      this.activeSessions.set(workspaceId, session);
    }

    // Add participant to session
    const participant: SessionParticipant = {
      userId,
      socketId,
      cursor: { x: 0, y: 0 },
      selection: [],
      color: this.assignUserColor(session.participants.length),
      isActive: true,
      joinedAt: new Date(),
      lastSeen: new Date()
    };

    // Remove existing participant with same userId if exists
    session.participants = session.participants.filter(p => p.userId !== userId);
    session.participants.push(participant);

    // Insert participant record if database is available
    if (this.db) {
      const client = await this.db.connect();
      try {
        await client.query(
          `INSERT INTO collaboration_participants (session_id, user_id, socket_id, color, joined_at, last_seen)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (session_id, user_id) 
           DO UPDATE SET socket_id = $3, last_seen = $6, is_active = true`,
          [session.id, userId, socketId, participant.color, participant.joinedAt, participant.lastSeen]
        );
      } finally {
        client.release();
      }
    }

    // Emit session started event
    this.emit('session:started', {
      sessionId: session.id,
      workspaceId,
      participant
    });

    return session;
  }

  /**
   * End collaboration session for a user
   */
  async endSession(workspaceId: string, userId: string): Promise<void> {
    const session = this.activeSessions.get(workspaceId);
    if (!session) {
      return;
    }

    // Remove participant from session
    session.participants = session.participants.filter(p => p.userId !== userId);

    // Update database if available
    if (this.db) {
      const client = await this.db.connect();
      try {
        await client.query(
          `UPDATE collaboration_participants 
           SET is_active = false, last_seen = NOW()
           WHERE session_id = $1 AND user_id = $2`,
          [session.id, userId]
        );
      } finally {
        client.release();
      }
    }

    // If no participants left, end session
    if (session.participants.length === 0) {
      if (this.db) {
        const client = await this.db.connect();
        try {
          await client.query(
            `UPDATE collaboration_sessions 
             SET ended_at = NOW()
             WHERE id = $1`,
            [session.id]
          );
        } finally {
          client.release();
        }
      }

      this.activeSessions.delete(workspaceId);

      this.emit('session:ended', {
        sessionId: session.id,
        workspaceId
      });
    } else {
      this.emit('participant:left', {
        sessionId: session.id,
        workspaceId,
        userId
      });
    }
  }

  /**
   * Apply collaborative operation with operational transformation
   */
  async applyOperation(workspaceId: string, operation: Omit<CollaborativeOperation, 'id' | 'applied' | 'timestamp'>): Promise<CollaborativeOperation> {
    const session = this.activeSessions.get(workspaceId);
    if (!session) {
      throw new Error('No active collaboration session for workspace');
    }

    // Create full operation
    const fullOperation: CollaborativeOperation = {
      id: uuidv4(),
      timestamp: new Date(),
      applied: false,
      ...operation
    };

    // Get concurrent operations that haven't been applied yet from other users
    const concurrentOps = session.operations.filter(op => 
      !op.applied && 
      op.userId !== operation.userId &&
      Math.abs(op.timestamp.getTime() - fullOperation.timestamp.getTime()) < 5000 // Within 5 seconds
    );

    // Apply operational transformation if there are concurrent operations
    let transformedOperation = fullOperation;
    if (concurrentOps.length > 0) {
      transformedOperation = this.transformOperation(fullOperation, concurrentOps);
    }

    // Store operation if database is available
    if (this.db) {
      const client = await this.db.connect();
      try {
        await client.query(
          `INSERT INTO collaboration_operations 
           (id, session_id, user_id, operation_type, operation_data, timestamp, applied, transformed_from)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            transformedOperation.id,
            session.id,
            transformedOperation.userId,
            transformedOperation.type,
            JSON.stringify(transformedOperation.data),
            transformedOperation.timestamp,
            false,
            transformedOperation.transformedFrom || null
          ]
        );
      } finally {
        client.release();
      }
    }

    // Add to session operations
    session.operations.push(transformedOperation);
    session.lastActivity = new Date();

    // Mark as applied
    transformedOperation.applied = true;

    // Emit operation applied event
    this.emit('operation:applied', {
      sessionId: session.id,
      workspaceId,
      operation: transformedOperation,
      wasTransformed: transformedOperation.transformedFrom !== undefined
    });

    return transformedOperation;
  }

  /**
   * Update user cursor position
   */
  async updateCursor(workspaceId: string, userId: string, position: { x: number; y: number }): Promise<void> {
    const session = this.activeSessions.get(workspaceId);
    if (!session) {
      return;
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) {
      return;
    }

    participant.cursor = position;
    participant.lastSeen = new Date();

    this.emit('cursor:updated', {
      sessionId: session.id,
      workspaceId,
      userId,
      position,
      timestamp: new Date()
    });
  }

  /**
   * Update user selection
   */
  async updateSelection(workspaceId: string, userId: string, selectedIds: string[]): Promise<void> {
    const session = this.activeSessions.get(workspaceId);
    if (!session) {
      return;
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) {
      return;
    }

    participant.selection = selectedIds;
    participant.lastSeen = new Date();

    this.emit('selection:updated', {
      sessionId: session.id,
      workspaceId,
      userId,
      selectedIds,
      timestamp: new Date()
    });
  }

  /**
   * Get current presence information for a workspace
   */
  getPresenceInfo(workspaceId: string): PresenceInfo[] {
    const session = this.activeSessions.get(workspaceId);
    if (!session) {
      return [];
    }

    return session.participants
      .filter(p => p.isActive)
      .map(p => ({
        userId: p.userId,
        socketId: p.socketId,
        cursor: p.cursor,
        selection: p.selection,
        color: p.color,
        isActive: p.isActive,
        lastSeen: p.lastSeen
      }));
  }

  /**
   * Get active session for workspace
   */
  getSession(workspaceId: string): CollaborationSession | null {
    return this.activeSessions.get(workspaceId) || null;
  }

  /**
   * Transform operation based on concurrent operations (Operational Transformation)
   */
  private transformOperation(
    operation: CollaborativeOperation,
    concurrentOps: CollaborativeOperation[]
  ): CollaborativeOperation {
    let transformed = { ...operation };

    for (const concurrentOp of concurrentOps) {
      transformed = this.transformAgainstOperation(transformed, concurrentOp);
    }

    // Mark as transformed
    if (concurrentOps.length > 0) {
      transformed.transformedFrom = operation.id;
      transformed.id = uuidv4(); // New ID for transformed operation
    }

    return transformed;
  }

  /**
   * Transform one operation against another
   */
  private transformAgainstOperation(
    op: CollaborativeOperation,
    against: CollaborativeOperation
  ): CollaborativeOperation {
    // Handle different operation type combinations
    if (op.type === 'component-add' && against.type === 'component-add') {
      return this.transformComponentAdd(op, against);
    }

    if (op.type === 'component-update' && against.type === 'component-update') {
      return this.transformComponentUpdate(op, against);
    }

    if (op.type === 'component-delete' && against.type === 'component-update') {
      return this.transformDeleteAgainstUpdate(op, against);
    }

    if (op.type === 'component-update' && against.type === 'component-delete') {
      return this.transformUpdateAgainstDelete(op, against);
    }

    if (op.type === 'connection-create' && against.type === 'component-delete') {
      return this.transformConnectionAgainstComponentDelete(op, against);
    }

    // Default: return operation unchanged
    return op;
  }

  /**
   * Transform component add operations
   */
  private transformComponentAdd(op: CollaborativeOperation, against: CollaborativeOperation): CollaborativeOperation {
    const opData = op.data as Component;
    const againstData = against.data as Component;

    // If components have same position, offset one of them
    if (opData.position.x === againstData.position.x && opData.position.y === againstData.position.y) {
      return {
        ...op,
        data: {
          ...opData,
          position: {
            x: opData.position.x + 50,
            y: opData.position.y + 50
          }
        }
      };
    }

    return op;
  }

  /**
   * Transform component update operations
   */
  private transformComponentUpdate(op: CollaborativeOperation, against: CollaborativeOperation): CollaborativeOperation {
    const opData = op.data as Partial<Component>;
    const againstData = against.data as Partial<Component>;

    // If updating the same component, merge changes
    if (opData.id === againstData.id) {
      return {
        ...op,
        data: {
          ...opData,
          // Merge configurations, with current operation taking precedence
          configuration: {
            ...againstData.configuration,
            ...opData.configuration
          },
          // Preserve other fields from against operation if not in current operation
          ...(againstData.position && !opData.position && { position: againstData.position }),
          ...(againstData.metadata && !opData.metadata && { metadata: againstData.metadata })
        }
      };
    }

    return op;
  }

  /**
   * Transform delete operation against update
   */
  private transformDeleteAgainstUpdate(op: CollaborativeOperation, against: CollaborativeOperation): CollaborativeOperation {
    const opData = op.data as { componentId: string };
    const againstData = against.data as Partial<Component>;

    // If trying to delete a component that was just updated, the delete takes precedence
    if (opData.componentId === againstData.id) {
      return op; // Delete operation unchanged
    }

    return op;
  }

  /**
   * Transform update operation against delete
   */
  private transformUpdateAgainstDelete(op: CollaborativeOperation, against: CollaborativeOperation): CollaborativeOperation {
    const opData = op.data as Partial<Component>;
    const againstData = against.data as { componentId: string };

    // If trying to update a component that was deleted, discard the update
    if (opData.id === againstData.componentId) {
      return {
        ...op,
        type: 'component-delete', // Convert to no-op
        data: { componentId: opData.id, reason: 'component_already_deleted' }
      };
    }

    return op;
  }

  /**
   * Transform connection operation against component delete
   */
  private transformConnectionAgainstComponentDelete(op: CollaborativeOperation, against: CollaborativeOperation): CollaborativeOperation {
    const opData = op.data as Connection;
    const againstData = against.data as { componentId: string };

    // If connection involves a deleted component, discard the connection
    if (opData.sourceComponentId === againstData.componentId || 
        opData.targetComponentId === againstData.componentId) {
      return {
        ...op,
        type: 'connection-delete', // Convert to no-op
        data: { 
          connectionId: opData.id, 
          reason: 'component_deleted',
          deletedComponentId: againstData.componentId
        }
      };
    }

    return op;
  }

  /**
   * Assign color to user based on participant index
   */
  private assignUserColor(participantIndex: number): string {
    return this.userColors[participantIndex % this.userColors.length];
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(inactiveThresholdMinutes: number = 30): Promise<void> {
    const threshold = new Date(Date.now() - inactiveThresholdMinutes * 60 * 1000);

    for (const [workspaceId, session] of this.activeSessions.entries()) {
      if (session.lastActivity < threshold) {
        // End session
        if (this.db) {
          const client = await this.db.connect();
          try {
            await client.query(
              `UPDATE collaboration_sessions 
               SET ended_at = NOW()
               WHERE id = $1`,
              [session.id]
            );
          } finally {
            client.release();
          }
        }

        this.activeSessions.delete(workspaceId);

        this.emit('session:cleanup', {
          sessionId: session.id,
          workspaceId,
          reason: 'inactive'
        });
      }
    }
  }
}