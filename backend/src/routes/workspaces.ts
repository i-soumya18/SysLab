import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WorkspaceService, WorkspaceImportRequest } from '../services/workspaceService';
import { SharingService } from '../services/sharingService';
import { VersionHistoryService } from '../services/versionHistoryService';
import { WorkspaceSchema, ComponentSchema, ConnectionSchema } from '../types/validation';
import { authenticateToken } from '../middleware/auth';
import { subscriptionMiddleware } from '../middleware/subscriptionMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';

const router = Router();
let workspaceService: WorkspaceService;
let sharingService: SharingService;
let versionHistoryService: VersionHistoryService;

// Lazy initialize the services
function getWorkspaceService(): WorkspaceService {
  if (!workspaceService) {
    workspaceService = new WorkspaceService();
  }
  return workspaceService;
}

function getSharingService(): SharingService {
  if (!sharingService) {
    sharingService = new SharingService();
  }
  return sharingService;
}

function getVersionHistoryService(): VersionHistoryService {
  if (!versionHistoryService) {
    versionHistoryService = new VersionHistoryService();
  }
  return versionHistoryService;
}

// Validation schemas for requests
const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().min(1),
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
  userId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const WorkspaceImportRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  userId: z.string().min(1),
  exportData: z.any(), // Required field
  validateOnly: z.boolean().default(false)
});

const CreateShareRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  sharedBy: z.string().min(1),
  permissionLevel: z.enum(['view', 'edit', 'admin']).default('view'),
  expiresIn: z.number().positive().optional(),
  isPublic: z.boolean().default(false)
});

const InviteCollaboratorRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().min(1),
  invitedBy: z.string().min(1),
  permissionLevel: z.enum(['view', 'edit', 'admin']).default('view')
});

const UpdateCollaboratorRequestSchema = z.object({
  permissionLevel: z.enum(['view', 'edit', 'admin']).optional(),
  status: z.enum(['accepted', 'declined', 'revoked']).optional()
});

const CreateVersionRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  createdBy: z.string().min(1),
  branchName: z.string().min(1).max(100).optional(),
  tags: z.array(z.string()).optional()
});

const RollbackRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  targetVersionId: z.string().uuid(),
  userId: z.string().min(1),
  createBackupVersion: z.boolean().default(true)
});

const BranchRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  sourceVersionId: z.string().uuid(),
  branchName: z.string().min(1).max(100),
  createdBy: z.string().min(1)
});

const VersionHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  branchName: z.string().optional(),
  includeSnapshots: z.coerce.boolean().default(false)
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
 * Create a new workspace.
 *
 * NOTE: In the current setup the frontend uses Firebase Auth while the backend
 * uses its own JWT/session model. Until those are unified, this endpoint
 * accepts the `userId` from the request body without requiring backend JWT
 * authentication so that logged-in Firebase users can create workspaces.
 */
