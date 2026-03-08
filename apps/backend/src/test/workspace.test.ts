/**
 * Workspace Service Tests
 * Tests for workspace CRUD operations and export/import functionality
 */

import { describe, it, expect } from 'vitest';
import { WorkspaceService } from '../services/workspaceService';
import { v4 as uuidv4 } from 'uuid';

describe('Workspace Service', () => {
  let workspaceService: WorkspaceService;

  // Test validation functionality without database
  describe('Export/Import Validation', () => {
    it('should validate import data correctly', async () => {
      workspaceService = new WorkspaceService(false); // Don't require database
      
      const validExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        workspace: {
          name: 'Valid Workspace',
          description: 'Valid description',
          components: [{
            id: uuidv4(),
            type: 'database' as const,
            position: { x: 100, y: 200 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Test DB', version: '1.0.0' }
          }],
          connections: [],
          configuration: {
            duration: 300,
            loadPattern: { type: 'constant' as const, baseLoad: 100 },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency']
            }
          }
        },
        metadata: {
          originalWorkspaceId: uuidv4(),
          componentCount: 1,
          connectionCount: 0
        }
      };

      const validation = await workspaceService.validateWorkspaceImport(validExportData);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.summary.componentCount).toBe(1);
    });

    it('should detect invalid workspace name', async () => {
      workspaceService = new WorkspaceService(false); // Don't require database
      
      const invalidExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        workspace: {
          name: '', // Invalid empty name
          components: [],
          connections: [],
          configuration: {
            duration: 300,
            loadPattern: { type: 'constant' as const, baseLoad: 100 },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency']
            }
          }
        },
        metadata: {
          originalWorkspaceId: uuidv4(),
          componentCount: 0,
          connectionCount: 0
        }
      };

      const validation = await workspaceService.validateWorkspaceImport(invalidExportData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Workspace name is required');
    });

    it('should detect unsupported component types', async () => {
      workspaceService = new WorkspaceService(false); // Don't require database
      
      const invalidExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        workspace: {
          name: 'Test Workspace',
          components: [{
            id: uuidv4(),
            type: 'unsupported-type' as any,
            position: { x: 100, y: 200 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Test Component', version: '1.0.0' }
          }],
          connections: [],
          configuration: {
            duration: 300,
            loadPattern: { type: 'constant' as const, baseLoad: 100 },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency']
            }
          }
        },
        metadata: {
          originalWorkspaceId: uuidv4(),
          componentCount: 1,
          connectionCount: 0
        }
      };

      const validation = await workspaceService.validateWorkspaceImport(invalidExportData);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings.some(w => w.includes('Unsupported component type'))).toBe(true);
      expect(validation.summary.unsupportedComponents).toContain('unsupported-type');
    });

    it('should detect missing connections', async () => {
      workspaceService = new WorkspaceService(false); // Don't require database
      
      const componentId = uuidv4();
      const missingComponentId = uuidv4();
      
      const invalidExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        workspace: {
          name: 'Test Workspace',
          components: [{
            id: componentId,
            type: 'database' as const,
            position: { x: 100, y: 200 },
            configuration: { capacity: 1000, latency: 10, failureRate: 0.01 },
            metadata: { name: 'Test DB', version: '1.0.0' }
          }],
          connections: [{
            id: uuidv4(),
            sourceComponentId: componentId,
            targetComponentId: missingComponentId, // This component doesn't exist
            sourcePort: 'out',
            targetPort: 'in',
            configuration: {
              bandwidth: 1000,
              latency: 5,
              protocol: 'HTTP' as const,
              reliability: 0.99
            }
          }],
          configuration: {
            duration: 300,
            loadPattern: { type: 'constant' as const, baseLoad: 100 },
            failureScenarios: [],
            metricsCollection: {
              collectionInterval: 1000,
              retentionPeriod: 3600,
              enabledMetrics: ['latency']
            }
          }
        },
        metadata: {
          originalWorkspaceId: uuidv4(),
          componentCount: 1,
          connectionCount: 1
        }
      };

      const validation = await workspaceService.validateWorkspaceImport(invalidExportData);

      expect(validation.isValid).toBe(false);
      expect(validation.summary.missingConnections.length).toBeGreaterThan(0);
    });
  });
});