/**
 * Sharing Service Layer
 * Handles workspace sharing and collaboration functionality per SRS FR-1.3
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import { Workspace } from '../types';

export interface WorkspaceShare {
  id: string;
  workspaceId: string;
  sharedBy: string;
  shareToken: string;
  permissionLevel: 'view' | 'edit' | 'admin';
  expiresAt?: Date;
  isPublic: boolean;
  accessCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceCollaborator {
  id: string;
  workspaceId: string;
  userId: string;
  invitedBy: string;
  permissionLevel: 'view' | 'edit' | 'admin';
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  invitedAt: Date;
  acceptedAt?: Date;
  lastAccessed?: Date;
}

export interface CreateShareRequest {
  workspaceId: string;
  sharedBy: string;
  permissionLevel: 'view' | 'edit' | 'admin';
  expiresIn?: number; // seconds from now
  isPublic?: boolean;
}

export interface ShareAccessInfo {
  share: WorkspaceShare;
  workspace: Workspace;
  hasAccess: boolean;
  accessDeniedReason?: string;
}

export interface InviteCollaboratorRequest {
  workspaceId: string;
  userId: string;
  invitedBy: string;
  permissionLevel: 'view' | 'edit' | 'admin';
}

export interface UpdateCollaboratorRequest {
  permissionLevel?: 'view' | 'edit' | 'admin';
  status?: 'accepted' | 'declined' | 'revoked';
}

export class SharingService {
  private db: Pool | null = null;

  constructor(requireDatabase: boolean = true) {
    if (requireDatabase) {
      this.db = getDatabase();
    }
  }

  /**
   * Create a shareable link for a workspace
   */
  async createShare(request: CreateShareRequest): Promise<WorkspaceShare> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Verify workspace exists and user has admin access
      const workspaceResult = await client.query(
        'SELECT id, user_id FROM workspaces WHERE id = $1',
        [request.workspaceId]
      );

      if (workspaceResult.rows.length === 0) {
        throw new Error('Workspace not found');
      }

      const workspace = workspaceResult.rows[0];
      
      // Check if user is owner or has admin permission
      if (workspace.user_id !== request.sharedBy) {
        const collaboratorResult = await client.query(
          'SELECT permission_level FROM workspace_collaborators WHERE workspace_id = $1 AND user_id = $2 AND status = $3',
          [request.workspaceId, request.sharedBy, 'accepted']
        );

        if (collaboratorResult.rows.length === 0 || collaboratorResult.rows[0].permission_level !== 'admin') {
          throw new Error('Insufficient permissions to share workspace');
        }
      }

      const shareId = uuidv4();
      const shareToken = uuidv4();
      const now = new Date();
      const expiresAt = request.expiresIn ? new Date(now.getTime() + request.expiresIn * 1000) : null;

      // Insert share record
      const shareResult = await client.query(
        `INSERT INTO workspace_shares 
         (id, workspace_id, shared_by, share_token, permission_level, expires_at, is_public, access_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          shareId,
          request.workspaceId,
          request.sharedBy,
          shareToken,
          request.permissionLevel,
          expiresAt,
          request.isPublic || false,
          0,
          now,
          now
        ]
      );

      await client.query('COMMIT');

      return this.mapShareFromDb(shareResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get workspace by share token
   */
  async getWorkspaceByShareToken(shareToken: string, accessorUserId?: string): Promise<ShareAccessInfo> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      // Get share information
      const shareResult = await client.query(
        'SELECT * FROM workspace_shares WHERE share_token = $1',
        [shareToken]
      );

      if (shareResult.rows.length === 0) {
        throw new Error('Share not found');
      }

      const share = this.mapShareFromDb(shareResult.rows[0]);

      // Check if share has expired
      if (share.expiresAt && share.expiresAt < new Date()) {
        return {
          share,
          workspace: {} as Workspace,
          hasAccess: false,
          accessDeniedReason: 'Share link has expired'
        };
      }

      // Get workspace data
      const workspaceResult = await client.query(
        'SELECT * FROM workspaces WHERE id = $1',
        [share.workspaceId]
      );

      if (workspaceResult.rows.length === 0) {
        return {
          share,
          workspace: {} as Workspace,
          hasAccess: false,
          accessDeniedReason: 'Workspace not found'
        };
      }

      // Get components and connections
      const componentsResult = await client.query(
        'SELECT * FROM components WHERE workspace_id = $1 ORDER BY created_at',
        [share.workspaceId]
      );

      const connectionsResult = await client.query(
        'SELECT * FROM connections WHERE workspace_id = $1 ORDER BY created_at',
        [share.workspaceId]
      );

      const workspace: Workspace = {
        id: workspaceResult.rows[0].id,
        name: workspaceResult.rows[0].name,
        description: workspaceResult.rows[0].description,
        userId: workspaceResult.rows[0].user_id,
        components: componentsResult.rows.map(row => ({
          id: row.id,
          type: row.type,
          position: row.position,
          configuration: row.configuration,
          metadata: row.metadata
        })),
        connections: connectionsResult.rows.map(row => ({
          id: row.id,
          sourceComponentId: row.source_component_id,
          targetComponentId: row.target_component_id,
          sourcePort: row.source_port,
          targetPort: row.target_port,
          configuration: row.configuration
        })),
        configuration: workspaceResult.rows[0].configuration,
        createdAt: workspaceResult.rows[0].created_at,
        updatedAt: workspaceResult.rows[0].updated_at
      };

      // Increment access count
      await client.query(
        'UPDATE workspace_shares SET access_count = access_count + 1, updated_at = NOW() WHERE id = $1',
        [share.id]
      );

      return {
        share,
        workspace,
        hasAccess: true
      };
    } finally {
      client.release();
    }
  }

  /**
   * List shares for a workspace
   */
  async getWorkspaceShares(workspaceId: string, userId: string): Promise<WorkspaceShare[]> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      // Verify user has access to workspace
      const hasAccess = await this.verifyWorkspaceAccess(workspaceId, userId, 'view');
      if (!hasAccess) {
        throw new Error('Access denied to workspace');
      }

      const result = await client.query(
        'SELECT * FROM workspace_shares WHERE workspace_id = $1 ORDER BY created_at DESC',
        [workspaceId]
      );

      return result.rows.map(row => this.mapShareFromDb(row));
    } finally {
      client.release();
    }
  }

  /**
   * Revoke a share
   */
  async revokeShare(shareId: string, userId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      // Get share info to verify permissions
      const shareResult = await client.query(
        'SELECT workspace_id, shared_by FROM workspace_shares WHERE id = $1',
        [shareId]
      );

      if (shareResult.rows.length === 0) {
        return false;
      }

      const { workspace_id, shared_by } = shareResult.rows[0];

      // Verify user can revoke (owner or admin)
      const hasAccess = await this.verifyWorkspaceAccess(workspace_id, userId, 'admin') || shared_by === userId;
      if (!hasAccess) {
        throw new Error('Insufficient permissions to revoke share');
      }

      const result = await client.query(
        'DELETE FROM workspace_shares WHERE id = $1',
        [shareId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Invite a collaborator to a workspace
   */
  async inviteCollaborator(request: InviteCollaboratorRequest): Promise<WorkspaceCollaborator> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Verify inviter has admin access
      const hasAccess = await this.verifyWorkspaceAccess(request.workspaceId, request.invitedBy, 'admin');
      if (!hasAccess) {
        throw new Error('Insufficient permissions to invite collaborators');
      }

      // Check if user is already a collaborator
      const existingResult = await client.query(
        'SELECT id, status FROM workspace_collaborators WHERE workspace_id = $1 AND user_id = $2',
        [request.workspaceId, request.userId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        if (existing.status === 'accepted') {
          throw new Error('User is already a collaborator');
        } else if (existing.status === 'pending') {
          throw new Error('User already has a pending invitation');
        }
      }

      const collaboratorId = uuidv4();
      const now = new Date();

      // Insert or update collaborator record
      let collaboratorResult;
      if (existingResult.rows.length > 0) {
        // Update existing record
        collaboratorResult = await client.query(
          `UPDATE workspace_collaborators 
           SET permission_level = $1, status = 'pending', invited_by = $2, invited_at = $3
           WHERE workspace_id = $4 AND user_id = $5
           RETURNING *`,
          [request.permissionLevel, request.invitedBy, now, request.workspaceId, request.userId]
        );
      } else {
        // Insert new record
        collaboratorResult = await client.query(
          `INSERT INTO workspace_collaborators 
           (id, workspace_id, user_id, invited_by, permission_level, status, invited_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [collaboratorId, request.workspaceId, request.userId, request.invitedBy, request.permissionLevel, 'pending', now]
        );
      }

      await client.query('COMMIT');

      return this.mapCollaboratorFromDb(collaboratorResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update collaborator permissions or status
   */
  async updateCollaborator(
    workspaceId: string, 
    userId: string, 
    request: UpdateCollaboratorRequest, 
    updatedBy: string
  ): Promise<WorkspaceCollaborator | null> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      // Verify updater has admin access (unless user is updating their own status)
      if (userId !== updatedBy) {
        const hasAccess = await this.verifyWorkspaceAccess(workspaceId, updatedBy, 'admin');
        if (!hasAccess) {
          throw new Error('Insufficient permissions to update collaborator');
        }
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (request.permissionLevel !== undefined) {
        updateFields.push(`permission_level = $${paramIndex++}`);
        updateValues.push(request.permissionLevel);
      }

      if (request.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(request.status);
        
        if (request.status === 'accepted') {
          updateFields.push(`accepted_at = $${paramIndex++}`);
          updateValues.push(new Date());
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateValues.push(workspaceId, userId);

      const result = await client.query(
        `UPDATE workspace_collaborators 
         SET ${updateFields.join(', ')}
         WHERE workspace_id = $${paramIndex++} AND user_id = $${paramIndex++}
         RETURNING *`,
        updateValues
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapCollaboratorFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get collaborators for a workspace
   */
  async getWorkspaceCollaborators(workspaceId: string, userId: string): Promise<WorkspaceCollaborator[]> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      // Verify user has access to workspace
      const hasAccess = await this.verifyWorkspaceAccess(workspaceId, userId, 'view');
      if (!hasAccess) {
        throw new Error('Access denied to workspace');
      }

      const result = await client.query(
        'SELECT * FROM workspace_collaborators WHERE workspace_id = $1 ORDER BY invited_at DESC',
        [workspaceId]
      );

      return result.rows.map(row => this.mapCollaboratorFromDb(row));
    } finally {
      client.release();
    }
  }

  /**
   * Remove collaborator from workspace
   */
  async removeCollaborator(workspaceId: string, userId: string, removedBy: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      // Verify remover has admin access (unless user is removing themselves)
      if (userId !== removedBy) {
        const hasAccess = await this.verifyWorkspaceAccess(workspaceId, removedBy, 'admin');
        if (!hasAccess) {
          throw new Error('Insufficient permissions to remove collaborator');
        }
      }

      const result = await client.query(
        'DELETE FROM workspace_collaborators WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Verify user has access to workspace with specified permission level
   */
  private async verifyWorkspaceAccess(workspaceId: string, userId: string, requiredLevel: 'view' | 'edit' | 'admin'): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    const client = await this.db.connect();

    try {
      // Check if user is owner
      const ownerResult = await client.query(
        'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
        [workspaceId, userId]
      );

      if (ownerResult.rows.length > 0) {
        return true; // Owner has all permissions
      }

      // Check collaborator permissions
      const collaboratorResult = await client.query(
        'SELECT permission_level FROM workspace_collaborators WHERE workspace_id = $1 AND user_id = $2 AND status = $3',
        [workspaceId, userId, 'accepted']
      );

      if (collaboratorResult.rows.length === 0) {
        return false;
      }

      const userLevel = collaboratorResult.rows[0].permission_level as 'view' | 'edit' | 'admin';
      
      // Permission hierarchy: admin > edit > view
      const permissionLevels: Record<'view' | 'edit' | 'admin', number> = { view: 1, edit: 2, admin: 3 };
      return permissionLevels[userLevel] >= permissionLevels[requiredLevel];
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to WorkspaceShare object
   */
  private mapShareFromDb(row: any): WorkspaceShare {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sharedBy: row.shared_by,
      shareToken: row.share_token,
      permissionLevel: row.permission_level,
      expiresAt: row.expires_at,
      isPublic: row.is_public,
      accessCount: row.access_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to WorkspaceCollaborator object
   */
  private mapCollaboratorFromDb(row: any): WorkspaceCollaborator {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      invitedBy: row.invited_by,
      permissionLevel: row.permission_level,
      status: row.status,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at,
      lastAccessed: row.last_accessed
    };
  }
}