router.post('/',
  createAuditMiddleware({ action: 'WORKSPACE_CREATE' }),
  async (req: Request, res: Response): Promise<void> => {
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

/**
 * POST /api/v1/workspaces/:id/share
 * Create a shareable link for a workspace
 */
router.post('/:id/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

    const requestData = CreateShareRequestSchema.parse({
      ...req.body,
      workspaceId: id
    });
    
    const share = await getSharingService().createShare(requestData);
    
    // Generate shareable URL
    const shareUrl = `${req.protocol}://${req.get('host')}/shared/workspaces/${share.shareToken}`;
    
    res.status(201).json({
      success: true,
      data: {
        ...share,
        shareUrl
      },
      message: 'Share created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid share request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error creating share:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create share',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/:id/shares
 * Get all shares for a workspace
 */
router.get('/:id/shares', async (req: Request, res: Response): Promise<void> => {
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

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const shares = await getSharingService().getWorkspaceShares(id, userId);
    
    res.json({
      success: true,
      data: shares
    });
  } catch (error) {
    console.error('Error getting workspace shares:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get workspace shares',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * DELETE /api/v1/workspaces/shares/:shareId
 * Revoke a workspace share
 */
router.delete('/shares/:shareId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shareId } = req.params;
    const userId = req.query.userId as string;

    // Validate UUID format
    if (!z.string().uuid().safeParse(shareId).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid share ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const revoked = await getSharingService().revokeShare(shareId, userId);
    
    if (!revoked) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SHARE_NOT_FOUND',
          message: 'Share not found or access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Share revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke share',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces/:id/collaborators
 * Invite a collaborator to a workspace
 */
router.post('/:id/collaborators', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

    const requestData = InviteCollaboratorRequestSchema.parse({
      ...req.body,
      workspaceId: id
    });
    
    const collaborator = await getSharingService().inviteCollaborator(requestData);
    
    res.status(201).json({
      success: true,
      data: collaborator,
      message: 'Collaborator invited successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid collaborator invitation data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error inviting collaborator:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to invite collaborator',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/:id/collaborators
 * Get all collaborators for a workspace
 */
router.get('/:id/collaborators', async (req: Request, res: Response): Promise<void> => {
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

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const collaborators = await getSharingService().getWorkspaceCollaborators(id, userId);
    
    res.json({
      success: true,
      data: collaborators
    });
  } catch (error) {
    console.error('Error getting workspace collaborators:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get workspace collaborators',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * PUT /api/v1/workspaces/:id/collaborators/:userId
 * Update collaborator permissions or status
 */
router.put('/:id/collaborators/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const updatedBy = req.query.updatedBy as string;

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

    if (!updatedBy) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_UPDATED_BY',
          message: 'updatedBy parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const requestData = UpdateCollaboratorRequestSchema.parse(req.body);
    
    const collaborator = await getSharingService().updateCollaborator(id, userId, requestData, updatedBy);
    
    if (!collaborator) {
      res.status(404).json({
        success: false,
        error: {
          code: 'COLLABORATOR_NOT_FOUND',
          message: 'Collaborator not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: collaborator,
      message: 'Collaborator updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid collaborator update data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error updating collaborator:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update collaborator',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * DELETE /api/v1/workspaces/:id/collaborators/:userId
 * Remove a collaborator from a workspace
 */
router.delete('/:id/collaborators/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const removedBy = req.query.removedBy as string;

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

    if (!removedBy) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REMOVED_BY',
          message: 'removedBy parameter is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const removed = await getSharingService().removeCollaborator(id, userId, removedBy);
    
    if (!removed) {
      res.status(404).json({
        success: false,
        error: {
          code: 'COLLABORATOR_NOT_FOUND',
          message: 'Collaborator not found or access denied',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove collaborator',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/shared/workspaces/:shareToken
 * Access a shared workspace via share token
 */
router.get('/shared/:shareToken', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shareToken } = req.params;
    const accessorUserId = req.query.userId as string;

    const shareInfo = await getSharingService().getWorkspaceByShareToken(shareToken, accessorUserId);
    
    if (!shareInfo.hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: shareInfo.accessDeniedReason || 'Access denied to shared workspace',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        workspace: shareInfo.workspace,
        share: shareInfo.share
      }
    });
  } catch (error) {
    console.error('Error accessing shared workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to access shared workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces/:id/versions
 * Create a new version of the workspace
 */
router.post('/:id/versions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

    const requestData = CreateVersionRequestSchema.parse({
      ...req.body,
      workspaceId: id
    });

    // Get current workspace
    const workspace = await getWorkspaceService().getWorkspaceById(id, requestData.createdBy);
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

    const version = await getVersionHistoryService().createVersion(requestData, workspace);
    
    res.status(201).json({
      success: true,
      data: version,
      message: 'Version created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid version creation data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error creating version:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create version',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/:id/versions
 * Get version history for a workspace
 */
router.get('/:id/versions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

    const query = VersionHistoryQuerySchema.parse(req.query);
    
    const result = await getVersionHistoryService().getVersionHistory(id, query);
    
    res.json({
      success: true,
      data: result.versions,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < result.total
      },
      branches: result.branches
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

    console.error('Error getting version history:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get version history',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/versions/:versionId
 * Get a specific version by ID
 */
router.get('/versions/:versionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { versionId } = req.params;
    
    // Validate UUID format
    if (!z.string().uuid().safeParse(versionId).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid version ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const version = await getVersionHistoryService().getVersionById(versionId);
    
    if (!version) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'Version not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get version',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces/:id/rollback
 * Rollback workspace to a specific version
 */
router.post('/:id/rollback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

    const requestData = RollbackRequestSchema.parse({
      ...req.body,
      workspaceId: id
    });

    const workspace = await getVersionHistoryService().rollbackToVersion(requestData);
    
    res.json({
      success: true,
      data: workspace,
      message: 'Workspace rolled back successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rollback request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error rolling back workspace:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to rollback workspace',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * POST /api/v1/workspaces/:id/branches
 * Create a branch from a specific version
 */
router.post('/:id/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

    const requestData = BranchRequestSchema.parse({
      ...req.body,
      workspaceId: id
    });

    const branch = await getVersionHistoryService().createBranch(requestData);
    
    res.status(201).json({
      success: true,
      data: branch,
      message: 'Branch created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid branch creation data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    console.error('Error creating branch:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create branch',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/workspaces/versions/:baseVersionId/compare/:compareVersionId
 * Compare two versions
 */
router.get('/versions/:baseVersionId/compare/:compareVersionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { baseVersionId, compareVersionId } = req.params;
    
    // Validate UUID formats
    if (!z.string().uuid().safeParse(baseVersionId).success || !z.string().uuid().safeParse(compareVersionId).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid version ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const comparison = await getVersionHistoryService().compareVersions(baseVersionId, compareVersionId);
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing versions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to compare versions',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * DELETE /api/v1/workspaces/versions/:versionId
 * Delete a version
 */
router.delete('/versions/:versionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { versionId } = req.params;
    const userId = req.query.userId as string;
    
    // Validate UUID format
    if (!z.string().uuid().safeParse(versionId).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid version ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const deleted = await getVersionHistoryService().deleteVersion(versionId, userId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'Version not found or already deleted',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete version',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;