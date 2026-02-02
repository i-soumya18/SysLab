/**
 * Version API Service
 * Handles all version-related API calls for workspace versioning and history tracking
 */

export interface WorkspaceVersion {
  id: string;
  workspaceId: string;
  versionNumber: number;
  name: string;
  description?: string;
  snapshot: {
    components: any[];
    connections: any[];
    configuration: any;
  };
  performanceMetrics?: any;
  createdAt: string;
  createdBy: string;
}

export interface CreateVersionRequest {
  workspaceId: string;
  name: string;
  description?: string;
  createdBy: string;
  performanceMetrics?: any;
}

export interface VersionListOptions {
  workspaceId: string;
  limit?: number;
  offset?: number;
  includeMetrics?: boolean;
}

export interface PerformanceComparison {
  baselineVersion: WorkspaceVersion;
  comparisonVersion: WorkspaceVersion;
  overallImprovement: {
    latencyChange: number;
    throughputChange: number;
    errorRateChange: number;
    resourceEfficiencyChange: number;
  };
  componentComparisons: any[];
  bottleneckAnalysis: {
    resolved: any[];
    introduced: any[];
    persisting: any[];
  };
  recommendations: string[];
  summary: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

export class VersionApiService {
  /**
   * Create a new workspace version
   */
  static async createVersion(request: CreateVersionRequest): Promise<WorkspaceVersion> {
    const response = await fetch(`${API_BASE_URL}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to create version');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get workspace versions with pagination
   */
  static async getVersions(options: VersionListOptions): Promise<{
    versions: WorkspaceVersion[];
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();
    params.append('workspaceId', options.workspaceId);
    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.includeMetrics !== undefined) params.append('includeMetrics', options.includeMetrics.toString());

    const response = await fetch(`${API_BASE_URL}/versions?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get versions');
    }

    const result = await response.json();
    return {
      versions: result.data,
      pagination: result.pagination
    };
  }

  /**
   * Get all versions for a specific workspace
   */
  static async getWorkspaceVersions(
    workspaceId: string, 
    options: { limit?: number; offset?: number; includeMetrics?: boolean } = {}
  ): Promise<{
    versions: WorkspaceVersion[];
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.includeMetrics !== undefined) params.append('includeMetrics', options.includeMetrics.toString());

    const response = await fetch(
      `${API_BASE_URL}/workspaces/${workspaceId}/versions?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get workspace versions');
    }

    const result = await response.json();
    return {
      versions: result.data,
      pagination: result.pagination
    };
  }

  /**
   * Get specific version by ID
   */
  static async getVersionById(versionId: string): Promise<WorkspaceVersion> {
    const response = await fetch(`${API_BASE_URL}/versions/${versionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get version');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Compare performance between two versions
   */
  static async compareVersions(
    baselineVersionId: string, 
    comparisonVersionId: string
  ): Promise<PerformanceComparison> {
    const response = await fetch(`${API_BASE_URL}/versions/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        baselineVersionId,
        comparisonVersionId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to compare versions');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Restore workspace to a specific version
   */
  static async restoreToVersion(workspaceId: string, versionId: string, userId: string): Promise<any> {
    // Get the version data
    const version = await this.getVersionById(versionId);
    
    // Create a new workspace with the version's snapshot data
    const restoreRequest = {
      name: `${version.name} (Restored)`,
      description: `Restored from version ${version.versionNumber} on ${new Date().toISOString()}`,
      userId: userId,
      components: version.snapshot.components,
      connections: version.snapshot.connections,
      configuration: version.snapshot.configuration
    };

    const response = await fetch(`${API_BASE_URL}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restoreRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to restore workspace from version');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get version history summary for a workspace
   */
  static async getVersionHistory(workspaceId: string): Promise<{
    totalVersions: number;
    latestVersion: WorkspaceVersion | null;
    recentVersions: WorkspaceVersion[];
  }> {
    const { versions } = await this.getWorkspaceVersions(workspaceId, { limit: 5, includeMetrics: false });
    
    return {
      totalVersions: versions.length,
      latestVersion: versions.length > 0 ? versions[0] : null,
      recentVersions: versions
    };
  }

  /**
   * Create version from current workspace state
   */
  static async createVersionFromWorkspace(
    workspaceId: string, 
    versionName: string, 
    createdBy: string,
    description?: string,
    performanceMetrics?: any
  ): Promise<WorkspaceVersion> {
    return this.createVersion({
      workspaceId,
      name: versionName,
      description,
      createdBy,
      performanceMetrics
    });
  }
}