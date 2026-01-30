/**
 * Workspace API Service Tests
 * Tests for workspace export/import functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceApiService } from '../services/workspaceApi';

// Mock fetch globally
global.fetch = vi.fn();

describe('WorkspaceApiService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseExportFile', () => {
    it('should parse valid export file content', () => {
      const validExportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        workspace: {
          name: 'Test Workspace',
          description: 'Test description',
          components: [],
          connections: [],
          configuration: {}
        },
        metadata: {
          originalWorkspaceId: 'test-id',
          componentCount: 0,
          connectionCount: 0
        }
      };

      const result = WorkspaceApiService.parseExportFile(JSON.stringify(validExportData));
      
      expect(result).toEqual(validExportData);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        WorkspaceApiService.parseExportFile('invalid json');
      }).toThrow('Invalid JSON file format');
    });

    it('should throw error for missing workspace data', () => {
      const invalidData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z'
        // Missing workspace property
      };

      expect(() => {
        WorkspaceApiService.parseExportFile(JSON.stringify(invalidData));
      }).toThrow('Invalid export file format');
    });
  });

  describe('readFileContent', () => {
    it('should read file content successfully', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
      
      const result = await WorkspaceApiService.readFileContent(mockFile);
      
      expect(result).toBe('{"test": "data"}');
    });
  });

  describe('exportWorkspace', () => {
    it('should export workspace successfully', async () => {
      const mockExportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        workspace: {
          name: 'Test Workspace',
          components: [],
          connections: [],
          configuration: {}
        },
        metadata: {
          originalWorkspaceId: 'test-id',
          componentCount: 0,
          connectionCount: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExportData
      });

      const result = await WorkspaceApiService.exportWorkspace('test-id', 'user-id');
      
      expect(result).toEqual(mockExportData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces/test-id/export'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle export error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Workspace not found' }
        })
      });

      await expect(
        WorkspaceApiService.exportWorkspace('invalid-id')
      ).rejects.toThrow('Workspace not found');
    });
  });

  describe('validateWorkspaceImport', () => {
    it('should validate import data successfully', async () => {
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
        summary: {
          componentCount: 0,
          connectionCount: 0,
          unsupportedComponents: [],
          missingConnections: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ validation: mockValidation })
      });

      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        workspace: {
          name: 'Test Workspace',
          components: [],
          connections: [],
          configuration: {}
        },
        metadata: {
          originalWorkspaceId: 'test-id',
          componentCount: 0,
          connectionCount: 0
        }
      };

      const result = await WorkspaceApiService.validateWorkspaceImport(exportData);
      
      expect(result).toEqual(mockValidation);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workspaces/validate-import'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ exportData })
        })
      );
    });
  });

  describe('importWorkspace', () => {
    it('should import workspace successfully', async () => {
      const mockWorkspace = {
        id: 'new-workspace-id',
        name: 'Imported Workspace',
        components: [],
        connections: []
      };

      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
        summary: {
          componentCount: 0,
          connectionCount: 0,
          unsupportedComponents: [],
          missingConnections: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockWorkspace,
          validation: mockValidation
        })
      });

      const importRequest = {
        name: 'Imported Workspace',
        userId: 'user-id',
        exportData: {
          version: '1.0.0',
          exportedAt: '2024-01-01T00:00:00.000Z',
          workspace: {
            name: 'Test Workspace',
            components: [],
            connections: [],
            configuration: {}
          },
          metadata: {
            originalWorkspaceId: 'test-id',
            componentCount: 0,
            connectionCount: 0
          }
        }
      };

      const result = await WorkspaceApiService.importWorkspace(importRequest);
      
      expect(result.workspace).toEqual(mockWorkspace);
      expect(result.validation).toEqual(mockValidation);
    });
  });
});