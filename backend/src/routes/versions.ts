/**
 * Version Management API Routes
 * Handles workspace versioning and performance comparison endpoints
 */

import express from 'express';
import { VersionService } from '../services/versionService';
import { WorkspaceService } from '../services/workspaceService';

const router = express.Router();
const versionService = new VersionService();
const workspaceService = new WorkspaceService();

/**
 * Create a new workspace version
 * POST /api/workspaces/:workspaceId/versions
 */
router.post('/:workspaceId/versions', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, performanceMetrics } = req.body;
    const createdBy = req.headers['x-user-id'] as string || 'anonymous';

    // Validate workspace exists
    const workspace = await workspaceService.getWorkspaceById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Version name is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const version = await versionService.createVersion({
      workspaceId,
      name: name.trim(),
      description: description?.trim(),
      createdBy,
      performanceMetrics
    });

    return res.status(201).json(version);
  } catch (error: any) {
    console.error('Error creating workspace version:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create workspace version',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Get workspace versions
 * GET /api/workspaces/:workspaceId/versions
 */
router.get('/:workspaceId/versions', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { limit, offset, includeMetrics } = req.query;

    const versions = await versionService.getVersions({
      workspaceId,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      includeMetrics: includeMetrics === 'true'
    });

    res.json(versions);
  } catch (error: any) {
    console.error('Error fetching workspace versions:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch workspace versions',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Get specific version by ID
 * GET /api/versions/:versionId
 */
router.get('/versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;

    const version = await versionService.getVersionById(versionId);
    if (!version) {
      return res.status(404).json({
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'Version not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.json(version);
  } catch (error: any) {
    console.error('Error fetching version:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch version',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Compare two versions
 * POST /api/versions/compare
 */
router.post('/versions/compare', async (req, res) => {
  try {
    const { baselineVersionId, comparisonVersionId } = req.body;

    if (!baselineVersionId || !comparisonVersionId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Both baselineVersionId and comparisonVersionId are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const comparison = await versionService.compareVersions(baselineVersionId, comparisonVersionId);
    return res.json(comparison);
  } catch (error: any) {
    console.error('Error comparing versions:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'VERSION_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    if (error.message.includes('Performance metrics not available')) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PERFORMANCE_DATA',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to compare versions',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Create A/B test
 * POST /api/workspaces/:workspaceId/ab-tests
 */
router.post('/:workspaceId/ab-tests', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, variants, duration, metrics } = req.body;

    // Validate required fields
    if (!name || !variants || !Array.isArray(variants) || variants.length < 2) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Name and at least 2 variants are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Validate variants structure
    for (const variant of variants) {
      if (!variant.name || !variant.versionId || typeof variant.trafficPercentage !== 'number') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Each variant must have name, versionId, and trafficPercentage',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    }

    const abTest = await versionService.createABTest({
      name,
      description,
      workspaceId,
      variants,
      duration: duration || 3600, // Default 1 hour
      metrics: metrics || ['latency', 'throughput', 'errorRate']
    });

    return res.status(201).json(abTest);
  } catch (error: any) {
    console.error('Error creating A/B test:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'VERSION_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    if (error.message.includes('Traffic percentages')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TRAFFIC_SPLIT',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create A/B test',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;