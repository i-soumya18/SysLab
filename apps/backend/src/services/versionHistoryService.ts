/**
 * Version History Service
 * Handles workspace version tracking, rollback, and branch management per SRS FR-10.4
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import { Workspace, Component, Connection } from '../types';

export interface WorkspaceVersion {
  id: string;
  workspaceId: string;
  versionNumber: number;
  name: string;
  description?: string;
  snapshot: WorkspaceSnapshot;
  changesSummary: ChangesSummary;
  createdAt: Date;
  createdBy: string;
  parentVersionId?: string;
  branchName?: string;
  tags: string[];
}

export interface WorkspaceSnapshot {
  components: Component[];
  connections: Connection[];
  configuration: any;
}

export interface ChangesSummary {
  componentsAdded: number;
  componentsModified: number;
  componentsRemoved: number;
  connectionsAdded: number;
  connectionsModified: number;
  connectionsRemoved: number;
  configurationChanged: boolean;
  totalChanges: number;
}

export interface VersionComparison {
  baseVersion: WorkspaceVersion;
  compareVersion: WorkspaceVersion;
  differences: VersionDifferences;
  summary: string;
}

export interface VersionDifferences {
  components: {
    added: Component[];
    modified: ComponentDiff[];
    removed: Component[];
  };
  connections: {
    added: Connection[];
    modified: ConnectionDiff[];
    removed: Connection[];
  };
  configuration: {
    changed: boolean;
    differences: any;
  };
}

export interface ComponentDiff {
  id: string;
  changes: {
    position?: { from: any; to: any };
    configuration?: { from: any; to: any };
    metadata?: { from: any; to: any };
  };
}

export interface ConnectionDiff {
  id: string;
  changes: {
    configuration?: { from: any; to: any };
  };
}

export interface CreateVersionRequest {
  workspaceId: string;
  name: string;
  description?: string;
  createdBy: string;
  branchName?: string;
  tags?: string[];
}

export interface RollbackRequest {
  workspaceId: string;
  targetVersionId: string;
  userId: string;
  createBackupVersion?: boolean;
}

export interface BranchRequest {
  workspaceId: string;
  sourceVersionId: string;
  branchName: string;
  createdBy: string;
}

export class VersionHistoryService {
  private db: Pool | null = null;

  constructor(requireDatabase: boolean = true) {
    if (requireDatabase) {
      this.db = getDatabase();
    }
  }

  /**
   * Create a new version of the workspace
   */
  async createVersion(request: CreateVersionRequest, currentWorkspace: Workspace): Promise<WorkspaceVersion> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get the latest version number
      const latestVersionResult = await client.query(
        'SELECT MAX(version_number) as max_version FROM workspace_versions WHERE workspace_id = $1',
        [request.workspaceId]
      );

      const nextVersionNumber = (latestVersionResult.rows[0]?.max_version || 0) + 1;

      // Calculate changes from previous version
      const changesSummary = await this.calculateChanges(request.workspaceId, currentWorkspace);

      const versionId = uuidv4();
      const now = new Date();

      // Create snapshot
      const snapshot: WorkspaceSnapshot = {
        components: currentWorkspace.components,
        connections: currentWorkspace.connections,
        configuration: currentWorkspace.configuration
      };

      // Insert version record
      const versionResult = await client.query(
        `INSERT INTO workspace_versions 
         (id, workspace_id, version_number, name, description, snapshot, changes_summary, created_at, created_by, branch_name, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          versionId,
          request.workspaceId,
          nextVersionNumber,
          request.name,
          request.description || null,
          JSON.stringify(snapshot),
          JSON.stringify(changesSummary),
          now,
          request.createdBy,
          request.branchName || 'main',
          JSON.stringify(request.tags || [])
        ]
      );

      await client.query('COMMIT');

      return this.mapVersionFromDb(versionResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get version history for a workspace
   */
  async getVersionHistory(workspaceId: string, options: {
    limit?: number;
    offset?: number;
    branchName?: string;
    includeSnapshots?: boolean;
  } = {}): Promise<{
    versions: WorkspaceVersion[];
    total: number;
    branches: string[];
  }> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      const { limit = 50, offset = 0, branchName, includeSnapshots = false } = options;

      // Build query conditions
      let whereClause = 'WHERE workspace_id = $1';
      const queryParams: any[] = [workspaceId];
      let paramIndex = 2;

      if (branchName) {
        whereClause += ` AND branch_name = $${paramIndex++}`;
        queryParams.push(branchName);
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM workspace_versions ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);

      // Get versions
      const selectFields = includeSnapshots 
        ? '*' 
        : 'id, workspace_id, version_number, name, description, changes_summary, created_at, created_by, branch_name, tags';

      const versionsResult = await client.query(
        `SELECT ${selectFields} FROM workspace_versions 
         ${whereClause}
         ORDER BY version_number DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, limit, offset]
      );

      // Get all branches
      const branchesResult = await client.query(
        'SELECT DISTINCT branch_name FROM workspace_versions WHERE workspace_id = $1 ORDER BY branch_name',
        [workspaceId]
      );

      const versions = versionsResult.rows.map(row => this.mapVersionFromDb(row, !includeSnapshots));
      const branches = branchesResult.rows.map(row => row.branch_name);

      return { versions, total, branches };
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific version by ID
   */
  async getVersionById(versionId: string): Promise<WorkspaceVersion | null> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      const result = await client.query(
        'SELECT * FROM workspace_versions WHERE id = $1',
        [versionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapVersionFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Rollback workspace to a specific version
   */
  async rollbackToVersion(request: RollbackRequest): Promise<Workspace> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get target version
      const targetVersion = await this.getVersionById(request.targetVersionId);
      if (!targetVersion) {
        throw new Error('Target version not found');
      }

      // Create backup version if requested
      if (request.createBackupVersion) {
        const currentWorkspaceResult = await client.query(
          'SELECT * FROM workspaces WHERE id = $1',
          [request.workspaceId]
        );

        if (currentWorkspaceResult.rows.length > 0) {
          const currentWorkspace = await this.buildWorkspaceFromDb(currentWorkspaceResult.rows[0]);
          
          await this.createVersion({
            workspaceId: request.workspaceId,
            name: `Backup before rollback to v${targetVersion.versionNumber}`,
            description: `Automatic backup created before rolling back to version ${targetVersion.versionNumber}`,
            createdBy: request.userId,
            tags: ['backup', 'rollback']
          }, currentWorkspace);
        }
      }

      // Update workspace with target version data
      const now = new Date();
      await client.query(
        `UPDATE workspaces 
         SET configuration = $1, updated_at = $2
         WHERE id = $3`,
        [JSON.stringify(targetVersion.snapshot.configuration), now, request.workspaceId]
      );

      // Delete existing components and connections
      await client.query('DELETE FROM components WHERE workspace_id = $1', [request.workspaceId]);
      await client.query('DELETE FROM connections WHERE workspace_id = $1', [request.workspaceId]);

      // Insert components from target version
      for (const component of targetVersion.snapshot.components) {
        await client.query(
          `INSERT INTO components (id, workspace_id, type, position, configuration, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            component.id,
            request.workspaceId,
            component.type,
            JSON.stringify(component.position),
            JSON.stringify(component.configuration),
            JSON.stringify(component.metadata),
            now,
            now
          ]
        );
      }

      // Insert connections from target version
      for (const connection of targetVersion.snapshot.connections) {
        await client.query(
          `INSERT INTO connections (id, workspace_id, source_component_id, target_component_id, source_port, target_port, configuration, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            connection.id,
            request.workspaceId,
            connection.sourceComponentId,
            connection.targetComponentId,
            connection.sourcePort,
            connection.targetPort,
            JSON.stringify(connection.configuration),
            now,
            now
          ]
        );
      }

      await client.query('COMMIT');

      // Return updated workspace
      return await this.buildWorkspaceFromDb({
        id: request.workspaceId,
        name: `Rolled back to v${targetVersion.versionNumber}`,
        description: `Workspace rolled back to version ${targetVersion.versionNumber}`,
        user_id: request.userId,
        configuration: targetVersion.snapshot.configuration,
        created_at: now,
        updated_at: now
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a branch from a specific version
   */
  async createBranch(request: BranchRequest): Promise<WorkspaceVersion> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    // Get source version
    const sourceVersion = await this.getVersionById(request.sourceVersionId);
    if (!sourceVersion) {
      throw new Error('Source version not found');
    }

    // Create new version with branch name
    const workspace: Workspace = {
      id: request.workspaceId,
      name: `Branch: ${request.branchName}`,
      description: `Branch created from version ${sourceVersion.versionNumber}`,
      userId: request.createdBy,
      components: sourceVersion.snapshot.components,
      connections: sourceVersion.snapshot.connections,
      configuration: sourceVersion.snapshot.configuration,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.createVersion({
      workspaceId: request.workspaceId,
      name: `Branch: ${request.branchName}`,
      description: `Branch created from version ${sourceVersion.versionNumber}`,
      createdBy: request.createdBy,
      branchName: request.branchName,
      tags: ['branch']
    }, workspace);
  }

  /**
   * Compare two versions
   */
  async compareVersions(baseVersionId: string, compareVersionId: string): Promise<VersionComparison> {
    const baseVersion = await this.getVersionById(baseVersionId);
    const compareVersion = await this.getVersionById(compareVersionId);

    if (!baseVersion || !compareVersion) {
      throw new Error('One or both versions not found');
    }

    const differences = this.calculateDifferences(baseVersion.snapshot, compareVersion.snapshot);
    const summary = this.generateComparisonSummary(differences);

    return {
      baseVersion,
      compareVersion,
      differences,
      summary
    };
  }

  /**
   * Delete a version (soft delete by marking as deleted)
   */
  async deleteVersion(versionId: string, userId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }

    const client = await this.db.connect();

    try {
      const result = await client.query(
        `UPDATE workspace_versions 
         SET deleted_at = NOW(), deleted_by = $1
         WHERE id = $2 AND deleted_at IS NULL`,
        [userId, versionId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate changes from previous version
   */
  private async calculateChanges(workspaceId: string, currentWorkspace: Workspace): Promise<ChangesSummary> {
    if (!this.db) {
      return {
        componentsAdded: currentWorkspace.components.length,
        componentsModified: 0,
        componentsRemoved: 0,
        connectionsAdded: currentWorkspace.connections.length,
        connectionsModified: 0,
        connectionsRemoved: 0,
        configurationChanged: true,
        totalChanges: currentWorkspace.components.length + currentWorkspace.connections.length + 1
      };
    }

    const client = await this.db.connect();

    try {
      // Get latest version
      const latestVersionResult = await client.query(
        `SELECT snapshot FROM workspace_versions 
         WHERE workspace_id = $1 
         ORDER BY version_number DESC 
         LIMIT 1`,
        [workspaceId]
      );

      if (latestVersionResult.rows.length === 0) {
        // First version
        return {
          componentsAdded: currentWorkspace.components.length,
          componentsModified: 0,
          componentsRemoved: 0,
          connectionsAdded: currentWorkspace.connections.length,
          connectionsModified: 0,
          connectionsRemoved: 0,
          configurationChanged: true,
          totalChanges: currentWorkspace.components.length + currentWorkspace.connections.length + 1
        };
      }

      const previousSnapshot: WorkspaceSnapshot = latestVersionResult.rows[0].snapshot;
      const differences = this.calculateDifferences(previousSnapshot, {
        components: currentWorkspace.components,
        connections: currentWorkspace.connections,
        configuration: currentWorkspace.configuration
      });

      return {
        componentsAdded: differences.components.added.length,
        componentsModified: differences.components.modified.length,
        componentsRemoved: differences.components.removed.length,
        connectionsAdded: differences.connections.added.length,
        connectionsModified: differences.connections.modified.length,
        connectionsRemoved: differences.connections.removed.length,
        configurationChanged: differences.configuration.changed,
        totalChanges: differences.components.added.length + 
                     differences.components.modified.length + 
                     differences.components.removed.length +
                     differences.connections.added.length + 
                     differences.connections.modified.length + 
                     differences.connections.removed.length +
                     (differences.configuration.changed ? 1 : 0)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Calculate differences between two snapshots
   */
  private calculateDifferences(baseSnapshot: WorkspaceSnapshot, compareSnapshot: WorkspaceSnapshot): VersionDifferences {
    // Component differences
    const baseComponentsMap = new Map(baseSnapshot.components.map(c => [c.id, c]));
    const compareComponentsMap = new Map(compareSnapshot.components.map(c => [c.id, c]));

    const componentsAdded = compareSnapshot.components.filter(c => !baseComponentsMap.has(c.id));
    const componentsRemoved = baseSnapshot.components.filter(c => !compareComponentsMap.has(c.id));
    const componentsModified: ComponentDiff[] = [];

    for (const [id, compareComponent] of compareComponentsMap) {
      const baseComponent = baseComponentsMap.get(id);
      if (baseComponent) {
        const changes: ComponentDiff['changes'] = {};
        
        if (JSON.stringify(baseComponent.position) !== JSON.stringify(compareComponent.position)) {
          changes.position = { from: baseComponent.position, to: compareComponent.position };
        }
        
        if (JSON.stringify(baseComponent.configuration) !== JSON.stringify(compareComponent.configuration)) {
          changes.configuration = { from: baseComponent.configuration, to: compareComponent.configuration };
        }
        
        if (JSON.stringify(baseComponent.metadata) !== JSON.stringify(compareComponent.metadata)) {
          changes.metadata = { from: baseComponent.metadata, to: compareComponent.metadata };
        }

        if (Object.keys(changes).length > 0) {
          componentsModified.push({ id, changes });
        }
      }
    }

    // Connection differences
    const baseConnectionsMap = new Map(baseSnapshot.connections.map(c => [c.id, c]));
    const compareConnectionsMap = new Map(compareSnapshot.connections.map(c => [c.id, c]));

    const connectionsAdded = compareSnapshot.connections.filter(c => !baseConnectionsMap.has(c.id));
    const connectionsRemoved = baseSnapshot.connections.filter(c => !compareConnectionsMap.has(c.id));
    const connectionsModified: ConnectionDiff[] = [];

    for (const [id, compareConnection] of compareConnectionsMap) {
      const baseConnection = baseConnectionsMap.get(id);
      if (baseConnection) {
        const changes: ConnectionDiff['changes'] = {};
        
        if (JSON.stringify(baseConnection.configuration) !== JSON.stringify(compareConnection.configuration)) {
          changes.configuration = { from: baseConnection.configuration, to: compareConnection.configuration };
        }

        if (Object.keys(changes).length > 0) {
          connectionsModified.push({ id, changes });
        }
      }
    }

    // Configuration differences
    const configurationChanged = JSON.stringify(baseSnapshot.configuration) !== JSON.stringify(compareSnapshot.configuration);

    return {
      components: {
        added: componentsAdded,
        modified: componentsModified,
        removed: componentsRemoved
      },
      connections: {
        added: connectionsAdded,
        modified: connectionsModified,
        removed: connectionsRemoved
      },
      configuration: {
        changed: configurationChanged,
        differences: configurationChanged ? {
          from: baseSnapshot.configuration,
          to: compareSnapshot.configuration
        } : null
      }
    };
  }

  /**
   * Generate comparison summary
   */
  private generateComparisonSummary(differences: VersionDifferences): string {
    const parts: string[] = [];

    if (differences.components.added.length > 0) {
      parts.push(`${differences.components.added.length} component(s) added`);
    }

    if (differences.components.modified.length > 0) {
      parts.push(`${differences.components.modified.length} component(s) modified`);
    }

    if (differences.components.removed.length > 0) {
      parts.push(`${differences.components.removed.length} component(s) removed`);
    }

    if (differences.connections.added.length > 0) {
      parts.push(`${differences.connections.added.length} connection(s) added`);
    }

    if (differences.connections.modified.length > 0) {
      parts.push(`${differences.connections.modified.length} connection(s) modified`);
    }

    if (differences.connections.removed.length > 0) {
      parts.push(`${differences.connections.removed.length} connection(s) removed`);
    }

    if (differences.configuration.changed) {
      parts.push('configuration updated');
    }

    if (parts.length === 0) {
      return 'No changes detected';
    }

    return parts.join(', ');
  }

  /**
   * Build workspace from database row
   */
  private async buildWorkspaceFromDb(workspaceRow: any): Promise<Workspace> {
    if (!this.db) {
      throw new Error('Database connection required');
    }

    const client = await this.db.connect();

    try {
      // Get components
      const componentsResult = await client.query(
        'SELECT * FROM components WHERE workspace_id = $1 ORDER BY created_at',
        [workspaceRow.id]
      );

      // Get connections
      const connectionsResult = await client.query(
        'SELECT * FROM connections WHERE workspace_id = $1 ORDER BY created_at',
        [workspaceRow.id]
      );

      const components = componentsResult.rows.map(row => ({
        id: row.id,
        type: row.type,
        position: row.position,
        configuration: row.configuration,
        metadata: row.metadata
      }));

      const connections = connectionsResult.rows.map(row => ({
        id: row.id,
        sourceComponentId: row.source_component_id,
        targetComponentId: row.target_component_id,
        sourcePort: row.source_port,
        targetPort: row.target_port,
        configuration: row.configuration
      }));

      return {
        id: workspaceRow.id,
        name: workspaceRow.name,
        description: workspaceRow.description,
        userId: workspaceRow.user_id,
        components,
        connections,
        configuration: workspaceRow.configuration,
        createdAt: workspaceRow.created_at,
        updatedAt: workspaceRow.updated_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to WorkspaceVersion object
   */
  private mapVersionFromDb(row: any, excludeSnapshot: boolean = false): WorkspaceVersion {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      versionNumber: row.version_number,
      name: row.name,
      description: row.description,
      snapshot: excludeSnapshot ? { components: [], connections: [], configuration: {} } : row.snapshot,
      changesSummary: row.changes_summary,
      createdAt: row.created_at,
      createdBy: row.created_by,
      parentVersionId: row.parent_version_id,
      branchName: row.branch_name,
      tags: row.tags || []
    };
  }
}