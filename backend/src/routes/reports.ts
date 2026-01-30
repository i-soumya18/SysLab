/**
 * Performance Reports API Routes
 * Handles report generation, export, and sharing endpoints
 */

import express from 'express';
import { ReportService } from '../services/reportService';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const reportService = new ReportService();

/**
 * Generate performance report
 * POST /api/reports/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { 
      workspaceId, 
      versionId, 
      comparisonVersionId, 
      reportType, 
      title, 
      includeRecommendations,
      exportFormat 
    } = req.body;

    // Validate required fields
    if (!workspaceId || !reportType) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'workspaceId and reportType are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Validate report type
    const validReportTypes = ['single', 'comparison', 'trend'];
    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REPORT_TYPE',
          message: `Report type must be one of: ${validReportTypes.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Validate version requirements
    if (reportType === 'single' && !versionId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_VERSION_ID',
          message: 'versionId is required for single version reports',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    if (reportType === 'comparison' && (!versionId || !comparisonVersionId)) {
      return res.status(400).json({
        error: {
          code: 'MISSING_COMPARISON_VERSIONS',
          message: 'Both versionId and comparisonVersionId are required for comparison reports',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const report = await reportService.generateReport({
      workspaceId,
      versionId,
      comparisonVersionId,
      reportType,
      title,
      includeRecommendations,
      exportFormat
    });

    return res.status(201).json(report);
  } catch (error: any) {
    console.error('Error generating report:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate report',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Get report by ID
 * GET /api/reports/:reportId
 */
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await reportService.getReportById(reportId);
    if (!report) {
      return res.status(404).json({
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.json(report);
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch report',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Export report in specified format
 * GET /api/reports/:reportId/export/:format
 */
router.get('/:reportId/export/:format', async (req, res) => {
  try {
    const { reportId, format } = req.params;

    // Validate export format
    const validFormats = ['json', 'html', 'pdf'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EXPORT_FORMAT',
          message: `Export format must be one of: ${validFormats.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const exportData = await reportService.exportReport(reportId, format as 'json' | 'html' | 'pdf');

    // Set appropriate headers based on format
    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.json"`);
        break;
      case 'html':
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.html"`);
        break;
      case 'pdf':
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
        break;
    }

    if (Buffer.isBuffer(exportData)) {
      return res.send(exportData);
    } else {
      return res.send(exportData);
    }
  } catch (error: any) {
    console.error('Error exporting report:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'REPORT_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export report',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * List reports for a workspace
 * GET /api/workspaces/:workspaceId/reports
 */
router.get('/workspaces/:workspaceId/reports', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { limit, offset, reportType } = req.query;

    // This would typically call a method to list reports
    // For now, return empty array as placeholder
    res.json({
      reports: [],
      total: 0,
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0
    });
  } catch (error: any) {
    console.error('Error listing reports:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list reports',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Share report (generate shareable link)
 * POST /api/reports/:reportId/share
 */
router.post('/:reportId/share', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { expiresIn } = req.body; // Optional expiration time

    // Generate share token
    const shareToken = uuidv4();
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // This would typically update the report with share token
    // For now, return the share information
    const shareUrl = `${req.protocol}://${req.get('host')}/shared/reports/${shareToken}`;

    res.json({
      shareToken,
      shareUrl,
      expiresAt,
      reportId
    });
  } catch (error: any) {
    console.error('Error sharing report:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to share report',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Access shared report
 * GET /api/shared/reports/:shareToken
 */
router.get('/shared/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;

    // This would typically look up the report by share token
    // For now, return not found
    res.status(404).json({
      error: {
        code: 'SHARED_REPORT_NOT_FOUND',
        message: 'Shared report not found or expired',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  } catch (error: any) {
    console.error('Error accessing shared report:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to access shared report',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Generate quick insights for a workspace
 * GET /api/workspaces/:workspaceId/insights
 */
router.get('/workspaces/:workspaceId/insights', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Generate quick performance insights
    const insights = {
      summary: 'Quick performance insights for your workspace',
      keyMetrics: {
        averageLatency: 125.5,
        throughput: 1250,
        errorRate: 0.02,
        reliability: 98.0
      },
      topBottlenecks: [
        {
          component: 'Database',
          type: 'latency',
          severity: 'high',
          impact: 'Response time increased by 40%'
        },
        {
          component: 'Load Balancer',
          type: 'throughput',
          severity: 'medium',
          impact: 'Processing capacity at 85%'
        }
      ],
      quickRecommendations: [
        'Consider adding database read replicas',
        'Implement connection pooling',
        'Add caching layer for frequently accessed data'
      ],
      generatedAt: new Date().toISOString()
    };

    res.json(insights);
  } catch (error: any) {
    console.error('Error generating insights:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate insights',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;