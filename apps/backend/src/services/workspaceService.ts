/**
 * Workspace Service Layer
 * Handles business logic for workspace CRUD operations
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database';
import { Workspace, Component, Connection } from '../types';
import { WorkspaceSchema, ComponentSchema, ConnectionSchema } from '../types/validation';

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  userId: string;
  components?: Component[];
  connections?: Connection[];
  configuration?: any;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  components?: Component[];
  connections?: Connection[];
  configuration?: any;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  description?: string;
  userId: string;
  componentCount: number;
  connectionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceSearchOptions {
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface WorkspaceExportFormat {
  version: string;
  exportedAt: string;
  workspace: {
    name: string;
    description?: string;
    components: Component[];
    connections: Connection[];
    configuration: any;
  };
  metadata: {
    exportedBy?: string;
    originalWorkspaceId: string;
    componentCount: number;
    connectionCount: number;
  };
}

export interface WorkspaceImportRequest {
  name?: string;
  description?: string;
  userId: string;
  exportData: WorkspaceExportFormat;
  validateOnly?: boolean;
}

export interface WorkspaceImportValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    componentCount: number;
    connectionCount: number;
    unsupportedComponents: string[];
    missingConnections: string[];
  };
}

export class WorkspaceService {
  private db: Pool | null = null;

  constructor(requireDatabase: boolean = true) {
    if (requireDatabase) {
      this.db = getDatabase();
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }
    
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const workspaceId = uuidv4();
      const now = new Date();

      // Default simulation configuration
      const defaultConfig = {
        duration: 300, // 5 minutes
        loadPattern: {
          type: 'constant',
          baseLoad: 100
        },
        failureScenarios: [],
        metricsCollection: {
          collectionInterval: 1000,
          retentionPeriod: 3600,
          enabledMetrics: ['latency', 'throughput', 'errorRate']
        }
      };

      // Insert workspace
      const workspaceResult = await client.query(
        `INSERT INTO workspaces (id, name, description, user_id, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          workspaceId,
          request.name,
          request.description || null,
          request.userId,
          JSON.stringify(request.configuration || defaultConfig),
          now,
          now
        ]
      );

      const workspace = workspaceResult.rows[0];
      const components: Component[] = [];
      const connections: Connection[] = [];

      // Insert components if provided
      if (request.components && request.components.length > 0) {
        for (const component of request.components) {
          const componentResult = await client.query(
            `INSERT INTO components (id, workspace_id, type, position, configuration, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              component.id,
              workspaceId,
              component.type,
              JSON.stringify(component.position),
              JSON.stringify(component.configuration),
              JSON.stringify(component.metadata),
              now,
              now
            ]
          );
          components.push(this.mapComponentFromDb(componentResult.rows[0]));
        }
      }

      // Insert connections if provided
      if (request.connections && request.connections.length > 0) {
        for (const connection of request.connections) {
          const connectionResult = await client.query(
            `INSERT INTO connections (id, workspace_id, source_component_id, target_component_id, source_port, target_port, configuration, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
              connection.id,
              workspaceId,
              connection.sourceComponentId,
              connection.targetComponentId,
              connection.sourcePort,
              connection.targetPort,
              JSON.stringify(connection.configuration),
              now,
              now
            ]
          );
          connections.push(this.mapConnectionFromDb(connectionResult.rows[0]));
        }
      }

      await client.query('COMMIT');

      return this.mapWorkspaceFromDb(workspace, components, connections);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get workspace by ID
   */
  async getWorkspaceById(id: string, userId?: string): Promise<Workspace | null> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }
    
    const client = await this.db.connect();
    
    try {
      // Get workspace
      let workspaceQuery = 'SELECT * FROM workspaces WHERE id = $1';
      const queryParams: any[] = [id];
      
      if (userId) {
        workspaceQuery += ' AND user_id = $2';
        queryParams.push(userId);
      }

      const workspaceResult = await client.query(workspaceQuery, queryParams);
      
      if (workspaceResult.rows.length === 0) {
        return null;
      }

      const workspace = workspaceResult.rows[0];

      // Get components
      const componentsResult = await client.query(
        'SELECT * FROM components WHERE workspace_id = $1 ORDER BY created_at',
        [id]
      );

      // Get connections
      const connectionsResult = await client.query(
        'SELECT * FROM connections WHERE workspace_id = $1 ORDER BY created_at',
        [id]
      );

      const components = componentsResult.rows.map(row => this.mapComponentFromDb(row));
      const connections = connectionsResult.rows.map(row => this.mapConnectionFromDb(row));

      return this.mapWorkspaceFromDb(workspace, components, connections);
    } finally {
      client.release();
    }
  }

  /**
   * Update workspace
   */
  async updateWorkspace(id: string, request: UpdateWorkspaceRequest, userId?: string): Promise<Workspace | null> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }
    
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if workspace exists and user has access
      let checkQuery = 'SELECT id FROM workspaces WHERE id = $1';
      const checkParams: any[] = [id];
      
      if (userId) {
        checkQuery += ' AND user_id = $2';
        checkParams.push(userId);
      }

      const existsResult = await client.query(checkQuery, checkParams);
      
      if (existsResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const now = new Date();
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      if (request.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(request.name);
      }

      if (request.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(request.description);
      }

      if (request.configuration !== undefined) {
        updateFields.push(`configuration = $${paramIndex++}`);
        updateValues.push(JSON.stringify(request.configuration));
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(now);

      updateValues.push(id);

      // Update workspace
      if (updateFields.length > 1) { // More than just updated_at
        await client.query(
          `UPDATE workspaces SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        );
      }

      // Update components if provided
      if (request.components !== undefined) {
        // Delete existing components
        await client.query('DELETE FROM components WHERE workspace_id = $1', [id]);
        
        // Insert new components
        for (const component of request.components) {
          await client.query(
            `INSERT INTO components (id, workspace_id, type, position, configuration, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              component.id,
              id,
              component.type,
              JSON.stringify(component.position),
              JSON.stringify(component.configuration),
              JSON.stringify(component.metadata),
              now,
              now
            ]
          );
        }
      }

      // Update connections if provided
      if (request.connections !== undefined) {
        // Delete existing connections
        await client.query('DELETE FROM connections WHERE workspace_id = $1', [id]);
        
        // Insert new connections
        for (const connection of request.connections) {
          await client.query(
            `INSERT INTO connections (id, workspace_id, source_component_id, target_component_id, source_port, target_port, configuration, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              connection.id,
              id,
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
      }

      await client.query('COMMIT');

      // Return updated workspace
      return await this.getWorkspaceById(id, userId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string, userId?: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }
    
    const client = await this.db.connect();
    
    try {
      let deleteQuery = 'DELETE FROM workspaces WHERE id = $1';
      const queryParams: any[] = [id];
      
      if (userId) {
        deleteQuery += ' AND user_id = $2';
        queryParams.push(userId);
      }

      const result = await client.query(deleteQuery, queryParams);
      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * List workspaces with search and pagination
   */
  async listWorkspaces(options: WorkspaceSearchOptions = {}): Promise<{
    workspaces: WorkspaceListItem[];
    total: number;
    limit: number;
    offset: number;
  }> {
    if (!this.db) {
      throw new Error('Database connection required for this operation');
    }
    
    const client = await this.db.connect();
    
    try {
      const {
        userId,
        search,
        limit = 20,
        offset = 0,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = options;

      let whereClause = '';
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Build WHERE clause
      const conditions: string[] = [];
      
      if (userId) {
        conditions.push(`w.user_id = $${paramIndex++}`);
        queryParams.push(userId);
      }

      if (search) {
        conditions.push(`(w.name ILIKE $${paramIndex++} OR w.description ILIKE $${paramIndex++})`);
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      // Build ORDER BY clause
      const validSortFields = ['name', 'createdAt', 'updatedAt'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
      const dbSortField = sortField === 'createdAt' ? 'w.created_at' : 
                         sortField === 'updatedAt' ? 'w.updated_at' : 'w.name';
      const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM workspaces w
        ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get workspaces with component and connection counts
      const workspacesQuery = `
        SELECT 
          w.*,
          COALESCE(c.component_count, 0) as component_count,
          COALESCE(conn.connection_count, 0) as connection_count
        FROM workspaces w
        LEFT JOIN (
          SELECT workspace_id, COUNT(*) as component_count
          FROM components
          GROUP BY workspace_id
        ) c ON w.id = c.workspace_id
        LEFT JOIN (
          SELECT workspace_id, COUNT(*) as connection_count
          FROM connections
          GROUP BY workspace_id
        ) conn ON w.id = conn.workspace_id
        ${whereClause}
        ORDER BY ${dbSortField} ${order}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      queryParams.push(limit, offset);
      
      const workspacesResult = await client.query(workspacesQuery, queryParams);

      const workspaces: WorkspaceListItem[] = workspacesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        userId: row.user_id,
        componentCount: parseInt(row.component_count),
        connectionCount: parseInt(row.connection_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        workspaces,
        total,
        limit,
        offset
      };
    } finally {
      client.release();
    }
  }

  /**
   * Export workspace to shareable format
   */
  async exportWorkspace(id: string, userId?: string, exportedBy?: string): Promise<WorkspaceExportFormat | null> {
    const workspace = await this.getWorkspaceById(id, userId);
    
    if (!workspace) {
      return null;
    }

    const exportFormat: WorkspaceExportFormat = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      workspace: {
        name: workspace.name,
        description: workspace.description,
        components: workspace.components,
        connections: workspace.connections,
        configuration: workspace.configuration
      },
      metadata: {
        exportedBy,
        originalWorkspaceId: workspace.id,
        componentCount: workspace.components.length,
        connectionCount: workspace.connections.length
      }
    };

    return exportFormat;
  }

  /**
   * Validate workspace import data
   */
  async validateWorkspaceImport(exportData: WorkspaceExportFormat): Promise<WorkspaceImportValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const unsupportedComponents: string[] = [];
    const missingConnections: string[] = [];

    // Validate export format version
    if (!exportData.version || exportData.version !== '1.0.0') {
      warnings.push(`Unsupported export format version: ${exportData.version}. Some features may not work correctly.`);
    }

    // Validate workspace structure
    if (!exportData.workspace) {
      errors.push('Missing workspace data in export file');
      return {
        isValid: false,
        errors,
        warnings,
        summary: {
          componentCount: 0,
          connectionCount: 0,
          unsupportedComponents,
          missingConnections
        }
      };
    }

    const { workspace } = exportData;

    // Validate workspace name
    if (!workspace.name || workspace.name.trim().length === 0) {
      errors.push('Workspace name is required');
    } else if (workspace.name.length > 100) {
      errors.push('Workspace name is too long (max 100 characters)');
    }

    // Validate description
    if (workspace.description && workspace.description.length > 500) {
      errors.push('Workspace description is too long (max 500 characters)');
    }

    // Validate components
    const componentIds = new Set<string>();
    const validComponentTypes = ['database', 'load-balancer', 'web-server', 'cache', 'message-queue', 'cdn', 'proxy'];

    if (workspace.components) {
      for (const component of workspace.components) {
        // Check for duplicate component IDs
        if (componentIds.has(component.id)) {
          errors.push(`Duplicate component ID: ${component.id}`);
        } else {
          componentIds.add(component.id);
        }

        // Validate component type
        if (!validComponentTypes.includes(component.type)) {
          unsupportedComponents.push(component.type);
          warnings.push(`Unsupported component type: ${component.type}`);
        }

        // Validate component structure
        try {
          ComponentSchema.parse(component);
        } catch (validationError: any) {
          errors.push(`Invalid component ${component.id}: ${validationError.message}`);
        }
      }
    }

    // Validate connections
    if (workspace.connections) {
      for (const connection of workspace.connections) {
        // Check if source and target components exist
        if (!componentIds.has(connection.sourceComponentId)) {
          missingConnections.push(`Connection ${connection.id} references missing source component: ${connection.sourceComponentId}`);
        }

        if (!componentIds.has(connection.targetComponentId)) {
          missingConnections.push(`Connection ${connection.id} references missing target component: ${connection.targetComponentId}`);
        }

        // Validate connection structure
        try {
          ConnectionSchema.parse(connection);
        } catch (validationError: any) {
          errors.push(`Invalid connection ${connection.id}: ${validationError.message}`);
        }
      }
    }

    // Add missing connection errors
    errors.push(...missingConnections);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        componentCount: workspace.components?.length || 0,
        connectionCount: workspace.connections?.length || 0,
        unsupportedComponents: Array.from(new Set(unsupportedComponents)),
        missingConnections
      }
    };
  }

  /**
   * Import workspace from export format
   */
  async importWorkspace(request: WorkspaceImportRequest): Promise<{ workspace?: Workspace; validation: WorkspaceImportValidation }> {
    // Validate import data
    const validation = await this.validateWorkspaceImport(request.exportData);

    // If validation only requested, return validation results
    if (request.validateOnly) {
      return { validation };
    }

    // If validation failed, don't proceed with import
    if (!validation.isValid) {
      return { validation };
    }

    const { workspace: workspaceData } = request.exportData;

    // Generate new IDs for components and connections to avoid conflicts
    const componentIdMap = new Map<string, string>();
    const newComponents: Component[] = [];

    // Process components with new IDs
    if (workspaceData.components) {
      for (const component of workspaceData.components) {
        const newId = uuidv4();
        componentIdMap.set(component.id, newId);
        
        newComponents.push({
          ...component,
          id: newId
        });
      }
    }

    // Process connections with updated component IDs
    const newConnections: Connection[] = [];
    if (workspaceData.connections) {
      for (const connection of workspaceData.connections) {
        const newSourceId = componentIdMap.get(connection.sourceComponentId);
        const newTargetId = componentIdMap.get(connection.targetComponentId);

        // Skip connections with missing components (should be caught in validation)
        if (!newSourceId || !newTargetId) {
          continue;
        }

        newConnections.push({
          ...connection,
          id: uuidv4(),
          sourceComponentId: newSourceId,
          targetComponentId: newTargetId
        });
      }
    }

    // Create workspace with imported data
    const createRequest: CreateWorkspaceRequest = {
      name: request.name || workspaceData.name,
      description: request.description || workspaceData.description,
      userId: request.userId,
      components: newComponents,
      connections: newConnections,
      configuration: workspaceData.configuration
    };

    try {
      const workspace = await this.createWorkspace(createRequest);
      return { workspace, validation };
    } catch (error: any) {
      validation.errors.push(`Failed to create workspace: ${error.message}`);
      validation.isValid = false;
      return { validation };
    }
  }

  /**
   * Map database row to Component object
   */
  private mapComponentFromDb(row: any): Component {
    return {
      id: row.id,
      type: row.type,
      position: row.position,
      configuration: row.configuration,
      metadata: row.metadata
    };
  }

  /**
   * Map database row to Connection object
   */
  private mapConnectionFromDb(row: any): Connection {
    return {
      id: row.id,
      sourceComponentId: row.source_component_id,
      targetComponentId: row.target_component_id,
      sourcePort: row.source_port,
      targetPort: row.target_port,
      configuration: row.configuration
    };
  }

  /**
   * Map database row to Workspace object
   */
  private mapWorkspaceFromDb(workspaceRow: any, components: Component[], connections: Connection[]): Workspace {
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
  }
}