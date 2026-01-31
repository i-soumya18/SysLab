import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WorkspaceService, WorkspaceImportRequest } from '../services/workspaceService';
import { WorkspaceSchema, ComponentSchema, ConnectionSchema } from '../types/validation';

const router = Router();
let workspaceService: WorkspaceService;

// Lazy initialize the service
function getWorkspaceService(): WorkspaceService {
  if (!workspaceService) {
    workspaceService = new WorkspaceService();
  }
  return workspaceService;
}

// Validation schemas for requests
const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().uuid(),
  components: z.array(ComponentSchema).optional(),
  connections: z.array(ConnectionSchema).optional(),
  configuration: z.any().optional()
});

const UpdateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  components: z.array(ComponentSchema).optional(),
  connections: z.array(ConnectionSchema).optional(),
  configuration: z.any().optional()
});

const WorkspaceSearchQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const WorkspaceImportRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  userId: z.string().uuid(),
  exportData: z.any(), // Required field
  validateOnly: z.boolean().default(false)
});

/**
 * GET /api/v1/workspaces
 * List workspaces with search and pagination
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = WorkspaceSearchQuerySchema.parse(req.query);
    
    const result = await getWorkspaceService().listWorkspaces(query);
    
    res.json({
      success: true,
      data: result.workspaces,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error listing workspaces:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list workspaces',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces
 * Create a new workspace
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestData = CreateWorkspaceRequestSchema.parse(req.body);
    
    const workspace = await getWorkspaceService().createWorkspace(requestData);
    
    res.status(201).json({
      success: true,
      data: workspace
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid workspace data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error creating workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/:id
 * Get workspace by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const workspace = await getWorkspaceService().getWorkspaceById(id, userId);
    
    if (!workspace) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    console.error('Error getting workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * PUT /api/v1/workspaces/:id
 * Update workspace
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const requestData = UpdateWorkspaceRequestSchema.parse(req.body);
    
    const workspace = await getWorkspaceService().updateWorkspace(id, requestData, userId);
    
    if (!workspace) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found or access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid workspace data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error updating workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * DELETE /api/v1/workspaces/:id
 * Delete workspace
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const deleted = await getWorkspaceService().deleteWorkspace(id, userId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found or access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/:id/export
 * Export workspace to shareable format
 */
router.get('/:id/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;
    const exportedBy = req.query.exportedBy as string;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const exportData = await getWorkspaceService().exportWorkspace(id, userId, exportedBy);
    
    if (!exportData) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found or access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Set appropriate headers for file download
    const filename = `${exportData.workspace.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces/import
 * Import workspace from export format
 */
router.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestData = WorkspaceImportRequestSchema.parse(req.body);
    
    // Type assertion since Zod validation ensures exportData is present
    const result = await getWorkspaceService().importWorkspace(requestData as WorkspaceImportRequest);
    
    if (requestData.validateOnly) {
      res.json({
        success: true,
        validation: result.validation,
        message: 'Validation completed'
      });
      return;
    }

    if (!result.validation.isValid) {
      res.status(400).json({
        success: false,
        validation: result.validation,
        error: {
          code: 'IMPORT_VALIDATION_FAILED',
          message: 'Import validation failed',
          details: result.validation.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: result.workspace,
      validation: result.validation,
      message: 'Workspace imported successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid import request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error importing workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to import workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces/validate-import
 * Validate workspace import data without creating workspace
 */
router.post('/validate-import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { exportData } = req.body;
    
    if (!exportData) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EXPORT_DATA',
          message: 'Export data is required for validation',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const validation = await getWorkspaceService().validateWorkspaceImport(exportData);
    
    res.json({
      success: true,
      validation,
      message: 'Validation completed'
    });
  } catch (error) {
    console.error('Error validating import:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate import data',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;