/**
 * Workspace API Service
 * Handles all workspace-related API calls including export/import functionality
 */

export interface WorkspaceExportFormat {
  version: string;
  exportedAt: string;
  workspace: {
    name: string;
    description?: string;
    components: any[];
    connections: any[];
    configuration: any;
  };
  metadata: {
    exportedBy?: string;
    originalWorkspaceId: string;
    componentCount: number;
    connectionCount: number;
  };
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

export interface WorkspaceImportRequest {
  name?: string;
  description?: string;
  userId: string;
  exportData: WorkspaceExportFormat;
  validateOnly?: boolean;
}

export interface WorkspaceImportResult {
  workspace?: any;
  validation: WorkspaceImportValidation;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

export class WorkspaceApiService {
  /**
   * Export workspace to downloadable format
   */
  static async exportWorkspace(
    workspaceId: string, 
    userId?: string, 
    exportedBy?: string
  ): Promise<WorkspaceExportFormat> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (exportedBy) params.append('exportedBy', exportedBy);

    const response = await fetch(
      `${API_BASE_URL}/workspaces/${workspaceId}/export?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to export workspace');
    }

    return await response.json();
  }

  /**
   * Download workspace export as JSON file
   */
  static async downloadWorkspaceExport(
    workspaceId: string, 
    userId?: string, 
    exportedBy?: string
  ): Promise<void> {
    const exportData = await this.exportWorkspace(workspaceId, userId, exportedBy);
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportData.workspace.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Validate workspace import data
   */
  static async validateWorkspaceImport(exportData: WorkspaceExportFormat): Promise<WorkspaceImportValidation> {
    const response = await fetch(`${API_BASE_URL}/workspaces/validate-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ exportData }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to validate import data');
    }

    const result = await response.json();
    return result.validation;
  }

  /**
   * Import workspace from export data
   */
  static async importWorkspace(request: WorkspaceImportRequest): Promise<WorkspaceImportResult> {
    const response = await fetch(`${API_BASE_URL}/workspaces/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to import workspace');
    }

    const result = await response.json();
    return {
      workspace: result.data,
      validation: result.validation
    };
  }

  /**
   * Parse JSON file content as workspace export data
   */
  static parseExportFile(fileContent: string): WorkspaceExportFormat {
    try {
      const data = JSON.parse(fileContent);
      
      // Basic validation of export format
      if (!data.version || !data.workspace) {
        throw new Error('Invalid export file format');
      }
      
      return data as WorkspaceExportFormat;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON file format');
      }
      throw error;
    }
  }

  /**
   * Read file content from File object
   */
  static readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  }
}