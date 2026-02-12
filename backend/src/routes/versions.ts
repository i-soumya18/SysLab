/**
 * Version Management API Routes
 * Handles workspace versioning and history tracking per SRS FR-1.3
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { VersionService } from '../services/versionService';

const router = Router();
let versionService: VersionService;

// Lazy initialize the service
function getVersionService(): VersionService {
  if (!versionService) {
    versionService = new VersionService();
  }
  return versionService;
}

// Validation schemas
const CreateVersionRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  createdBy: z.string().min(1),
  performanceMetrics: z.any().optional()
});

const VersionListOptionsSchema = z.object({
  workspaceId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  includeMetrics: z.coerce.boolean().default(false)
});

/**
 * POST /api/v1/versions
 * Create a new workspace version
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestData = CreateVersionRequestSchema.parse(req.body);
    
    const version = await getVersionService().createVersion(requestData);
    
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
          message: 'Invalid version data',
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
 * GET /api/v1/versions
 * Get workspace versions with pagination
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const options = VersionListOptionsSchema.parse(req.query);
    
    const versions = await getVersionService().getVersions(options);
    
    res.json({
      success: true,
      data: versions,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: versions.length === options.limit
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

    console.error('Error getting versions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get versions',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * GET /api/v1/versions/:id
 * Get specific version by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
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

    const version = await getVersionService().getVersionById(id);
    
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
 * POST /api/v1/versions/compare
 * Compare performance between two versions
 */
router.post('/compare', async (req: Request, res: Response): Promise<void> => {
  try {
    const { baselineVersionId, comparisonVersionId } = req.body;

    if (!baselineVersionId || !comparisonVersionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_VERSION_IDS',
          message: 'Both baselineVersionId and comparisonVersionId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Validate UUID formats
    if (!z.string().uuid().safeParse(baselineVersionId).success || 
        !z.string().uuid().safeParse(comparisonVersionId).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VERSION_IDS',
          message: 'Invalid version ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const comparison = await getVersionService().compareVersions(baselineVersionId, comparisonVersionId);
    
    res.json({
      success: true,
      data: comparison,
      message: 'Version comparison completed'
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
 * GET /api/v1/workspaces/:workspaceId/versions
 * Get all versions for a specific workspace
 */
router.get('/workspaces/:workspaceId/versions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { limit, offset, includeMetrics } = req.query;

    // Validate UUID format
    if (!z.string().uuid().safeParse(workspaceId).success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WORKSPACE_ID',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const options = VersionListOptionsSchema.parse({
      workspaceId,
      limit,
      offset,
      includeMetrics
    });
    
    const versions = await getVersionService().getVersions(options);
    
    res.json({
      success: true,
      data: versions,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: versions.length === options.limit
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

    console.error('Error getting workspace versions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get workspace versions',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;